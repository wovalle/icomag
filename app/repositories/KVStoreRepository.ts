import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { AuditService } from "../services/auditService";
import { AuditableDrizzleRepository } from "./AuditableDrizzleRepository";

type KVStoreEntry = {
  key: string;
  value: string;
  updated_at: number;
};

export class KVStoreRepository extends AuditableDrizzleRepository<
  typeof schema.kvStore
> {
  constructor(
    db: DrizzleD1Database<typeof schema>,
    auditService: AuditService
  ) {
    super(db, schema.kvStore, auditService, "SYSTEM");
  }

  async get(key: string): Promise<string | null> {
    const result = await this.findOne<KVStoreEntry>({
      where: eq(schema.kvStore.key, key),
    });
    return result?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.upsert({
      key,
      value,
      updated_at: now,
    });
  }

  async delete(key: string): Promise<void> {
    await this.delete(key);
  }
}
