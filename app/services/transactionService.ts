import { and, eq, type SQL } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { DateTime } from "luxon";
import * as schema from "../../database/schema";
import { RepositoryFactory } from "../repositories/RepositoryFactory";
import type { Owner, Tag, Transaction, TransactionWithDetails } from "../types";

export type DB = DrizzleD1Database<typeof schema>;

interface OwnerPattern {
  pattern: string;
  owner_id: number;
  is_active: number;
}

interface TagPattern {
  pattern: string;
  tag_id: number;
  is_active: number;
}

/**
 * Transaction Service
 *
 * Contains all the business logic for interacting with transactions
 */
export class TransactionService {
  private repositoryFactory: RepositoryFactory;

  constructor(repositoryFactory: RepositoryFactory) {
    this.repositoryFactory = repositoryFactory;
  }

  /**
   * Automatically assigns an owner to a transaction based on owner patterns
   */
  async autoAssignOwner(
    transactionId: number
  ): Promise<{ success: boolean; owner_id?: number | null; error?: string }> {
    try {
      // First get the transaction to access its description
      const transaction = (await this.repositoryFactory
        .getTransactionsRepository()
        .findById(transactionId)) as Transaction | undefined;

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
      const allOwnerPatterns = (await this.repositoryFactory
        .getOwnerPatternsRepository()
        .findMany({
          where: eq(schema.ownerPatterns.is_active, 1) as SQL<unknown>,
        })) as OwnerPattern[];

      // Find a matching pattern
      const matchingPattern = allOwnerPatterns.find(
        (pattern) =>
          descriptionText && new RegExp(pattern.pattern).test(descriptionText)
      );

      if (!matchingPattern) {
        return { success: true, owner_id: null };
      }

      // Assign the owner
      await this.repositoryFactory
        .getTransactionsRepository()
        .update(transactionId, {
          owner_id: matchingPattern.owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        });

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
      const transaction = (await this.repositoryFactory
        .getTransactionsRepository()
        .findById(transactionId)) as Transaction | undefined;

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
      const allTagPatterns = (await this.repositoryFactory
        .getTagPatternsRepository()
        .findMany({
          where: eq(schema.tagPatterns.is_active, 1) as SQL<unknown>,
        })) as TagPattern[];

      // Find matching patterns
      const matchingPatterns = allTagPatterns.filter(
        (pattern) =>
          descriptionText && new RegExp(pattern.pattern).test(descriptionText)
      );

      if (matchingPatterns.length === 0) {
        return { success: true, tagIds: [] };
      }

      // Get the tag IDs from the matching patterns
      const tagIds = matchingPatterns.map((pattern) => pattern.tag_id);

      // For each tag ID, check if it's already assigned to the transaction
      for (const tagId of tagIds) {
        // Check if the tag is already assigned to the transaction
        const whereCondition = and(
          eq(schema.transactionToTags.transaction_id, transactionId),
          eq(schema.transactionToTags.tag_id, tagId)
        );

        const existingTag = await this.repositoryFactory
          .getTransactionToTagsRepository()
          .findOne({
            where: whereCondition,
          });

        // If tag is not already assigned, add it
        if (!existingTag) {
          await this.repositoryFactory.getTransactionToTagsRepository().create({
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
      await this.repositoryFactory
        .getTransactionsRepository()
        .update(transactionId, {
          description,
          updated_at: Math.floor(Date.now() / 1000),
        });

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

      await this.repositoryFactory
        .getTransactionsRepository()
        .update(transactionId, {
          owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        });

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
      const existingTag = await this.repositoryFactory
        .getTransactionToTagsRepository()
        .findOne({
          where: and(
            eq(schema.transactionToTags.transaction_id, transactionId),
            eq(schema.transactionToTags.tag_id, tag_id)
          ),
        });

      if (!existingTag) {
        await this.repositoryFactory.getTransactionToTagsRepository().create({
          transaction_id: transactionId,
          tag_id: tag_id,
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
      const existingTransactionToTag = await this.repositoryFactory
        .getTransactionToTagsRepository()
        .findOne({
          where: and(
            eq(schema.transactionToTags.transaction_id, transactionId),
            eq(schema.transactionToTags.tag_id, tagId)
          ),
        });

      if (existingTransactionToTag) {
        await this.repositoryFactory
          .getTransactionToTagsRepository()
          .delete(existingTransactionToTag.id);
      }

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
      const transaction = await this.repositoryFactory
        .getTransactionsRepository()
        .create({
          type: transactionData.type,
          amount: transactionData.amount,
          description: transactionData.description,
          date,
          owner_id,
          reference: transactionData.reference || null,
          category: transactionData.category || null,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });

      // Add tags if any were selected
      if (transactionData.tag_ids && transactionData.tag_ids.length > 0) {
        for (const tagId of transactionData.tag_ids) {
          await this.repositoryFactory.getTransactionToTagsRepository().create({
            transaction_id: transaction.id,
            tag_id: parseInt(tagId),
            created_at: Math.floor(Date.now() / 1000),
          });
        }
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
      const result = await this.repositoryFactory
        .getTransactionsRepository()
        .findWithFilters({
          ownerId,
          transactionType,
          tagId,
          startDate,
          endDate,
          searchTerm,
          noOwner,
          noTags,
          page,
          limit,
        });

      return {
        ...result,
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
      const transaction = await this.repositoryFactory
        .getTransactionsRepository()
        .findByIdWithDetails(id);

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      return {
        transaction,
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
      const ownersList = await this.repositoryFactory
        .getOwnersRepository()
        .findMany({
          where: eq(schema.owners.is_active, 1),
          orderBy: [{ column: schema.owners.name, direction: "asc" }],
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
      const tagsList = await this.repositoryFactory
        .getTransactionTagsRepository()
        .findMany({
          orderBy: [{ column: schema.transactionTags.name, direction: "asc" }],
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

  /**
   * Get all tags ordered by last usage (most recently used first)
   */
  async getTagsOrderedByUsage(): Promise<{
    tags: Tag[];
    success: boolean;
    error?: string;
  }> {
    try {
      // Get tags via repository
      const tagsList = await this.repositoryFactory
        .getTransactionTagsRepository()
        .findMany();

      // For each tag, get the last usage timestamp from transaction_to_tags
      const tagsWithUsage = await Promise.all(
        tagsList.map(async (tag) => {
          // Get the most recent usage of this tag
          const lastUsage = await this.repositoryFactory
            .getTransactionToTagsRepository()
            .findMany({
              where: eq(schema.transactionToTags.tag_id, tag.id),
              orderBy: [
                {
                  column: schema.transactionToTags.created_at,
                  direction: "desc",
                },
              ],
              pagination: { limit: 1 },
            });

          const lastUsedAt = lastUsage.length > 0 ? lastUsage[0].created_at : 0;

          return {
            ...tag,
            _lastUsedAt: lastUsedAt,
          };
        })
      );

      // Sort by last usage, then by creation date
      const sortedTags = tagsWithUsage.sort((a, b) => {
        if (a._lastUsedAt !== b._lastUsedAt) {
          return b._lastUsedAt - a._lastUsedAt; // Descending order
        }
        return b.created_at - a.created_at; // Descending order by creation date
      });

      // Remove the temporary _lastUsedAt field
      const cleanTags = sortedTags.map(({ _lastUsedAt, ...tag }) => tag);

      return {
        tags: cleanTags as Tag[],
        success: true,
      };
    } catch (error) {
      console.error("Error retrieving tags ordered by usage:", error);
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
    const date = DateTime.fromSeconds(timestamp);
    const now = DateTime.now();

    // If same year: dd mmmm (e.g., "15 January")
    if (date.year === now.year) {
      return date.toFormat("dd MMMM");
    }

    // If different year: dd/mm/yy (e.g., "15/01/23")
    return date.toFormat("dd/MM/yy");
  },
};
