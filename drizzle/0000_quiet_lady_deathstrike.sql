CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `blogs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`author_id` text NOT NULL,
	`cover_url` text,
	`tags` text,
	`complexity` text NOT NULL,
	`summary` text,
	`published_at` integer,
	`last_activity_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`bookmark_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_unique` ON `blogs` (`slug`);--> statement-breakpoint
CREATE TABLE `board_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`area` text NOT NULL,
	`skills` text,
	`waiting` integer DEFAULT 0 NOT NULL,
	`note` text,
	`hot` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`blog_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_user_blog_uq` ON `bookmarks` (`user_id`,`blog_id`);--> statement-breakpoint
CREATE TABLE `chapter_reviewers` (
	`chapter_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`handle` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`verdict` text,
	`verdict_at` integer,
	`online` integer DEFAULT false NOT NULL,
	`typing` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`chapter_id`, `revision_number`, `handle`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`summary` text,
	`blocks` text,
	`prev_blocks` text,
	`submitted_at` integer,
	`published_at` integer,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_revisions_chapter_number_uq` ON `chapter_revisions` (`chapter_id`,`number`);--> statement-breakpoint
CREATE TABLE `chapter_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_votes_user_chapter_uq` ON `chapter_votes` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`order` integer NOT NULL,
	`primary_handle` text,
	`skills` text,
	FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_blog_slug_uq` ON `chapters` (`blog_id`,`slug`);--> statement-breakpoint
CREATE TABLE `comment_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `public_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_votes_user_comment_uq` ON `comment_votes` (`user_id`,`comment_id`);--> statement-breakpoint
CREATE TABLE `donation_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`qr_url` text,
	`hint` text,
	`visible` integer DEFAULT true NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `author_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text,
	`is_admin_recipient` integer DEFAULT false NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`blocks` text,
	`is_visible` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolios_author_id_unique` ON `portfolios` (`author_id`);--> statement-breakpoint
CREATE TABLE `primary_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`from_handle` text NOT NULL,
	`to_handle` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promo_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`eyebrow` text,
	`title` text,
	`cta` text,
	`tone` text,
	`icon` text,
	`action` text,
	`target` text,
	`cover_url` text,
	`visible` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_slug` text NOT NULL,
	`chapter_slug` text NOT NULL,
	`revision` integer NOT NULL,
	`author_id` text,
	`parent_id` text,
	`text` text NOT NULL,
	`anchor` text,
	`edited_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `public_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recruit_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`by_handle` text NOT NULL,
	`skills` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`by_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `removed_reviewers` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_slug` text NOT NULL,
	`chapter_slug` text NOT NULL,
	`handle` text NOT NULL,
	`by_admin` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_chat` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`from_handle` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`items` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`revision` integer NOT NULL,
	`to_handle` text NOT NULL,
	`as_lead` integer DEFAULT false NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`flag_reason` text,
	`invited_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviewer_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`by_handle` text,
	`name` text,
	`area` text,
	`skills` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`by_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviewer_history` (
	`chapter_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`handle` text NOT NULL,
	PRIMARY KEY(`chapter_id`, `revision_number`, `handle`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviewer_ratings` (
	`chapter_id` text NOT NULL,
	`reviewer_handle` text NOT NULL,
	`by_handle` text NOT NULL,
	`stars` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`chapter_id`, `reviewer_handle`, `by_handle`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`by_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`from_handle` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`block_id` text NOT NULL,
	`anchor` text,
	`status` text DEFAULT 'open' NOT NULL,
	`from_handle` text NOT NULL,
	`text` text NOT NULL,
	`suggestion` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`avatar_url` text,
	`links` text,
	`slug` text NOT NULL,
	`is_blocked` integer DEFAULT false NOT NULL,
	`commenting_blocked` integer DEFAULT false NOT NULL,
	`competencies` text,
	`reviewer_rating` real,
	`reviewer_ratings_n` integer,
	`review_load` integer DEFAULT 0 NOT NULL,
	`review_capacity` integer DEFAULT 3 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_slug_unique` ON `users` (`slug`);