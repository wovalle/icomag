PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_lpg_refill_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`refill_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`previous_reading` real NOT NULL,
	`current_reading` real NOT NULL,
	`consumption` real NOT NULL,
	`percentage` real NOT NULL,
	`subtotal` real NOT NULL,
	`total_amount` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`refill_id`) REFERENCES `lpg_refills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_lpg_refill_entries`("id", "refill_id", "owner_id", "previous_reading", "current_reading", "consumption", "percentage", "subtotal", "total_amount", "created_at", "updated_at") SELECT "id", "refill_id", "owner_id", "previous_reading", "current_reading", "consumption", "percentage", "subtotal", "total_amount", "created_at", "updated_at" FROM `lpg_refill_entries`;--> statement-breakpoint
DROP TABLE `lpg_refill_entries`;--> statement-breakpoint
ALTER TABLE `__new_lpg_refill_entries` RENAME TO `lpg_refill_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `lpg_refills` ADD `tag_id` integer REFERENCES transaction_tags(id);