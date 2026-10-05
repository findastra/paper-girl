CREATE TABLE `articles` (
	`pmcid` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`journal` text NOT NULL,
	`published` text NOT NULL,
	`year` integer NOT NULL,
	`search_text` text NOT NULL,
	`metadata` text NOT NULL,
	`paper` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`checked_at` integer,
	`indexed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_articles_published` ON `articles` (`published`);--> statement-breakpoint
CREATE INDEX `idx_articles_state` ON `articles` (`state`);--> statement-breakpoint
CREATE TABLE `index_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`cursor` text DEFAULT '*' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`scanned` integer DEFAULT 0 NOT NULL,
	`complete` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`reader` text NOT NULL,
	`filters` text NOT NULL,
	`pmcid` text,
	`outcome` text NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pmcid`) REFERENCES `articles`(`pmcid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_searches_created` ON `searches` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_searches_reader` ON `searches` (`reader`,`created_at`);--> statement-breakpoint
CREATE TABLE `visits` (
	`reader` text NOT NULL,
	`pmcid` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`reader`, `pmcid`)
);
