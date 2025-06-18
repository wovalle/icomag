import type { User } from "better-auth";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import {
  AuditLogRepository,
  type AuditLogEntityType,
  type AuditLogEntry,
} from "../repositories/AuditLogRepository";

export interface AuditContext {
  user?: User | null;
  request?: Request;
  skipAudit?: boolean;
}

export class AuditService {
  private auditLogRepository: AuditLogRepository;

  constructor(private db: DrizzleD1Database<typeof schema>) {
    this.auditLogRepository = new AuditLogRepository(db);
  }

  private getRequestInfo(request?: Request) {
    if (!request) return {};

    return {
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        undefined,
      user_agent: request.headers.get("user-agent") || undefined,
    };
  }

  async logEvent(
    entry: Omit<
      AuditLogEntry,
      "user_id" | "user_email" | "ip_address" | "user_agent"
    >,
    context?: AuditContext
  ): Promise<void> {
    const requestInfo = this.getRequestInfo(context?.request);

    await this.auditLogRepository.log({
      ...entry,
      user_id: context?.user?.id,
      user_email: context?.user?.email,
      ...requestInfo,
    });
  }

  // Entity change logging methods
  async logEntityCreate(
    entityType: AuditLogEntityType,
    entityId: string,
    entityData: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "CREATE",
        entity_type: entityType,
        entity_id: entityId,
        details: {
          action: "created",
          new_values: entityData,
        },
        is_system_event: 0,
      },
      context
    );
  }

  async logEntityUpdate(
    entityType: AuditLogEntityType,
    entityId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    // Calculate what changed
    const changes: Record<string, { old: any; new: any }> = {};

    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    }

    await this.logEvent(
      {
        event_type: "UPDATE",
        entity_type: entityType,
        entity_id: entityId,
        details: {
          action: "updated",
          changes,
        },
        is_system_event: 0,
      },
      context
    );
  }

  async logEntityDelete(
    entityType: AuditLogEntityType,
    entityId: string,
    entityData: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "DELETE",
        entity_type: entityType,
        entity_id: entityId,
        details: {
          action: "deleted",
          deleted_values: entityData,
        },
        is_system_event: 0,
      },
      context
    );
  }

  // System event logging methods
  async logSignIn(
    user: User,
    details: Record<string, any> = {},
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "SIGN_IN",
        entity_type: "SYSTEM",
        details: {
          action: "user_signed_in",
          user_name: user.name,
          ...details,
        },
        is_system_event: 1,
      },
      { ...context, user }
    );
  }

  async logSignOut(
    user: User,
    details: Record<string, any> = {},
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "SIGN_OUT",
        entity_type: "SYSTEM",
        details: {
          action: "user_signed_out",
          user_name: user.name,
          ...details,
        },
        is_system_event: 1,
      },
      { ...context, user }
    );
  }

  async logBulkImport(
    entityType: AuditLogEntityType,
    count: number,
    filename?: string,
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "BULK_IMPORT",
        entity_type: entityType,
        details: {
          action: "bulk_import",
          count,
          filename,
        },
        is_system_event: 0,
      },
      context
    );
  }

  async logBulkDelete(
    entityType: AuditLogEntityType,
    count: number,
    criteria: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    await this.logEvent(
      {
        event_type: "BULK_DELETE",
        entity_type: entityType,
        details: {
          action: "bulk_delete",
          count,
          criteria,
        },
        is_system_event: 0,
      },
      context
    );
  }

  // Convenience method for getting audit logs with filters
  async getAuditLogs(
    filters: any,
    pagination?: { page?: number; limit?: number }
  ) {
    return this.auditLogRepository.findWithFilters(filters, pagination);
  }

  // Get entity history
  async getEntityHistory(entityType: AuditLogEntityType, entityId: string) {
    return this.auditLogRepository.getEntityHistory(entityType, entityId);
  }

  // Get user activity
  async getUserActivity(userId: string, limit = 50) {
    return this.auditLogRepository.getUserActivity(userId, limit);
  }

  // Get system events
  async getSystemEvents(limit = 100) {
    return this.auditLogRepository.getSystemEvents(limit);
  }
}
