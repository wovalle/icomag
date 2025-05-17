import { eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";

export class KVStoreRepository {
  private db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.db
      .select({ value: schema.kvStore.value })
      .from(schema.kvStore)
      .where(eq(schema.kvStore.key, key))
      .get();

    return result?.value || null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db
      .insert(schema.kvStore)
      .values({
        key,
        value,
      })
      .onConflictDoUpdate({
        target: schema.kvStore.key,
        set: {
          value,
          updated_at: Math.floor(Date.now() / 1000),
        },
      });
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(schema.kvStore).where(eq(schema.kvStore.key, key));
  }
}
