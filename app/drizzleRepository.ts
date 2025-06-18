import type { User } from "better-auth";
import {
  asc,
  desc,
  eq,
  SQL,
  sql,
  type ExtractTablesWithRelations,
  type InferSelectModel,
} from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type {
  SQLiteColumn,
  SQLiteTable,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import * as schema from "../database/schema";
import { createRepositoryFactory } from "./repositories/RepositoryFactory";

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type WhereCondition = SQL | SQL[];

export interface AuditContext {
  user?: User | null;
  request?: Request;
  skipAudit?: boolean;
}

/**
 * Repository transaction type
 */
export type Transaction = SQLiteTransaction<
  "async",
  D1Result<unknown>,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Type alias for inferring select model from SQLite table
 */
type InferredSelectModel<T extends SQLiteTable> = InferSelectModel<T>;

/**
 * Database error class for handling database-specific errors
 */
export class DatabaseError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "DatabaseError";
    this.fieldErrors = fieldErrors;
  }
}

export class DrizzleRepository<T extends SQLiteTable> {
  protected db: DrizzleD1Database<typeof schema>;
  protected table: T;

  constructor(db: DrizzleD1Database<typeof schema>, table: T) {
    this.db = db;
    this.table = table;
  }

  /**
   * Find many records with optional filtering and pagination
   */
  async findMany<TReturn = InferredSelectModel<T>>(params?: {
    where?: WhereCondition;
    pagination?: PaginationParams;
    orderBy?: { column: SQLiteColumn; direction: "asc" | "desc" }[];
    tx?: Transaction;
  }): Promise<TReturn[]> {
    try {
      const { where, pagination, orderBy, tx } = params || {};
      const dbInstance = tx || this.db;

      // Basic query without relations
      let queryBuilder = dbInstance.select().from(this.table).$dynamic();

      if (where) {
        queryBuilder = queryBuilder.where(
          Array.isArray(where) ? sql`${where.join(" AND ")}` : where
        );
      }

      if (pagination) {
        const { page = 1, limit = 10 } = pagination;
        queryBuilder = queryBuilder.limit(limit).offset((page - 1) * limit);
      }

      if (orderBy && orderBy.length > 0) {
        const orderByC = orderBy.map(({ column, direction }) => {
          return direction === "asc" ? asc(column) : desc(column);
        });
        queryBuilder = queryBuilder.orderBy(...orderByC);
      }

      return queryBuilder as unknown as Promise<TReturn[]>;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Find a single record by its ID or custom condition
   */
  async findOne<TReturn = InferredSelectModel<T>>(params: {
    where: WhereCondition | undefined;
    tx?: Transaction;
  }): Promise<TReturn | undefined> {
    try {
      const { where, tx } = params;
      const dbInstance = tx || this.db;

      // Basic query without relations
      const result = await dbInstance
        .select()
        .from(this.table)
        .where(Array.isArray(where) ? sql`${where.join(" AND ")}` : where)
        .limit(1);

      return result[0] as TReturn | undefined;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Find a record by ID
   */
  async findById<TReturn = InferredSelectModel<T>>(
    id: number | string,
    params?: {
      tx?: Transaction;
    }
  ): Promise<TReturn | undefined> {
    // Find the primary key column - assuming id is the primary key
    const pkColumn = this.getPrimaryKeyColumn();

    return this.findOne<TReturn>({
      where: eq(pkColumn, id as any),
      tx: params?.tx,
    });
  }

  /**
   * Create a new record
   */
  async create<
    TData extends Record<string, unknown>,
    TReturn = InferredSelectModel<T>
  >(
    data: TData,
    options?: {
      tx?: Transaction;
    }
  ): Promise<TReturn> {
    try {
      // Execute lifecycle hook
      await this.beforeCreate(data);

      const dbInstance = options?.tx || this.db;

      // Add timestamps if they exist
      const now = Math.floor(Date.now() / 1000);
      const dataWithTimestamps = {
        ...data,
        ...(this.hasColumn("created_at") && { created_at: now }),
        ...(this.hasColumn("updated_at") && { updated_at: now }),
      };

      const result = await dbInstance
        .insert(this.table)
        .values(dataWithTimestamps as any)
        .returning();

      // Execute lifecycle hook
      if (result[0]) {
        await this.afterCreate(result[0] as unknown as TReturn);
      }

      return result[0] as TReturn;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Create multiple records in one transaction
   */
  async createMany<TData extends Record<string, unknown>, TReturn = unknown>(
    data: TData[],
    options?: {
      tx?: Transaction;
    }
  ): Promise<TReturn[]> {
    try {
      const dbInstance = options?.tx || this.db;
      const now = Math.floor(Date.now() / 1000);

      // Execute lifecycle hook for each item
      for (const item of data) {
        await this.beforeCreate(item);
      }

      // Add timestamps if they exist
      const dataWithTimestamps = data.map((item) => ({
        ...item,
        ...(this.hasColumn("created_at") && { created_at: now }),
        ...(this.hasColumn("updated_at") && { updated_at: now }),
      }));

      const result = await dbInstance
        .insert(this.table)
        .values(dataWithTimestamps as any)
        .returning();

      // Execute lifecycle hook for each result
      for (const item of result) {
        await this.afterCreate(item as unknown as TReturn);
      }

      return result as unknown as TReturn[];
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Upsert a record (insert or update if exists)
   * Uses the primary key or specified conflict columns to determine existence
   */
  async upsert<
    TData extends Record<string, unknown>,
    TReturn = InferredSelectModel<T>
  >(
    data: TData,
    options?: {
      tx?: Transaction;
      conflictColumns?: SQLiteColumn[];
    }
  ): Promise<TReturn> {
    try {
      // Determine conflict columns - use primary key if not specified
      const conflictColumns = options?.conflictColumns || [
        this.getPrimaryKeyColumn(),
      ];

      // Build where condition to check if record exists
      const whereConditions = conflictColumns.map((col) => {
        const value = data[col.name as keyof TData];
        if (value === undefined) {
          throw new Error(
            `Upsert data must include value for conflict column: ${col.name}`
          );
        }
        return eq(col, value as any);
      });

      const whereCondition =
        whereConditions.length === 1 ? whereConditions[0] : whereConditions;

      // Check if record exists
      const existingRecord = await this.findOne<TReturn>({
        where: whereCondition,
        tx: options?.tx,
      });

      if (existingRecord) {
        // Record exists, update it
        // For primary key updates, use the primary key value
        const pkColumn = this.getPrimaryKeyColumn();
        const pkValue = existingRecord[pkColumn.name as keyof TReturn];

        return this.update<TData, TReturn>(pkValue as any, data, {
          tx: options?.tx,
        });
      } else {
        // Record doesn't exist, create it
        return this.create<TData, TReturn>(data, {
          tx: options?.tx,
        });
      }
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Upsert multiple records
   */
  async upsertMany<
    TData extends Record<string, unknown>,
    TReturn = InferredSelectModel<T>
  >(
    data: TData[],
    options?: {
      tx?: Transaction;
      conflictColumns?: SQLiteColumn[];
    }
  ): Promise<TReturn[]> {
    try {
      const results: TReturn[] = [];

      // Process each record individually to maintain proper lifecycle hooks
      for (const item of data) {
        const result = await this.upsert<TData, TReturn>(item, options);
        results.push(result);
      }

      return results;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Update a record by ID
   */
  async update<TData extends Record<string, unknown>, TReturn = unknown>(
    id: number | string,
    data: TData,
    options?: {
      tx?: Transaction;
    }
  ): Promise<TReturn> {
    try {
      const pkColumn = this.getPrimaryKeyColumn();
      const dbInstance = options?.tx || this.db;

      // Execute lifecycle hook
      await this.beforeUpdate(data);

      // Add updated timestamp if it exists
      const dataWithTimestamp = {
        ...data,
        ...(this.hasColumn("updated_at") && {
          updated_at: Math.floor(Date.now() / 1000),
        }),
      };

      const result = await dbInstance
        .update(this.table)
        .set(dataWithTimestamp as any)
        .where(eq(pkColumn, id as any))
        .returning();

      // Execute lifecycle hook
      if (result[0]) {
        await this.afterUpdate(result[0] as unknown as TReturn);
      }

      return result[0] as TReturn;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Update multiple records that match the where condition
   */
  async updateMany<TData extends Record<string, unknown>, TReturn = unknown>(
    where: WhereCondition,
    data: TData,
    options?: {
      tx?: Transaction;
    }
  ): Promise<TReturn[]> {
    try {
      const dbInstance = options?.tx || this.db;

      // Execute lifecycle hook
      await this.beforeUpdate(data);

      // Add updated timestamp if it exists
      const dataWithTimestamp = {
        ...data,
        ...(this.hasColumn("updated_at") && {
          updated_at: Math.floor(Date.now() / 1000),
        }),
      };

      const result = await dbInstance
        .update(this.table)
        .set(dataWithTimestamp as any)
        .where(Array.isArray(where) ? sql`${where.join(" AND ")}` : where)
        .returning();

      // Execute lifecycle hook for each result
      for (const item of result) {
        await this.afterUpdate(item as unknown as TReturn);
      }

      return result as unknown as TReturn[];
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(
    id: number | string,
    options?: {
      tx?: Transaction;
    }
  ): Promise<void> {
    try {
      const pkColumn = this.getPrimaryKeyColumn();
      const dbInstance = options?.tx || this.db;

      const item = await this.findById(id, { tx: options?.tx });

      // Execute lifecycle hook if item exists
      if (item) {
        await this.beforeDelete(item as unknown as Record<string, unknown>);
      }

      await dbInstance.delete(this.table).where(eq(pkColumn, id as any));

      // Execute lifecycle hook if item existed
      if (item) {
        await this.afterDelete(item as unknown as Record<string, unknown>);
      }
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Delete multiple records that match the where condition
   */
  async deleteMany(
    where: WhereCondition,
    options?: {
      tx?: Transaction;
    }
  ): Promise<number> {
    try {
      const dbInstance = options?.tx || this.db;

      // Get items that will be deleted for hooks
      const items = await this.findMany({ where, tx: options?.tx });

      // Execute lifecycle hook for each item
      for (const item of items) {
        await this.beforeDelete(item as unknown as Record<string, unknown>);
      }

      const result = await dbInstance
        .delete(this.table)
        .where(Array.isArray(where) ? sql`${where.join(" AND ")}` : where)
        .returning();

      // Execute lifecycle hook for each deleted item
      for (const item of items) {
        await this.afterDelete(item as unknown as Record<string, unknown>);
      }

      return result.length;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Count records with optional filtering
   */
  async count(
    where?: WhereCondition,
    options?: {
      tx?: Transaction;
    }
  ): Promise<number> {
    try {
      const dbInstance = options?.tx || this.db;

      const result = await dbInstance
        .select({ count: sql`count(*)` })
        .from(this.table)
        .where(
          where
            ? Array.isArray(where)
              ? sql`${where.join(" AND ")}`
              : where
            : undefined
        );

      return Number(result[0]?.count || 0);
    } catch (err) {
      throw this.handleError(err);
    }
  }

  /**
   * Run a function within a transaction
   * @param callback Function to execute within the transaction
   */
  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return await callback(tx);
    });
  }

  /**
   * Handle database errors and convert them to more user-friendly formats
   */
  protected handleError(err: unknown): Error {
    // Convert SQLite errors to more user-friendly format
    // D1 has limited error types compared to PostgreSQL
    if (err instanceof Error) {
      // Check for constraint violations
      if (err.message.includes("UNIQUE constraint failed")) {
        const match = err.message.match(/UNIQUE constraint failed: ([^)]+)/);
        if (match) {
          const column = match[1].split(".").pop();
          return new DatabaseError("A record with this value already exists.", {
            [column || "field"]: ["This value already exists"],
          });
        }
      }

      // Check for foreign key violations
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        return new DatabaseError("Related record does not exist.", {
          field: ["Referenced record does not exist"],
        });
      }
    }

    return err as Error;
  }

  /**
   * Get the primary key column of the table
   */
  protected getPrimaryKeyColumn(): SQLiteColumn {
    const pkColumn = Object.values(this.table).find(
      (col) => col.primary === true
    ) as SQLiteColumn;

    if (!pkColumn) {
      throw new Error(
        `No primary key found for table ${
          (this.table as any).$inferTable?.name || "unknown"
        }`
      );
    }

    return pkColumn;
  }

  /**
   * Check if column exists in table
   */
  protected hasColumn(columnName: string): boolean {
    return Object.keys(this.table).includes(columnName);
  }

  // Lifecycle hooks - can be overridden by subclasses

  /**
   * Called before a record is created
   */
  protected async beforeCreate(data: Record<string, unknown>): Promise<void> {}

  /**
   * Called after a record is created
   */
  protected async afterCreate(data: unknown): Promise<void> {}

  /**
   * Called before a record is updated
   */
  protected async beforeUpdate(data: Record<string, unknown>): Promise<void> {}

  /**
   * Called after a record is updated
   */
  protected async afterUpdate(data: unknown): Promise<void> {}

  /**
   * Called before a record is deleted
   */
  protected async beforeDelete(data: Record<string, unknown>): Promise<void> {}

  /**
   * Called after a record is deleted
   */
  protected async afterDelete(data: Record<string, unknown>): Promise<void> {}
}

// Re-export the factory creation function
export { createRepositoryFactory };
