CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "feedback_topic_check" CHECK("feedback"."topic" IN ('general', 'record', 'animals', 'tasks', 'scan', 'sync', 'other')),
	CONSTRAINT "feedback_rating_check" CHECK("feedback"."rating" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE INDEX `feedback_user_idx` ON `feedback` (`user_id`);--> statement-breakpoint
CREATE INDEX `feedback_updated_at_idx` ON `feedback` (`updated_at`);--> statement-breakpoint
CREATE TABLE `system_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_changes` (
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
	CONSTRAINT "sync_changes_kind_check" CHECK("__new_sync_changes"."kind" IN ('farmer.create', 'farmer.update', 'animal.create', 'animal.update', 'event.create', 'serviceRequest.create', 'serviceRequest.accept', 'serviceRequest.assign', 'serviceRequest.reassign', 'serviceRequest.reject', 'qrCode.reserve', 'tag.attach', 'tag.remove', 'syncReview.discard', 'feedback.create')),
	CONSTRAINT "sync_changes_result_check" CHECK("__new_sync_changes"."result" IN ('applied', 'merged', 'needs_review', 'rejected')),
	CONSTRAINT "sync_changes_resolution_check" CHECK("__new_sync_changes"."resolution" IN ('resent', 'discarded'))
);
--> statement-breakpoint
INSERT INTO `__new_sync_changes`("id", "created_at", "updated_at", "deleted_at", "device_id", "user_id", "kind", "row_id", "animal_id", "result", "code", "message", "payload", "resolved_at", "resolution") SELECT "id", "created_at", "updated_at", "deleted_at", "device_id", "user_id", "kind", "row_id", "animal_id", "result", "code", "message", "payload", "resolved_at", "resolution" FROM `sync_changes`;--> statement-breakpoint
DROP TABLE `sync_changes`;--> statement-breakpoint
ALTER TABLE `__new_sync_changes` RENAME TO `sync_changes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sync_changes_user_idx` ON `sync_changes` (`user_id`);--> statement-breakpoint
CREATE INDEX `sync_changes_review_idx` ON `sync_changes` (`result`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `sync_changes_row_idx` ON `sync_changes` (`row_id`);--> statement-breakpoint
CREATE INDEX `sync_changes_updated_at_idx` ON `sync_changes` (`updated_at`);