CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`code` text NOT NULL,
	`issued_by` text NOT NULL,
	FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_codes_code_unique` ON `qr_codes` (`code`);--> statement-breakpoint
CREATE INDEX `qr_codes_issued_by_idx` ON `qr_codes` (`issued_by`);--> statement-breakpoint
CREATE INDEX `qr_codes_updated_at_idx` ON `qr_codes` (`updated_at`);--> statement-breakpoint
-- Kode QR yang sudah terpasang sebelum migrasi ini ikut masuk daftar kode.
INSERT INTO `qr_codes` (`id`, `created_at`, `updated_at`, `deleted_at`, `device_id`, `code`, `issued_by`)
SELECT t.`id`, t.`attached_at`, t.`attached_at`, NULL, t.`device_id`, t.`code`,
  (SELECT u.`id` FROM `users` u ORDER BY (u.`role` = 'agency_admin') DESC, u.`created_at` LIMIT 1)
FROM `animal_tags` t
WHERE t.`type` = 'qr' AND EXISTS (SELECT 1 FROM `users`);
