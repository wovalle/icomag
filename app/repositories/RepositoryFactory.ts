import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { DrizzleRepository } from "../drizzleRepository";
import { KVStoreRepository } from "./KVStoreRepository";
import { TransactionTagsRepository } from "./TransactionTagsRepository";

/**
 * Factory for creating type-safe repositories for each table
 */
export class RepositoryFactory {
  private db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  // Type-safe factory methods for each table
  getOwnersRepository() {
    return new DrizzleRepository(this.db, schema.owners);
  }

  getOwnerPatternsRepository() {
    return new DrizzleRepository(this.db, schema.ownerPatterns);
  }

  getTransactionBatchesRepository() {
    return new DrizzleRepository(this.db, schema.transactionBatches);
  }

  getTransactionsRepository() {
    return new DrizzleRepository(this.db, schema.transactions);
  }

  getTransactionTagsRepository() {
    return new TransactionTagsRepository(this.db);
  }

  getTagPatternsRepository() {
    return new DrizzleRepository(this.db, schema.tagPatterns);
  }

  getTransactionToTagsRepository() {
    return new DrizzleRepository(this.db, schema.transactionToTags);
  }

  getKVStoreRepository() {
    return new KVStoreRepository(this.db);
  }

  // Generic repository for any table (less type-safe)
  forTable<T extends (typeof schema)[keyof typeof schema]>(table: T) {
    return new DrizzleRepository<T>(this.db, table);
  }

  /**
   * Run a function within a transaction
   * @param callback Function to execute within the transaction
   */
  async transaction<T>(
    callback: (tx: import("../drizzleRepository").Transaction) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      return await callback(tx);
    });
  }
}

export const createRepositoryFactory = (
  db: DrizzleD1Database<typeof schema>
) => {
  return new RepositoryFactory(db);
};
