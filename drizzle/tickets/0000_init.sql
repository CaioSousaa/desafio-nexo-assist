CREATE TABLE `counters` (
	`kind` text PRIMARY KEY NOT NULL,
	`next_value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`ticket_number` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_number` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`ticket_number`) REFERENCES `tickets`(`number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_events_ticket_idx` ON `ticket_events` (`ticket_number`,`created_at`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`number` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`affected` text NOT NULL,
	`requester_email` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `tickets_requester_status_idx` ON `tickets` (`requester_email`,`status`);