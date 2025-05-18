import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import {
  owners,
  tagPatterns,
  transactionTags,
  transactionToTags,
  transactions,
} from "../../database/schema";
import type { Owner, Tag, Transaction, TransactionWithDetails } from "../types";

export type DB = DrizzleD1Database<typeof schema>;

/**
 * Transaction Service
 *
 * Contains all the business logic for interacting with transactions
 */
export class TransactionService {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /**
   * Automatically assigns an owner to a transaction based on owner patterns
   */
  async autoAssignOwner(
    transactionId: number
  ): Promise<{ success: boolean; owner_id?: number | null; error?: string }> {
    try {
      // First get the transaction to access its description
      const transaction = await this.db.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      if (!transaction.description && !transaction.bank_description) {
        return {
          success: false,
          error: "Transaction has no description to match",
        };
      }

      // Use the description or bank_description as the text to match patterns against
      const descriptionText =
        transaction.description || transaction.bank_description;

      // Get all active owner patterns
      const allOwnerPatterns = await this.db.query.ownerPatterns.findMany({
        where: eq(schema.ownerPatterns.is_active, 1),
      });

      // Find a matching pattern
      const matchingPattern = allOwnerPatterns.find(
        (pattern) =>
          descriptionText && new RegExp(pattern.pattern).test(descriptionText)
      );

      if (!matchingPattern) {
        return { success: true, owner_id: null };
      }

      // Assign the owner
      await this.db
        .update(transactions)
        .set({
          owner_id: matchingPattern.owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, transactionId));

      return { success: true, owner_id: matchingPattern.owner_id };
    } catch (error) {
      console.error("Error auto-assigning owner to transaction:", error);
      return { success: false, error: "Failed to auto-assign owner" };
    }
  }

  /**
   * Automatically assigns tags to a transaction based on tag patterns
   */
  async autoAssignTags(
    transactionId: number
  ): Promise<{ success: boolean; tagIds?: number[]; error?: string }> {
    try {
      // First get the transaction to access its description
      const transaction = await this.db.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      if (!transaction.description && !transaction.bank_description) {
        return {
          success: false,
          error: "Transaction has no description to match",
        };
      }

      // Use the description or bank_description as the text to match patterns against
      const descriptionText =
        transaction.description || transaction.bank_description;

      // Get all active tag patterns
      const allTagPatterns = await this.db.query.tagPatterns.findMany({
        where: eq(tagPatterns.is_active, 1),
      });

      // Find all matching patterns
      const matchingPatterns = allTagPatterns.filter(
        (pattern) =>
          descriptionText && new RegExp(pattern.pattern).test(descriptionText)
      );

      if (matchingPatterns.length === 0) {
        return { success: true, tagIds: [] };
      }

      // Get unique tag IDs from matching patterns
      const tagIds = [
        ...new Set(matchingPatterns.map((pattern) => pattern.tag_id)),
      ];

      // For each tag ID, check if it's already assigned to the transaction
      for (const tagId of tagIds) {
        // Check if the tag is already assigned to the transaction
        const existingTag = await this.db
          .select()
          .from(transactionToTags)
          .where(
            and(
              eq(transactionToTags.transaction_id, transactionId),
              eq(transactionToTags.tag_id, tagId)
            )
          )
          .limit(1);

        // If tag is not already assigned, add it
        if (existingTag.length === 0) {
          await this.db.insert(transactionToTags).values({
            transaction_id: transactionId,
            tag_id: tagId,
            created_at: Math.floor(Date.now() / 1000),
          });
        }
      }

      return { success: true, tagIds };
    } catch (error) {
      console.error("Error auto-assigning tags to transaction:", error);
      return { success: false, error: "Failed to auto-assign tags" };
    }
  }

  /**
   * Updates the description of a transaction
   */
  async updateTransactionDescription(
    transactionId: number,
    description: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(transactions)
        .set({
          description,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, transactionId));

      return { success: true };
    } catch (error) {
      console.error("Error updating transaction description:", error);
      return {
        success: false,
        error: "Failed to update transaction description",
      };
    }
  }

  /**
   * Assigns an owner to a transaction
   */
  async assignOwnerToTransaction(
    transactionId: number,
    ownerId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert to integer if not null, otherwise keep as null
      const owner_id = ownerId ? parseInt(ownerId) : null;

      await this.db
        .update(transactions)
        .set({
          owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, transactionId));

      return { success: true };
    } catch (error) {
      console.error("Error assigning owner to transaction:", error);
      return { success: false, error: "Failed to assign owner to transaction" };
    }
  }

  /**
   * Adds a tag to a transaction
   */
  async addTagToTransaction(
    transactionId: number,
    tagId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tag_id = parseInt(tagId);

      // Check if the tag is already assigned to the transaction
      const existingTag = await this.db
        .select()
        .from(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, transactionId),
            eq(transactionToTags.tag_id, tag_id)
          )
        )
        .limit(1);

      if (existingTag.length === 0) {
        await this.db.insert(transactionToTags).values({
          transaction_id: transactionId,
          tag_id,
          created_at: Math.floor(Date.now() / 1000),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error adding tag to transaction:", error);
      return { success: false, error: "Failed to add tag to transaction" };
    }
  }

  /**
   * Removes a tag from a transaction
   */
  async removeTagFromTransaction(
    transactionId: number,
    tagId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .delete(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, transactionId),
            eq(transactionToTags.tag_id, tagId)
          )
        );

      return { success: true };
    } catch (error) {
      console.error("Error removing tag from transaction:", error);
      return { success: false, error: "Failed to remove tag from transaction" };
    }
  }

  /**
   * Creates a new transaction
   */
  async createTransaction(transactionData: {
    type: string;
    amount: number;
    description: string;
    date: string;
    owner_id?: string | null;
    reference?: string | null;
    category?: string | null;
    tag_ids?: string[];
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      // Convert date string to unix timestamp
      const date = Math.floor(new Date(transactionData.date).getTime() / 1000);

      // Convert owner_id to number or null
      const owner_id = transactionData.owner_id
        ? parseInt(transactionData.owner_id)
        : null;

      // Insert the transaction
      const [transaction] = await this.db
        .insert(transactions)
        .values({
          type: transactionData.type,
          amount: transactionData.amount,
          description: transactionData.description,
          date,
          owner_id,
          reference: transactionData.reference || null,
          category: transactionData.category || null,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        })
        .returning();

      // Add tags if any were selected
      if (transactionData.tag_ids && transactionData.tag_ids.length > 0) {
        const tagValues = transactionData.tag_ids.map((tagId) => ({
          transaction_id: transaction.id,
          tag_id: parseInt(tagId),
          created_at: Math.floor(Date.now() / 1000),
        }));

        await this.db.insert(transactionToTags).values(tagValues);
      }

      return { success: true, transaction: transaction as Transaction };
    } catch (error) {
      console.error("Error creating transaction:", error);
      return { success: false, error: "Failed to create transaction" };
    }
  }

  /**
   * Retrieves transactions with filters
   */
  async getTransactions({
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
    success: boolean;
    error?: string;
  }> {
    try {
      // Build the where clause based on filters
      let whereClause = [];
      const offset = (page - 1) * limit;

      // Owner filtering
      if (noOwner) {
        whereClause.push(isNull(transactions.owner_id));
      } else if (ownerId) {
        whereClause.push(eq(transactions.owner_id, parseInt(ownerId)));
      }

      if (transactionType) {
        whereClause.push(eq(transactions.type, transactionType));
      }

      // Add date range filters
      if (startDate) {
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        whereClause.push(sql`${transactions.date} >= ${startTimestamp}`);
      }

      if (endDate) {
        // Set to end of day for the end date
        const endTimestamp = Math.floor(
          new Date(endDate + "T23:59:59").getTime() / 1000
        );
        whereClause.push(sql`${transactions.date} <= ${endTimestamp}`);
      }

      if (searchTerm) {
        whereClause.push(
          or(
            like(transactions.description, "%" + searchTerm + "%"),
            like(transactions.bank_description, "%" + searchTerm + "%"),
            like(transactions.reference, "%" + searchTerm + "%"),
            like(transactions.serial, "%" + searchTerm + "%")
          )
        );
      }

      // Base query for transactions, always filtering out duplicates
      const baseQuery =
        whereClause.length > 0
          ? and(eq(transactions.is_duplicate, 0), ...whereClause)
          : eq(transactions.is_duplicate, 0);

      // Count total transactions for pagination
      const totalCountResult = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(transactions)
        .where(baseQuery);

      const totalCount = Number(totalCountResult[0]?.count || 0);

      // Get transactions with pagination
      let transactionsList = await this.db.query.transactions.findMany({
        where: baseQuery,
        orderBy: (transactions, { desc }) => [desc(transactions.date)],
        limit,
        offset,
        with: {
          owner: true,
        },
      });

      // If filtering by tag or noTags, fetch relevant transaction IDs
      let transactionIdsWithAnyTags: number[] = [];

      if (tagId || noTags) {
        // Get all transaction IDs that have any tags
        const transactionsWithAnyTag = await this.db
          .select({ transaction_id: transactionToTags.transaction_id })
          .from(transactionToTags)
          .groupBy(transactionToTags.transaction_id);

        transactionIdsWithAnyTags = transactionsWithAnyTag.map(
          (t) => t.transaction_id
        );
      }

      // If filtering by tag, we need to handle parent-child tag relationships
      if (tagId) {
        const parsedTagId = parseInt(tagId);

        // First, check if this tag has any children
        const childTags = await this.db
          .select()
          .from(transactionTags)
          .where(eq(transactionTags.parent_id, parsedTagId));

        // Get all tag IDs we need to filter by (parent + children)
        const relevantTagIds = [parsedTagId, ...childTags.map((tag) => tag.id)];

        // Get transactions associated with any of these tags
        const transactionsWithTag = await this.db
          .select({ transaction_id: transactionToTags.transaction_id })
          .from(transactionToTags)
          .where(inArray(transactionToTags.tag_id, relevantTagIds));

        const transactionIdsWithTag = transactionsWithTag.map(
          (t) => t.transaction_id
        );

        // Filter transactions to only include those with any of the relevant tags
        transactionsList = transactionsList.filter((transaction) =>
          transactionIdsWithTag.includes(transaction.id)
        );
      }
      // If filtering by noTags, filter out transactions that have any tags
      else if (noTags) {
        transactionsList = transactionsList.filter(
          (transaction) => !transactionIdsWithAnyTags.includes(transaction.id)
        );
      }

      // Load tags for each transaction
      const transactionIds = transactionsList.map((t) => t.id);

      // Get all transaction to tag relationships for these transactions
      const transactionTagRelations =
        transactionIds.length > 0
          ? await this.db
              .select()
              .from(transactionToTags)
              .innerJoin(
                transactionTags,
                eq(transactionToTags.tag_id, transactionTags.id)
              )
              .where(
                sql`${transactionToTags.transaction_id} IN (${sql.join(
                  transactionIds,
                  sql`, `
                )})`
              )
          : [];

      // Group tags by transaction id
      const transactionTagsMap = transactionTagRelations.reduce(
        (acc, { transaction_to_tags, transaction_tags }) => {
          if (!acc[transaction_to_tags.transaction_id]) {
            acc[transaction_to_tags.transaction_id] = [];
          }
          acc[transaction_to_tags.transaction_id].push(transaction_tags);
          return acc;
        },
        {}
      );

      // Add tags to each transaction
      const enhancedTransactions = transactionsList.map((transaction) => ({
        ...transaction,
        tags: transactionTagsMap[transaction.id] || [],
      })) as TransactionWithDetails[];

      // Get attachments for transactions
      const attachments = await this.db.query.attachments.findMany({
        where: inArray(
          schema.attachments.transaction_id,
          enhancedTransactions.map((t) => t.id)
        ),
      });

      // Group attachments by transaction id
      const transactionAttachmentsMap: Record<number, any[]> =
        attachments.reduce((acc: Record<number, any[]>, attachment) => {
          if (!acc[attachment.transaction_id]) {
            acc[attachment.transaction_id] = [];
          }
          acc[attachment.transaction_id].push(attachment);
          return acc;
        }, {});

      // Add attachments to each transaction
      const finalTransactions = enhancedTransactions.map((transaction) => ({
        ...transaction,
        attachments: transactionAttachmentsMap[transaction.id] || [],
      }));

      return {
        transactions: finalTransactions,
        pagination: {
          totalCount,
          pageCount: Math.ceil(totalCount / limit),
          currentPage: page,
          limit,
        },
        success: true,
      };
    } catch (error) {
      console.error("Error retrieving transactions:", error);
      return {
        transactions: [],
        pagination: {
          totalCount: 0,
          pageCount: 0,
          currentPage: page,
          limit,
        },
        success: false,
        error: "Failed to retrieve transactions",
      };
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: number): Promise<{
    transaction?: TransactionWithDetails;
    success: boolean;
    error?: string;
  }> {
    try {
      const transaction = await this.db.query.transactions.findFirst({
        where: eq(transactions.id, id),
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Get tags for the transaction
      const tagsRelations = await this.db.query.transactionToTags.findMany({
        where: eq(transactionToTags.transaction_id, id),
        with: {
          tag: true,
        },
      });

      const tags = tagsRelations.map((relation) => relation.tag);

      // Get attachments for the transaction
      const attachments = await this.db.query.attachments.findMany({
        where: eq(schema.attachments.transaction_id, id),
      });

      const transactionWithDetails: TransactionWithDetails = {
        ...transaction,
        tags,
        attachments,
      };

      return {
        transaction: transactionWithDetails,
        success: true,
      };
    } catch (error) {
      console.error("Error retrieving transaction:", error);
      return {
        success: false,
        error: "Failed to retrieve transaction",
      };
    }
  }

  /**
   * Get all owners
   */
  async getOwners(): Promise<{
    owners: Owner[];
    success: boolean;
    error?: string;
  }> {
    try {
      const ownersList = await this.db.query.owners.findMany({
        where: eq(owners.is_active, 1),
        orderBy: (owners, { asc }) => [asc(owners.name)],
      });

      return {
        owners: ownersList as Owner[],
        success: true,
      };
    } catch (error) {
      console.error("Error retrieving owners:", error);
      return {
        owners: [],
        success: false,
        error: "Failed to retrieve owners",
      };
    }
  }

  /**
   * Get all tags
   */
  async getTags(): Promise<{
    tags: Tag[];
    success: boolean;
    error?: string;
  }> {
    try {
      const tagsList = await this.db.query.transactionTags.findMany({
        orderBy: (transactionTags, { asc }) => [asc(transactionTags.name)],
        with: {
          parentTag: true,
        },
      });

      return {
        tags: tagsList as Tag[],
        success: true,
      };
    } catch (error) {
      console.error("Error retrieving tags:", error);
      return {
        tags: [],
        success: false,
        error: "Failed to retrieve tags",
      };
    }
  }
}

/**
 * Helper functions for formatting
 */
export const formatters = {
  /**
   * Formats a currency amount
   */
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  },

  /**
   * Formats a timestamp to a date string
   */
  formatDate: (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  },
};
