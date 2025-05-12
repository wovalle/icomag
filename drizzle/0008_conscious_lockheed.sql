CREATE TABLE `tag_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` integer NOT NULL,
	`pattern` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `transaction_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
