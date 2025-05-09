DROP TABLE `bank_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`date` integer NOT NULL,
	`owner_id` integer,
	`reference` text,
	`category` text,
	`serial` text,
	`bank_description` text,
	`batch_id` integer,
	`is_duplicate` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`batch_id`) REFERENCES `transaction_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "amount", "description", "date", "owner_id", "reference", "category", "serial", "bank_description", "batch_id", "is_duplicate", "created_at", "updated_at") SELECT "id", "type", "amount", "description", "date", "owner_id", "reference", "category", "serial", "bank_description", "batch_id", "is_duplicate", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;