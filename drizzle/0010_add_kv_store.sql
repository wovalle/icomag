-- Migration number: 0010 	 2025-05-13T06:31:47.708Z

CREATE TABLE `kv_store` (
    `key` text PRIMARY KEY NOT NULL,
    `value` text NOT NULL,
    `updated_at` integer NOT NULL
);