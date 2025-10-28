import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import type { TransactionWithDetails } from "../types";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";

export class TransactionRepository extends AuditableDrizzleRepository<
  typeof schema.transactions
> {
  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    super(db, schema.transactions, auditService, "TRANSACTION");
  }

  /**
   * Get transaction by ID with all related data
   */
  async findByIdWithDetails(
    id: number
  ): Promise<TransactionWithDetails | undefined> {
    const transaction = await this.db.query.transactions.findFirst({
      where: eq(schema.transactions.id, id),
      with: {
        owner: true,
        attachments: true,
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!transaction) {
      return undefined;
    }

    const tags = transaction.tags.map((relation) => relation.tag);

    return {
      ...transaction,
      tags,
    };
  }

  /**
   * Find a transaction with owner and attachments - properly typed
   */
  async findOneWithOwnerAndAttachments(where: any) {
    return await this.db.query.transactions.findFirst({
      where,
      with: {
        owner: true,
        attachments: true,
      },
    });
  }

  /**
   * Find transactions with filters
   */
  async findWithFilters({
    ownerId,
    transactionType,
    tagId,
    startDate,
    endDate,
    searchTerm,
    noOwner = false,
    noTags = false,
    page = 1,
    limit = 20,
  }: {
    ownerId?: string | null;
    transactionType?: string | null;
    tagId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    searchTerm?: string | null;
    noOwner?: boolean;
    noTags?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    transactions: TransactionWithDetails[];
    pagination: {
      totalCount: number;
      pageCount: number;
      currentPage: number;
      limit: number;
    };
  }> {
    // Build the where clause based on filters
    let whereClause = [];
    const offset = (page - 1) * limit;

    // Owner filtering
    if (noOwner) {
      whereClause.push(isNull(schema.transactions.owner_id));
    } else if (ownerId) {
      whereClause.push(eq(schema.transactions.owner_id, parseInt(ownerId)));
    }

    if (transactionType) {
      whereClause.push(eq(schema.transactions.type, transactionType));
    }

    // Add date range filters
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      whereClause.push(sql`${schema.transactions.date} >= ${startTimestamp}`);
    }

    if (endDate) {
      // Set to end of day for the end date
      const endTimestamp = Math.floor(
        new Date(endDate + "T23:59:59").getTime() / 1000
      );
      whereClause.push(sql`${schema.transactions.date} <= ${endTimestamp}`);
    }

    if (searchTerm) {
      whereClause.push(
        or(
          like(schema.transactions.description, "%" + searchTerm + "%"),
          like(schema.transactions.bank_description, "%" + searchTerm + "%"),
          like(schema.transactions.reference, "%" + searchTerm + "%"),
          like(schema.transactions.serial, "%" + searchTerm + "%")
        )
      );
    }

    // Count total transactions for pagination
    const totalCountResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(schema.transactions)
      .leftJoin(
        schema.transactionToTags,
        eq(schema.transactions.id, schema.transactionToTags.transaction_id)
      )
      .where(
        and(
          eq(schema.transactions.is_duplicate, 0),
          ...whereClause,
          noTags === true
            ? isNull(schema.transactionToTags.tag_id)
            : tagId
            ? eq(schema.transactionToTags.tag_id, parseInt(tagId))
            : undefined
        )
      );

    const totalCount = Number(totalCountResult[0]?.count || 0);

    // If noTags is true, filter transactions that have no tags
    if (noTags) {
      whereClause.push(
        inArray(
          schema.transactions.id,
          sql`(
            SELECT t.id
            FROM transactions t
            LEFT JOIN transaction_to_tags tt ON t.id = tt.transaction_id
            WHERE tt.tag_id IS NULL
            OR tt.tag_id = 0
          )`
        )
      );
    }

    // If tagId is provided, filter by that tag
    if (tagId) {
      whereClause.push(
        inArray(
          schema.transactions.id,
          sql`(
            SELECT transaction_id
            FROM transaction_to_tags
            WHERE tag_id = ${parseInt(tagId)}
          )`
        )
      );
    }

    // Base query for transactions, always filtering out duplicates
    const baseQuery = and(
      eq(schema.transactions.is_duplicate, 0),
      ...whereClause
    );

    // Get transactions with pagination
    const transactionsList = await this.db.query.transactions.findMany({
      where: baseQuery,
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      limit,
      offset,
      with: {
        owner: true,
        attachments: true,
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return {
      transactions: transactionsList.map((transaction) => {
        const tags = transaction.tags.map((tag) => tag.tag);
        return {
          ...transaction,
          tags,
        };
      }),
      pagination: {
        totalCount,
        pageCount: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    };
  }

  /**
   * Find transactions by batch ID with owner relations
   */
  async findByBatchIdWithOwner(batchId: number) {
    return await this.db.query.transactions.findMany({
      where: eq(schema.transactions.batch_id, batchId),
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      with: {
        owner: true,
      },
    });
  }

  /**
   * Find transactions by batch ID with owner and tags relations
   */
  async findByBatchIdWithOwnerAndTags(
    batchId: number
  ): Promise<TransactionWithDetails[]> {
    const transactions = await this.db.query.transactions.findMany({
      where: eq(schema.transactions.batch_id, batchId),
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      with: {
        owner: true,
        attachments: true,
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return transactions.map((transaction) => {
      const tags = transaction.tags.map((relation) => relation.tag);
      return {
        ...transaction,
        tags,
      };
    });
  }

  /**
   * Find many transactions with full details including tags
   */
  async findManyWithTags(options: {
    where?: any;
    orderBy?: Array<{
      column:
        | typeof schema.transactions.date
        | typeof schema.transactions.id
        | typeof schema.transactions.amount;
      direction: "asc" | "desc";
    }>;
    pagination?: { limit: number; offset?: number };
  }): Promise<TransactionWithDetails[]> {
    // Convert orderBy to the correct Drizzle format
    let drizzleOrderBy;
    if (options.orderBy && options.orderBy.length > 0) {
      drizzleOrderBy = (transactions: any, { desc, asc }: any) =>
        options.orderBy!.map((order) =>
          order.direction === "desc" ? desc(order.column) : asc(order.column)
        );
    }

    const transactions = await this.db.query.transactions.findMany({
      where: options.where,
      orderBy: drizzleOrderBy,
      limit: options.pagination?.limit,
      offset: options.pagination?.offset,
      with: {
        owner: true,
        attachments: true,
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return transactions.map((transaction) => {
      const tags = transaction.tags.map((relation: any) => relation.tag);
      return {
        ...transaction,
        tags,
      };
    });
  }

  /**
   * Find recent transactions for a specific tag with owner information
   */
  async findRecentByTagId(tagId: number, limit: number = 20) {
    const results = await this.db
      .select()
      .from(schema.transactionToTags)
      .innerJoin(
        schema.transactions,
        eq(schema.transactionToTags.transaction_id, schema.transactions.id)
      )
      .leftJoin(
        schema.owners,
        eq(schema.owners.id, schema.transactions.owner_id)
      )
      .where(
        and(
          eq(schema.transactionToTags.tag_id, tagId),
          eq(schema.transactions.is_duplicate, 0)
        )
      )
      .limit(limit)
      .orderBy(sql`${schema.transactions.date} DESC`);

    return results.map((result) => ({
      ...result.transactions,
      owner: result.owners,
    }));
  }

  /**
   * Get apartment payment breakdown for a monthly-payment tag
   */
  async getMonthlyPaymentData(tagId: number, ownersRepo: any) {
    // Get all active owners
    const allActiveOwners = await ownersRepo.findMany({
      where: eq(schema.owners.is_active, 1),
      orderBy: [{ column: schema.owners.apartment_id, direction: "asc" }],
    });

    // Get all transactions for this tag
    const allTransactions = await this.findWithFilters({
      tagId: tagId.toString(),
      limit: 1000,
      page: 1,
    });

    // Calculate payment data for each owner
    const apartmentPayments = allActiveOwners.map((owner) => {
      // Get all credit transactions (payments) for this owner and tag
      const ownerPayments = allTransactions.transactions.filter(
        (t) => t.owner_id === owner.id && t.type === "credit"
      );

      const amountPaid = ownerPayments.reduce((sum, t) => sum + t.amount, 0);
      const paymentCount = ownerPayments.length;
      const lastPaymentDate =
        ownerPayments.length > 0
          ? Math.max(...ownerPayments.map((t) => t.date))
          : null;

      // Store individual payment transactions
      const transactions = ownerPayments.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
      }));

      // Determine status
      const status: "paid" | "pending" = amountPaid > 0 ? "paid" : "pending";

      return {
        owner,
        amountPaid,
        lastPaymentDate,
        paymentCount,
        transactions,
        status,
      };
    });

    return apartmentPayments;
  }

  /**
   * Get payment breakdown for multiple monthly-payment tags (for "all" view)
   */
  async getAllMonthlyPaymentsData(tagIds: number[], ownersRepo: any) {
    // Get all active owners
    const allActiveOwners = await ownersRepo.findMany({
      where: eq(schema.owners.is_active, 1),
      orderBy: [{ column: schema.owners.apartment_id, direction: "asc" }],
    });

    // For each tag, get transactions
    const allTransactionsList = await Promise.all(
      tagIds.map((tagId) =>
        this.findWithFilters({
          tagId: tagId.toString(),
          limit: 1000,
          page: 1,
        })
      )
    );

    // Flatten all transactions
    const allTransactions = allTransactionsList.flatMap((r) => r.transactions);

    // For each owner, calculate payments across all selected tags
    return allActiveOwners.map((owner) => {
      const ownerTransactions = allTransactions.filter(
        (t) => t.owner_id === owner.id && t.type === "credit"
      );

      const amountPaid = ownerTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      );
      const paymentCount = ownerTransactions.length;
      const lastPaymentDate =
        ownerTransactions.length > 0
          ? Math.max(...ownerTransactions.map((t) => t.date))
          : null;

      const transactions = ownerTransactions.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
      }));

      const status: "paid" | "pending" = amountPaid > 0 ? "paid" : "pending";

      return {
        owner,
        amountPaid,
        lastPaymentDate,
        paymentCount,
        transactions,
        status,
      };
    });
  }
}
