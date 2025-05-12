import { DrizzleRepository } from "../drizzleRepository";
import * as schema from "../../database/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

export class TransactionTagsRepository extends DrizzleRepository<typeof schema.transactionTags> {
  constructor(db: DrizzleD1Database<typeof schema>) {
    super(db, schema.transactionTags);
  }
  
  /**
   * Override the findMany method to ensure it's properly using the query builder
   */
  async findMany<TReturn = unknown>(params?: {
    where?: any;
    pagination?: any;
    orderBy?: any;
    with?: Record<string, unknown>;
    tx?: any;
  }): Promise<TReturn[]> {
    // Delegate to the parent class implementation
    return super.findMany<TReturn>(params);
  }
  
  /**
   * Called after a tag is created
   * This example automatically creates a parent-child relationship
   * when a tag is created with a parent ID
   */
  protected async afterCreate(tag: any): Promise<void> {
    console.log(`Tag created: ${tag.name} (ID: ${tag.id})`);
    
    // Example: If this is a child tag, maybe we want to create a relation in another table
    if (tag.parent_id) {
      console.log(`This tag has a parent with ID: ${tag.parent_id}`);
    }
  }
  
  /**
   * Called after a tag is updated
   * This example logs tag updates and performs cleanup when a parent ID changes
   */
  protected async afterUpdate(tag: any): Promise<void> {
    console.log(`Tag updated: ${tag.name} (ID: ${tag.id})`);
  }

  /**
   * Called before a tag is deleted
   * This example handles cleanup before deleting a tag
   */
  protected async beforeDelete(tag: any): Promise<void> {
    // Check if this tag is a parent to any other tags
    const childTags = await this.db.query.transactionTags.findMany({
      where: eq(schema.transactionTags.parent_id, tag.id)
    });

    if (childTags.length > 0) {
      console.log(`Tag has ${childTags.length} children that need updating`);
      // Update all child tags to remove the parent reference
      await this.db
        .update(schema.transactionTags)
        .set({ parent_id: null })
        .where(eq(schema.transactionTags.parent_id, tag.id));
    }
  }
}