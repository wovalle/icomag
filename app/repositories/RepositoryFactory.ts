import { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import {
  AuditLogRepository,
  type AuditLogEntityType,
} from "./AuditLogRepository";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";
import { KVStoreRepository } from "./KVStoreRepository";
import { LpgRefillRepository } from "./LpgRefillRepository";
import { TransactionRepository } from "./TransactionRepository";
import { TransactionTagsRepository } from "./TransactionTagsRepository";

/**
 * Utility type to extract only SQLiteTable types from schema
 */
type SchemaTables = {
  [K in keyof typeof schema]: (typeof schema)[K] extends SQLiteTable
    ? (typeof schema)[K]
    : never;
}[keyof typeof schema];

/**
 * Factory for creating type-safe repositories for each table
 */
export class RepositoryFactory {
  private db: DrizzleD1Database<typeof schema>;
  protected auditService: AuditService;

  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    this.db = db;
    this.auditService = auditService;
  }

  // Type-safe factory methods for each table
  getOwnersRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.owners,
      this.auditService,
      "OWNER"
    );
  }

  getOwnerPatternsRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.ownerPatterns,
      this.auditService,
      "PATTERN"
    );
  }

  getTransactionBatchesRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.transactionBatches,
      this.auditService,
      "BATCH"
    );
  }

  getTransactionsRepository() {
    return new TransactionRepository(this.db, this.auditService);
  }

  getTransactionTagsRepository() {
    return new TransactionTagsRepository(this.db, this.auditService);
  }

  getTagPatternsRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.tagPatterns,
      this.auditService,
      "PATTERN"
    );
  }

  getTransactionToTagsRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.transactionToTags,
      this.auditService,
      "TRANSACTION_TAG"
    );
  }

  getAttachmentsRepository() {
    return new AuditableDrizzleRepository(
      this.db,
      schema.attachments,
      this.auditService,
      "ATTACHMENT"
    );
  }

  getLpgRefillsRepository() {
    return new LpgRefillRepository(this.db, this.auditService);
  }

  getKVStoreRepository() {
    return new KVStoreRepository(this.db, this.auditService);
  }

  getAuditLogRepository() {
    return new AuditLogRepository(this.db);
  }

  // Generic repository for any table (type-safe)
  forTable<T extends SchemaTables>(table: T, entityType: AuditLogEntityType) {
    return new AuditableDrizzleRepository(
      this.db,
      table,
      this.auditService,
      entityType
    );
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
  db: DrizzleD1Database<typeof schema>,
  auditService: AuditService
) => {
  return new RepositoryFactory(db, auditService);
};
