CREATE TABLE `transaction_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`processed_at` integer NOT NULL,
	`total_transactions` integer NOT NULL,
	`new_transactions` integer NOT NULL,
	`duplicated_transactions` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `serial` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `bank_description` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `batch_id` integer REFERENCES transaction_batches(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `is_duplicate` integer DEFAULT 0;