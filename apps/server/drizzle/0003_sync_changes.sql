CREATE TABLE `field_versions` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`field` text NOT NULL,
	`changed_at` integer NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`, `field`)
);
--> statement-breakpoint
CREATE TABLE `sync_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`row_id` text,
	`animal_id` text,
	`result` text NOT NULL,
	`code` text,
	`message` text,
	`payload` text,
	`resolved_at` integer,
	`resolution` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sync_changes_kind_check" CHECK("sync_changes"."kind" IN ('farmer.create', 'farmer.update', 'animal.create', 'animal.update', 'event.create', 'serviceRequest.create', 'serviceRequest.accept', 'serviceRequest.assign', 'serviceRequest.reassign', 'serviceRequest.reject', 'qrCode.reserve', 'tag.attach', 'tag.remove', 'syncReview.discard')),
	CONSTRAINT "sync_changes_result_check" CHECK("sync_changes"."result" IN ('applied', 'merged', 'needs_review', 'rejected')),
	CONSTRAINT "sync_changes_resolution_check" CHECK("sync_changes"."resolution" IN ('resent', 'discarded'))
);
--> statement-breakpoint
CREATE INDEX `sync_changes_user_idx` ON `sync_changes` (`user_id`);--> statement-breakpoint
CREATE INDEX `sync_changes_review_idx` ON `sync_changes` (`result`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `sync_changes_row_idx` ON `sync_changes` (`row_id`);--> statement-breakpoint
CREATE INDEX `sync_changes_updated_at_idx` ON `sync_changes` (`updated_at`);