import { relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export { account, session, user, verification } from "./auth-schema";

// Owners table to track all apartment owners
export const owners = sqliteTable("owners", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text(),
  phone: text(),
  apartment_id: text().notNull().unique(), // Unique apartment ID as a string
  is_active: integer().default(1), // 1 for active, 0 for inactive
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Owner recognition patterns table to identify transactions
export const ownerPatterns = sqliteTable("owner_patterns", {
  id: integer().primaryKey({ autoIncrement: true }),
  owner_id: integer()
    .references(() => owners.id, { onDelete: "cascade" })
    .notNull(),
  pattern: text().notNull(), // Regex pattern string
  description: text(), // Description of what this pattern matches
  is_active: integer().default(1), // 1 for active, 0 for inactive
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Transaction batches table to track imported files
export const transactionBatches = sqliteTable("transaction_batches", {
  id: integer().primaryKey({ autoIncrement: true }),
  filename: text().notNull(), // Stored filename (could be sanitized/unique)
  original_filename: text().notNull(), // Original filename uploaded by user
  processed_at: integer().notNull(), // When the batch was processed
  total_transactions: integer().notNull(), // Total transactions in batch
  new_transactions: integer().notNull(), // Number of new transactions
  duplicated_transactions: integer().notNull(), // Number of duplicated transactions
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// LPG refills table to track LPG tank refills
export const lpgRefills = sqliteTable("lpg_refills", {
  id: integer().primaryKey({ autoIncrement: true }),
  bill_amount: real().notNull(), // Total amount of the LPG bill
  gallons_refilled: real().notNull(), // Number of gallons refilled
  refill_date: integer().notNull(), // Unix timestamp of refill date
  efficiency_percentage: real().default(0), // Extra percentage for inefficiencies
  tag_id: integer().references(() => transactionTags.id), // Tag for relating to transactions
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// LPG refill entries table to track per-apartment consumption
export const lpgRefillEntries = sqliteTable("lpg_refill_entries", {
  id: integer().primaryKey({ autoIncrement: true }),
  refill_id: integer()
    .references(() => lpgRefills.id, { onDelete: "cascade" })
    .notNull(),
  owner_id: integer()
    .references(() => owners.id, { onDelete: "cascade" })
    .notNull(),
  previous_reading: real().notNull(), // Previous meter reading
  current_reading: real().notNull(), // Current meter reading
  consumption: real().notNull(), // Difference (current - previous)
  percentage: real().notNull(), // Percentage of total consumption
  subtotal: real().notNull(), // Base amount to pay
  total_amount: real().notNull(), // Final amount including inefficiencies
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Attachments table to store file information
export const attachments = sqliteTable("attachments", {
  id: integer().primaryKey({ autoIncrement: true }),
  transaction_id: integer().references(() => transactions.id, {
    onDelete: "cascade",
  }),
  refill_id: integer().references(() => lpgRefills.id, { onDelete: "cascade" }),
  refill_entry_id: integer().references(() => lpgRefillEntries.id, {
    onDelete: "cascade",
  }),
  filename: text().notNull(), // Original filename
  r2_key: text().notNull(), // Key in R2 bucket
  size: integer().notNull(), // File size in bytes
  mime_type: text().notNull(), // MIME type of the file
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Transactions table to track all financial transactions
export const transactions = sqliteTable("transactions", {
  id: integer().primaryKey({ autoIncrement: true }),
  type: text().notNull(), // 'debit' (money in) or 'credit' (money out)
  amount: real().notNull(),
  description: text(),
  date: integer().notNull(), // Unix timestamp
  owner_id: integer().references(() => owners.id, { onDelete: "set null" }),
  reference: text(), // Bank reference number
  category: text(), // For categorizing expenses/income
  serial: text(), // Bank serial number from CSV
  bank_description: text(), // Original description from the bank
  batch_id: integer().references(() => transactionBatches.id), // Link to the batch this transaction came from
  is_duplicate: integer().default(0), // 0 = new transaction, 1 = duplicate transaction
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Transaction tags table
export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull().unique(),
    description: text(),
    color: text(), // Optional color for UI display
    parent_id: integer(), // Parent tag reference
    created_at: integer()
      .notNull()
      .$defaultFn(() => Math.floor(Date.now() / 1000)),
    updated_at: integer()
      .notNull()
      .$defaultFn(() => Math.floor(Date.now() / 1000)),
  },
  (table) => {
    return {
      // Define a foreign key constraint for th e parent_id
      parentTag: foreignKey({
        columns: [table.parent_id],
        foreignColumns: [table.id],
        name: "transaction_tags_parent_id_fk",
      }).onDelete("set null"),
    };
  }
);

// Tag recognition patterns table to identify transactions
export const tagPatterns = sqliteTable("tag_patterns", {
  id: integer().primaryKey({ autoIncrement: true }),
  tag_id: integer()
    .references(() => transactionTags.id, { onDelete: "cascade" })
    .notNull(),
  pattern: text().notNull(), // Regex pattern string
  description: text(), // Description of what this pattern matches
  is_active: integer().default(1), // 1 for active, 0 for inactive
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Transaction to Tags many-to-many relationship table
export const transactionToTags = sqliteTable("transaction_to_tags", {
  id: integer().primaryKey({ autoIncrement: true }),
  transaction_id: integer()
    .references(() => transactions.id, { onDelete: "cascade" })
    .notNull(),
  tag_id: integer()
    .references(() => transactionTags.id, { onDelete: "cascade" })
    .notNull(),
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// KV table to store configuration and settings
export const kvStore = sqliteTable("kv_store", {
  key: text().primaryKey().notNull(),
  value: text().notNull(),
  updated_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Audit logs table to track all system events and entity changes
export const auditLogs = sqliteTable("audit_logs", {
  id: integer().primaryKey({ autoIncrement: true }),
  event_type: text().notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'SIGN_IN', 'SIGN_OUT', etc.
  entity_type: text().notNull(), // 'OWNER', 'TRANSACTION', 'TAG', 'SYSTEM', etc.
  entity_id: text(), // ID of the affected entity (if applicable)
  user_id: text().references(() => user.id), // User who performed the action
  user_email: text(), // Email of the user (for quick reference)
  details: text(), // JSON string with additional details (old/new values, etc.)
  ip_address: text(), // IP address of the request
  user_agent: text(), // User agent of the request
  is_system_event: integer().default(0), // 1 for system events (login/logout), 0 for entity changes
  created_at: integer()
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Define relations for owners
export const ownersRelations = relations(owners, ({ many }) => ({
  transactions: many(transactions),
  recognitionPatterns: many(ownerPatterns),
  lpgRefillEntries: many(lpgRefillEntries),
}));

// Define relations for owner patterns
export const ownerPatternsRelations = relations(ownerPatterns, ({ one }) => ({
  owner: one(owners, {
    fields: [ownerPatterns.owner_id],
    references: [owners.id],
  }),
}));

// Define relations for transactions
export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    owner: one(owners, {
      fields: [transactions.owner_id],
      references: [owners.id],
    }),
    batch: one(transactionBatches, {
      fields: [transactions.batch_id],
      references: [transactionBatches.id],
    }),
    tags: many(transactionToTags),
    attachments: many(attachments),
  })
);

// Define relations for attachments
export const attachmentsRelations = relations(attachments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [attachments.transaction_id],
    references: [transactions.id],
  }),
  refill: one(lpgRefills, {
    fields: [attachments.refill_id],
    references: [lpgRefills.id],
  }),
  refillEntry: one(lpgRefillEntries, {
    fields: [attachments.refill_entry_id],
    references: [lpgRefillEntries.id],
  }),
}));

// Define relations for transaction batches
export const transactionBatchesRelations = relations(
  transactionBatches,
  ({ many }) => ({
    transactions: many(transactions),
  })
);

// Define relations for transaction tags
export const transactionTagsRelations = relations(
  transactionTags,
  ({ many, one }) => ({
    transactionToTags: many(transactionToTags),
    childTags: many(transactionTags, { relationName: "parentChildTags" }),
    parentTag: one(transactionTags, {
      fields: [transactionTags.parent_id],
      references: [transactionTags.id],
      relationName: "parentChildTags",
    }),
    recognitionPatterns: many(tagPatterns),
  })
);

// Define relations for the many-to-many join table
export const transactionToTagsRelations = relations(
  transactionToTags,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionToTags.transaction_id],
      references: [transactions.id],
    }),
    tag: one(transactionTags, {
      fields: [transactionToTags.tag_id],
      references: [transactionTags.id],
    }),
  })
);

// Define relations for tag patterns
export const tagPatternsRelations = relations(tagPatterns, ({ one }) => ({
  tag: one(transactionTags, {
    fields: [tagPatterns.tag_id],
    references: [transactionTags.id],
  }),
}));

// Define relations for audit logs
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.user_id],
    references: [user.id],
  }),
}));

// Define relations for LPG refills
export const lpgRefillsRelations = relations(lpgRefills, ({ one, many }) => ({
  entries: many(lpgRefillEntries),
  attachments: many(attachments),
  tag: one(transactionTags, {
    fields: [lpgRefills.tag_id],
    references: [transactionTags.id],
  }),
}));

// Define relations for LPG refill entries
export const lpgRefillEntriesRelations = relations(
  lpgRefillEntries,
  ({ one, many }) => ({
    refill: one(lpgRefills, {
      fields: [lpgRefillEntries.refill_id],
      references: [lpgRefills.id],
    }),
    owner: one(owners, {
      fields: [lpgRefillEntries.owner_id],
      references: [owners.id],
    }),
    attachments: many(attachments),
  })
);
