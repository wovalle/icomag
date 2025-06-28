import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import type { LpgRefill, LpgRefillEntry } from "../types";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";

export class LpgRefillRepository extends AuditableDrizzleRepository<
  typeof schema.lpgRefills
> {
  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    super(db, schema.lpgRefills, auditService, "LPG_REFILL");
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
    // Create the refill
    const [refill] = await this.db
      .insert(schema.lpgRefills)
      .values(refillData)
      .returning();

    // Create the entries
    const entriesWithRefillId = entries.map((entry) => ({
      ...entry,
      refill_id: refill.id,
    }));

    const createdEntries = await this.db
      .insert(schema.lpgRefillEntries)
      .values(entriesWithRefillId)
      .returning();

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
}
