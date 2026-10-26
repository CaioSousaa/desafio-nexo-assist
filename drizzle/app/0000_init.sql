CREATE TABLE `agent_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text NOT NULL,
	`understanding` text NOT NULL,
	`action` text NOT NULL,
	`confidence` integer NOT NULL,
	`rationale` text NOT NULL,
	`rules` text NOT NULL,
	`steps` text NOT NULL,
	`usage` text,
	`model` text,
	`source` text DEFAULT 'modelo' NOT NULL,
	`duration_ms` integer,
	`first_signal_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_decisions_message_idx` ON `agent_decisions` (`message_id`);--> statement-breakpoint
CREATE TABLE `conversation_reads` (
	`conversation_id` text NOT NULL,
	`analyst_id` text NOT NULL,
	`last_read_at` text NOT NULL,
	PRIMARY KEY(`conversation_id`, `analyst_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyst_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`state` text NOT NULL,
	`outcome` text,
	`assigned_analyst_id` text,
	`transfer_reason` text,
	`transfer_confidence` integer,
	`transfer_summary` text,
	`transferred_at` text,
	`agent_message_count` integer DEFAULT 0 NOT NULL,
	`limit_reached` integer DEFAULT false NOT NULL,
	`inherited_summary` text,
	`previous_conversation_id` text,
	`pending_transfer` integer DEFAULT false NOT NULL,
	`focus_ticket` text,
	`related_tickets` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_analyst_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversations_employee_state_idx` ON `conversations` (`employee_id`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_one_open_per_employee` ON `conversations` (`employee_id`) WHERE state != 'encerrada';--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`display_code` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`transfer_after_decision` integer DEFAULT false NOT NULL,
	`resulting_ticket` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_display_code_unique` ON `drafts` (`display_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_one_pending_per_conversation` ON `drafts` (`conversation_id`) WHERE status = 'aguardando_confirmacao';--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_type` text NOT NULL,
	`author_id` text,
	`text` text DEFAULT '' NOT NULL,
	`parts` text,
	`event_type` text,
	`decision_id` text,
	`client_message_id` text,
	`status` text,
	`counts_toward_limit` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_conversation_client_id` ON `messages` (`conversation_id`,`client_message_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`department` text,
	`device_model` text,
	`device_os` text,
	`analyst_level` text,
	`password_changed_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);