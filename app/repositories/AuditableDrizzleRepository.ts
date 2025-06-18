import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../database/schema";
import { DrizzleRepository } from "../drizzleRepository";
import { AuditService } from "../services/auditService";
import type { AuditLogEntityType } from "./AuditLogRepository";

export class AuditableDrizzleRepository<
  T extends SQLiteTable
> extends DrizzleRepository<T> {
  private auditService: AuditService;
  private entityType: AuditLogEntityType;

  constructor(
    db: DrizzleD1Database<typeof schema>,
    table: T,
    auditService: AuditService,
    entityType: AuditLogEntityType
  ) {
    super(db, table);
    this.auditService = auditService;
    this.entityType = entityType;
  }

  protected async beforeCreate(data: Record<string, unknown>): Promise<void> {
    await super.beforeCreate(data);
  }

  protected async afterCreate(data: unknown): Promise<void> {
    await super.afterCreate(data);

    console.log("afterCreate", data);
    // Extract ID from the created entity
    const entityId = (data as any)?.id?.toString();
    if (entityId) {
      await this.auditService.logEntityCreate(
        this.entityType,
        entityId,
        data as Record<string, any>
      );
    }
  }

  protected async beforeUpdate(data: Record<string, unknown>): Promise<void> {
    await super.beforeUpdate(data);
  }

  protected async afterUpdate(data: unknown): Promise<void> {
    await super.afterUpdate(data);

    console.log("afterUpdate", data);

    // Extract ID and data from the updated entity
    const entityId = (data as any)?.id?.toString();
    if (entityId) {
      // For updates, we need to get the old data from the audit service
      // since we can't access it directly in afterUpdate
      await this.auditService.logEntityUpdate(
        this.entityType,
        entityId,
        {}, // Old data will be handled in the update method
        data as Record<string, any>
      );
    }
  }

  protected async beforeDelete(data: Record<string, unknown>): Promise<void> {
    await super.beforeDelete(data);
  }

  protected async afterDelete(data: Record<string, unknown>): Promise<void> {
    await super.afterDelete(data);
    console.log("afterDelete", data);

    const entityId = (data as any)?.id?.toString();
    if (entityId) {
      await this.auditService.logEntityDelete(
        this.entityType,
        entityId,
        data as Record<string, any>
      );
    }
  }

  // Override the update method to capture old data
  async update<TData extends Record<string, unknown>, TReturn = unknown>(
    id: string | number,
    data: TData,
    options?: { tx?: any }
  ): Promise<TReturn> {
    // Get the old data before updating
    const oldData = await this.findById(id);

    // Perform the update
    const result = await super.update(id, data, options);

    // Log the update with both old and new data
    if (oldData) {
      await this.auditService.logEntityUpdate(
        this.entityType,
        id.toString(),
        oldData as Record<string, any>,
        data
      );
    }

    return result as TReturn;
  }
}
