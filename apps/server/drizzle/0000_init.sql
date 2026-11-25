CREATE TABLE `animal_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`animal_id` text NOT NULL,
	`type` text NOT NULL,
	`code` text NOT NULL,
	`attached_at` integer NOT NULL,
	`removed_at` integer,
	`removal_reason` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "animal_tags_type_check" CHECK("animal_tags"."type" IN ('qr', 'eartag')),
	CONSTRAINT "animal_tags_removal_reason_check" CHECK("animal_tags"."removal_reason" IN ('lost', 'damaged', 'replaced', 'other')),
	CONSTRAINT "animal_tags_removed_check" CHECK(("animal_tags"."removed_at" IS NULL) = ("animal_tags"."removal_reason" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `animal_tags_type_code_unique` ON `animal_tags` (`type`,`code`);--> statement-breakpoint
CREATE INDEX `animal_tags_animal_idx` ON `animal_tags` (`animal_id`);--> statement-breakpoint
CREATE INDEX `animal_tags_updated_at_idx` ON `animal_tags` (`updated_at`);--> statement-breakpoint
CREATE TABLE `animals` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`farmer_id` text NOT NULL,
	`dam_id` text,
	`name` text,
	`sex` text NOT NULL,
	`breed` text,
	`birth_date` text,
	`sire_code` text,
	`isikhnas_animal_id` text,
	FOREIGN KEY (`farmer_id`) REFERENCES `farmers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dam_id`) REFERENCES `animals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "animals_sex_check" CHECK("animals"."sex" IN ('F', 'M'))
);
--> statement-breakpoint
CREATE INDEX `animals_farmer_idx` ON `animals` (`farmer_id`);--> statement-breakpoint
CREATE INDEX `animals_dam_idx` ON `animals` (`dam_id`);--> statement-breakpoint
CREATE INDEX `animals_updated_at_idx` ON `animals` (`updated_at`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`service_request_id` text NOT NULL,
	`inseminator_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`accepted_at` integer,
	`ended_at` integer,
	`end_reason` text,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inseminator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assignments_end_reason_check" CHECK("assignments"."end_reason" IN ('completed', 'reassigned', 'declined', 'cancelled')),
	CONSTRAINT "assignments_ended_check" CHECK(("assignments"."ended_at" IS NULL) = ("assignments"."end_reason" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `assignments_request_idx` ON `assignments` (`service_request_id`);--> statement-breakpoint
CREATE INDEX `assignments_inseminator_idx` ON `assignments` (`inseminator_id`);--> statement-breakpoint
CREATE INDEX `assignments_updated_at_idx` ON `assignments` (`updated_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`actor_id` text,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_logs_action_check" CHECK("audit_logs"."action" IN ('insert', 'update', 'delete', 'conflict'))
);
--> statement-breakpoint
CREATE INDEX `audit_logs_row_idx` ON `audit_logs` (`table_name`,`row_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_updated_at_idx` ON `audit_logs` (`updated_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`animal_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`payload` text NOT NULL,
	`service_request_id` text,
	`semen_stock_id` text,
	`voids_event_id` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semen_stock_id`) REFERENCES `semen_stock`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voids_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_type_check" CHECK("events"."type" IN ('BH', 'IB', 'PKB', 'KGG', 'LH', 'BB', 'HEALTH', 'EXIT')),
	CONSTRAINT "events_payload_json_check" CHECK(json_valid("events"."payload")),
	CONSTRAINT "events_semen_ib_check" CHECK("events"."semen_stock_id" IS NULL OR "events"."type" = 'IB')
);
--> statement-breakpoint
CREATE INDEX `events_animal_occurred_idx` ON `events` (`animal_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_voids_idx` ON `events` (`voids_event_id`);--> statement-breakpoint
CREATE INDEX `events_updated_at_idx` ON `events` (`updated_at`);--> statement-breakpoint
CREATE TABLE `farmers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`user_id` text,
	`location_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`isikhnas_owner_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farmers_user_unique` ON `farmers` (`user_id`);--> statement-breakpoint
CREATE INDEX `farmers_location_idx` ON `farmers` (`location_id`);--> statement-breakpoint
CREATE INDEX `farmers_updated_at_idx` ON `farmers` (`updated_at`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`name` text NOT NULL,
	`code` text,
	FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "locations_level_check" CHECK("locations"."level" IN ('agency', 'group', 'village'))
);
--> statement-breakpoint
CREATE INDEX `locations_parent_idx` ON `locations` (`parent_id`);--> statement-breakpoint
CREATE INDEX `locations_updated_at_idx` ON `locations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `semen_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`holder_id` text NOT NULL,
	`straw_code` text NOT NULL,
	`bull_id` text NOT NULL,
	`bull_name` text,
	`breed` text,
	`batch` text NOT NULL,
	`quantity_received` integer NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`holder_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "semen_stock_quantity_check" CHECK("semen_stock"."quantity_received" > 0)
);
--> statement-breakpoint
CREATE INDEX `semen_stock_holder_idx` ON `semen_stock` (`holder_id`);--> statement-breakpoint
CREATE INDEX `semen_stock_updated_at_idx` ON `semen_stock` (`updated_at`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`farmer_id` text NOT NULL,
	`animal_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`preferred_date` text,
	`notes` text,
	`rejection_reason` text,
	`result_event_id` text,
	FOREIGN KEY (`farmer_id`) REFERENCES `farmers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`animal_id`) REFERENCES `animals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`result_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_requests_type_check" CHECK("service_requests"."type" IN ('IB', 'PKB')),
	CONSTRAINT "service_requests_status_check" CHECK("service_requests"."status" IN ('submitted', 'assigned', 'in_progress', 'done', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);--> statement-breakpoint
CREATE INDEX `service_requests_animal_idx` ON `service_requests` (`animal_id`);--> statement-breakpoint
CREATE INDEX `service_requests_updated_at_idx` ON `service_requests` (`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`password_hash` text,
	`role` text NOT NULL,
	`location_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('farmer', 'inseminator', 'group_admin', 'agency_admin')),
	CONSTRAINT "users_contact_check" CHECK("users"."email" IS NOT NULL OR "users"."phone" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `users_updated_at_idx` ON `users` (`updated_at`);