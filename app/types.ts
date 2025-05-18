import { type InferSelectModel } from "drizzle-orm";
import {
  attachments,
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
export type Tag = InferSelectModel<typeof transactionTags>;
export type TransactionToTag = InferSelectModel<typeof transactionToTags>;
export type Attachment = InferSelectModel<typeof attachments>;

// Additional types that might be useful
export interface TransactionWithDetails extends Transaction {
  owner?: Owner | null;
}
