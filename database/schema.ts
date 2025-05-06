import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const guestBook = sqliteTable("guest_book", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
});

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

// Bank accounts table to track owners' bank accounts
export const bankAccounts = sqliteTable("bank_accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  owner_id: integer()
    .references(() => owners.id, { onDelete: "cascade" })
    .notNull(),
  account_number: text().notNull(),
  bank_name: text(),
  description: text(),
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

// Transactions table to track all financial transactions
export const transactions = sqliteTable("transactions", {
  id: integer().primaryKey({ autoIncrement: true }),
  type: text().notNull(), // 'debit' (money in) or 'credit' (money out)
  amount: real().notNull(),
  description: text(),
  date: integer().notNull(), // Unix timestamp
  owner_id: integer().references(() => owners.id, { onDelete: "set null" }),
  bank_account_id: integer().references(() => bankAccounts.id, {
    onDelete: "set null",
  }),
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
export const transactionTags = sqliteTable("transaction_tags", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  description: text(),
  color: text(), // Optional color for UI display
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

// Define relations for owners
export const ownersRelations = relations(owners, ({ many }) => ({
  bankAccounts: many(bankAccounts),
  transactions: many(transactions),
}));

// Define relations for bank accounts
export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  owner: one(owners, {
    fields: [bankAccounts.owner_id],
    references: [owners.id],
  }),
}));

// Define relations for transactions
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  owner: one(owners, {
    fields: [transactions.owner_id],
    references: [owners.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [transactions.bank_account_id],
    references: [bankAccounts.id],
  }),
  batch: one(transactionBatches, {
    fields: [transactions.batch_id],
    references: [transactionBatches.id],
  }),
  tags: many(transactionToTags),
}));

// Define relations for transaction batches
export const transactionBatchesRelations = relations(transactionBatches, ({ many }) => ({
  transactions: many(transactions),
}));

// Define relations for transaction tags
export const transactionTagsRelations = relations(transactionTags, ({ many }) => ({
  transactionToTags: many(transactionToTags),
}));

// Define relations for the many-to-many join table
export const transactionToTagsRelations = relations(transactionToTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionToTags.transaction_id],
    references: [transactions.id],
  }),
  tag: one(transactionTags, {
    fields: [transactionToTags.tag_id],
    references: [transactionTags.id],
  }),
}));
