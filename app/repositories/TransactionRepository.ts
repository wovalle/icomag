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
}
