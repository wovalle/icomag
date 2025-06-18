import { and, eq, gte, like, lte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { DrizzleRepository } from "../drizzleRepository";

export type AuditLogEventType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SIGN_IN"
  | "SIGN_OUT"
  | "BULK_IMPORT"
  | "BULK_DELETE";

export type AuditLogEntityType =
  | "OWNER"
  | "TRANSACTION"
  | "TAG"
  | "ATTACHMENT"
  | "BATCH"
  | "PATTERN"
  | "TRANSACTION_TAG"
  | "SYSTEM";

export interface AuditLogEntry {
  event_type: AuditLogEventType;
  entity_type: AuditLogEntityType;
  entity_id?: string;
  user_id?: string;
  user_email?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  is_system_event?: number;
}

export interface AuditLogFilters {
  event_type?: AuditLogEventType;
  entity_type?: AuditLogEntityType;
  user_email?: string;
  entity_id?: string;
  is_system_event?: boolean;
  date_from?: Date;
  date_to?: Date;
  search?: string;
}

export class AuditLogRepository extends DrizzleRepository<
  typeof schema.auditLogs
> {
  constructor(db: DrizzleD1Database<typeof schema>) {
    super(db, schema.auditLogs);
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.create({
        ...entry,
        details: entry.details ? JSON.stringify(entry.details) : null,
        is_system_event: entry.is_system_event ?? 0,
      });
    } catch (error) {
      // Log the error but don't throw to avoid breaking the main operation
      console.error("Failed to create audit log entry:", error);
    }
  }

  async findWithFilters(
    filters: AuditLogFilters,
    pagination?: { page?: number; limit?: number }
  ) {
    const conditions = [];

    if (filters.event_type) {
      conditions.push(eq(schema.auditLogs.event_type, filters.event_type));
    }

    if (filters.entity_type) {
      conditions.push(eq(schema.auditLogs.entity_type, filters.entity_type));
    }

    if (filters.user_email) {
      conditions.push(
        like(schema.auditLogs.user_email, `%${filters.user_email}%`)
      );
    }

    if (filters.entity_id) {
      conditions.push(eq(schema.auditLogs.entity_id, filters.entity_id));
    }

    if (filters.is_system_event !== undefined) {
      conditions.push(
        eq(schema.auditLogs.is_system_event, filters.is_system_event ? 1 : 0)
      );
    }

    if (filters.date_from) {
      conditions.push(
        gte(
          schema.auditLogs.created_at,
          Math.floor(filters.date_from.getTime() / 1000)
        )
      );
    }

    if (filters.date_to) {
      conditions.push(
        lte(
          schema.auditLogs.created_at,
          Math.floor(filters.date_to.getTime() / 1000)
        )
      );
    }

    if (filters.search) {
      conditions.push(like(schema.auditLogs.details, `%${filters.search}%`));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    return this.findMany({
      where: whereCondition,
      pagination,
      orderBy: [{ column: schema.auditLogs.created_at, direction: "desc" }],
      with: {
        user: true,
      },
    });
  }

  async getEntityHistory(entityType: AuditLogEntityType, entityId: string) {
    return this.findMany({
      where: and(
        eq(schema.auditLogs.entity_type, entityType),
        eq(schema.auditLogs.entity_id, entityId)
      ),
      orderBy: [{ column: schema.auditLogs.created_at, direction: "desc" }],
      with: {
        user: true,
      },
    });
  }

  async getUserActivity(userId: string, limit = 50) {
    return this.findMany({
      where: eq(schema.auditLogs.user_id, userId),
      pagination: { limit },
      orderBy: [{ column: schema.auditLogs.created_at, direction: "desc" }],
    });
  }

  async getSystemEvents(limit = 100) {
    return this.findMany({
      where: eq(schema.auditLogs.is_system_event, 1),
      pagination: { limit },
      orderBy: [{ column: schema.auditLogs.created_at, direction: "desc" }],
      with: {
        user: true,
      },
    });
  }
}
