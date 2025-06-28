CREATE TABLE `lpg_refill_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`refill_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`previous_reading` real NOT NULL,
	`current_reading` real NOT NULL,
	`consumption` real NOT NULL,
	`percentage` real NOT NULL,
	`subtotal` real NOT NULL,
	`total_amount` real NOT NULL,
	`tag_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`refill_id`) REFERENCES `lpg_refills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `transaction_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lpg_refills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_amount` real NOT NULL,
	`gallons_refilled` real NOT NULL,
	`refill_date` integer NOT NULL,
	`efficiency_percentage` real DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer,
	`refill_id` integer,
	`refill_entry_id` integer,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refill_id`) REFERENCES `lpg_refills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refill_entry_id`) REFERENCES `lpg_refill_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "transaction_id", "refill_id", "refill_entry_id", "filename", "r2_key", "size", "mime_type", "created_at", "updated_at") SELECT "id", "transaction_id", NULL, NULL, "filename", "r2_key", "size", "mime_type", "created_at", "updated_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;