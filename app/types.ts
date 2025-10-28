import { type InferSelectModel } from "drizzle-orm";
import {
  attachments,
  lpgRefillEntries,
  lpgRefills,
  owners,
  transactions,
  transactionTags,
  transactionToTags,
} from "../database/schema";

// Export core types based on the schema
export type Owner = InferSelectModel<typeof owners>;
export type Transaction = InferSelectModel<typeof transactions> & {
  tags: Tag[]; // Transactions include their related tags
  attachments?: Attachment[]; // Transactions include their related attachments
};
export type Tag = InferSelectModel<typeof transactionTags> & {
  month_year?: number | null; // YYYYMM format for monthly-payment tags
};
export type TransactionToTag = InferSelectModel<typeof transactionToTags>;
export type Attachment = InferSelectModel<typeof attachments>;

// LPG refill types
export type LpgRefill = InferSelectModel<typeof lpgRefills>;
export type LpgRefillEntry = InferSelectModel<typeof lpgRefillEntries>;

// Additional types that might be useful
export interface TransactionWithDetails extends Transaction {
  owner?: Owner | null;
  tags: Tag[]; // Transactions include their related tags
  attachments?: Attachment[]; // Transactions include their related attachments
}

export interface LpgRefillWithDetails extends LpgRefill {
  entries: LpgRefillEntryWithDetails[];
  attachments?: Attachment[];
  tag?: Tag;
}

export interface LpgRefillEntryWithDetails extends LpgRefillEntry {
  owner: Owner;
  attachments?: Attachment[];
}
