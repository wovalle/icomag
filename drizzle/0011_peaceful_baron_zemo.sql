CREATE TABLE `attachments` (
    `id` integer PRIMARY KEY AUTOINCREMENT,
    `transaction_id` integer NOT NULL,
    `filename` text NOT NULL,
    `r2_key` text NOT NULL,
    `size` integer NOT NULL,
    `mime_type` text NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE cascade
);