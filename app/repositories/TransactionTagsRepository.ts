import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";

export class TransactionTagsRepository extends AuditableDrizzleRepository<
  typeof schema.transactionTags
> {
  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    super(db, schema.transactionTags, auditService, "TAG");
  }

  /**
   * Get a transaction tag by ID with its parent tag relation
   */
  async getTransactionTagsWithParentTag(tagId: number) {
    return await this.db.query.transactionTags.findFirst({
      where: eq(schema.transactionTags.id, tagId),
      with: {
        parentTag: true,
      },
    });
  }
}
