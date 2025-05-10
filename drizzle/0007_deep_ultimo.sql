PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transaction_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`parent_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `transaction_tags`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transaction_tags`("id", "name", "description", "color", "parent_id", "created_at", "updated_at") SELECT "id", "name", "description", "color", "parent_id", "created_at", "updated_at" FROM `transaction_tags`;--> statement-breakpoint
DROP TABLE `transaction_tags`;--> statement-breakpoint
ALTER TABLE `__new_transaction_tags` RENAME TO `transaction_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_tags_name_unique` ON `transaction_tags` (`name`);