import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import type { LpgRefill, LpgRefillEntry } from "../types";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";

export class LpgRefillRepository extends AuditableDrizzleRepository<
  typeof schema.lpgRefills
> {
  private lpgRefillEntriesRepository: AuditableDrizzleRepository<
    typeof schema.lpgRefillEntries
  >;

  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    super(db, schema.lpgRefills, auditService, "LPG_REFILL");
    // Create the entries repository for proper audit logging
    this.lpgRefillEntriesRepository = new AuditableDrizzleRepository(
      db,
      schema.lpgRefillEntries,
      auditService,
      "LPG_REFILL_ENTRY"
    );
  }

  /**
   * Get LPG refill by ID with all related data
   */
  async findByIdWithDetails(id: number) {
    return await this.db.query.lpgRefills.findFirst({
      where: eq(schema.lpgRefills.id, id),
      with: {
        entries: {
          with: {
            owner: true,
            attachments: true,
          },
        },
        attachments: true,
        tag: true,
      },
    });
  }

  /**
   * Create a refill with entries in a transaction
   */
  async createRefillWithEntries(
    refillData: Omit<LpgRefill, "id" | "created_at" | "updated_at">,
    entries: Omit<
      LpgRefillEntry,
      "id" | "refill_id" | "created_at" | "updated_at"
    >[]
  ) {
    // Create the refill using the inherited create method for proper audit logging
    const refill = await this.create(refillData);

    // Create the entries with proper chunking and audit logging
    const entriesWithRefillId = entries.map((entry) => ({
      ...entry,
      refill_id: refill.id,
    }));

    // Use the lpgRefillEntries repository's batchCreate method
    // This ensures proper audit logging and uses the chunking logic from the base repository
    const createdEntries = await this.lpgRefillEntriesRepository.batchCreate(
      entriesWithRefillId
    );

    return { refill, entries: createdEntries };
  }

  /**
   * Get all refills with basic entry information
   */
  async findAllWithSummary() {
    return await this.db.query.lpgRefills.findMany({
      orderBy: (refills, { desc }) => [desc(refills.refill_date)],
      with: {
        entries: {
          with: {
            owner: true,
          },
        },
        attachments: true,
        tag: true,
      },
    });
  }

  /**
   * Get the latest refill (most recent by date)
   */
  async findLatest() {
    return await this.db.query.lpgRefills.findFirst({
      orderBy: (refills, { desc }) => [desc(refills.refill_date)],
      with: {
        entries: {
          with: {
            owner: true,
            attachments: true,
          },
        },
        attachments: true,
        tag: true,
      },
    });
  }

  /**
   * Get refill history for a specific owner
   */
  async findRefillsByOwnerId(ownerId: number) {
    const refillEntries = await this.db.query.lpgRefillEntries.findMany({
      where: eq(schema.lpgRefillEntries.owner_id, ownerId),
      orderBy: (entries, { desc }) => [desc(entries.created_at)],
      with: {
        refill: {
          with: {
            tag: true,
          },
        },
      },
    });

    // Transform to include owner entry data with refill
    return refillEntries.map((entry) => ({
      ...entry.refill,
      ownerEntry: entry,
    }));
  }

  /**
   * Get pending payments for an LPG refill
   */
  async getPendingPaymentsForRefill(refillId: number, transactionRepo: any) {
    const refill = await this.findByIdWithDetails(refillId);

    if (!refill?.entries || !refill.tag) {
      return [];
    }

    const allTransactions = await transactionRepo.findWithFilters({
      tagId: refill.tag.id.toString(),
      limit: 1000,
      page: 1,
    });

    const apartmentsWithDebt = refill.entries.filter(
      (entry) => (entry.total_amount || 0) > 0
    );

    const pendingPayments = apartmentsWithDebt
      .map((entry) => {
        if (!entry.owner_id) return null;

        const ownerPayments = allTransactions.transactions
          .filter((t) => t.owner_id === entry.owner_id && t.type === "credit")
          .reduce((sum, t) => sum + t.amount, 0);

        const amountOwed = entry.total_amount || 0;
        const amountPaid = ownerPayments;
        const remainingBalance = amountOwed - amountPaid;

        let status: "paid" | "pending" = "pending";
        if (remainingBalance <= 0) {
          status = "paid";
        }

        return {
          entry,
          owner: entry.owner,
          amountOwed,
          amountPaid,
          remainingBalance,
          status,
        };
      })
      .filter((result) => result !== null);

    return pendingPayments;
  }

  /**
   * Get pending payments for all LPG refills
   */
  async getAllPendingPayments(transactionRepo: any) {
    const allRefills = await this.findMany({});

    const allPendingPayments = await Promise.all(
      allRefills
        .filter((refill) => refill.tag_id)
        .map((refill) =>
          this.getPendingPaymentsForRefill(refill.id, transactionRepo)
        )
    );

    // Flatten and aggregate by owner
    const ownerPaymentsMap = new Map();

    allPendingPayments.flat().forEach((payment: any) => {
      if (!payment?.owner) return;

      const ownerId = payment.owner.id;
      if (!ownerPaymentsMap.has(ownerId)) {
        ownerPaymentsMap.set(ownerId, {
          owner: payment.owner,
          totalOwed: 0,
          totalPaid: 0,
          remainingBalance: 0,
          refills: [],
        });
      }

      const ownerData = ownerPaymentsMap.get(ownerId);
      ownerData.totalOwed += payment.amountOwed || 0;
      ownerData.totalPaid += payment.amountPaid || 0;
      ownerData.remainingBalance += payment.remainingBalance || 0;
    });

    return Array.from(ownerPaymentsMap.values()).map((data: any) => ({
      owner: data.owner,
      amountOwed: data.totalOwed,
      amountPaid: data.totalPaid,
      remainingBalance: data.remainingBalance,
      status:
        data.remainingBalance <= 0 ? ("paid" as const) : ("pending" as const),
    }));
  }
}
