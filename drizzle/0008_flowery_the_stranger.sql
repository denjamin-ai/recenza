CREATE TABLE `expert_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`by_handle` text NOT NULL,
	`chapter_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`by_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expert_invites_token_unique` ON `expert_invites` (`token`);--> statement-breakpoint
CREATE TABLE `review_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`by_handle` text NOT NULL,
	`skills` text,
	`note` text,
	`channel` text DEFAULT 'queue' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claimed_by` text,
	`claimed_at` integer,
	`due_at` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`return_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`by_handle`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claimed_by`) REFERENCES `users`(`handle`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_requests_chapter_rev_active_uq` ON `review_requests` (`chapter_id`,`revision_number`) WHERE "review_requests"."status" in ('open','claimed');--> statement-breakpoint
ALTER TABLE `blogs` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `blogs` ADD `verified_tier` text;--> statement-breakpoint
ALTER TABLE `chapter_revisions` ADD `title` text;--> statement-breakpoint
ALTER TABLE `chapter_revisions` ADD `skills` text;--> statement-breakpoint
ALTER TABLE `chapter_revisions` ADD `review_closed_at` integer;--> statement-breakpoint
ALTER TABLE `chapter_revisions` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `chapter_revisions` ADD `verified_tier` text;--> statement-breakpoint
ALTER TABLE `reviewer_applications` ADD `invited_by` text REFERENCES users(handle);--> statement-breakpoint
ALTER TABLE `reviewer_applications` ADD `invite_token` text;--> statement-breakpoint
--> Фаза 14, бэкфилл (дописан вручную поверх drizzle-kit — прецедент 0006/0007).
--> Только UPDATE: ничего не дропается, откат кода безопасен (новые колонки просто перестанут читаться).
-->
--> 1. Версионирование метаданных главы. Исторических заголовков/навыков не существовало — переносим
-->    текущее значение во ВСЕ ревизии: единственное известное приближение, и оно совпадает с тем,
-->    что читатель видел до фазы. Дальше значения расходятся естественно (правка → новая ревизия).
UPDATE `chapter_revisions`
   SET `title` = (SELECT c.`title` FROM `chapters` c WHERE c.`id` = `chapter_revisions`.`chapter_id`)
 WHERE `title` IS NULL;--> statement-breakpoint
UPDATE `chapter_revisions`
   SET `skills` = (SELECT c.`skills` FROM `chapters` c WHERE c.`id` = `chapter_revisions`.`chapter_id`)
 WHERE `skills` IS NULL;--> statement-breakpoint
-->
--> 2. Закрытие исторических ревью-сессий. ДО Ф14 сессию закрывала публикация (`isReviewOpen`
-->    возвращал false для `published`), поэтому закрытыми считаются ВСЕ опубликованные ревизии.
-->    ⚠️ Без этого `closeReviewSession` счёл бы их открытыми и снял `review_load` ПОВТОРНО —
-->    публикация его уже сняла. Новая заявка на опубликованную ревизию сбрасывает токен в NULL явно.
UPDATE `chapter_revisions`
   SET `review_closed_at` = COALESCE(`published_at`, `submitted_at`, strftime('%s','now'))
 WHERE `status` = 'published' AND `review_closed_at` IS NULL;--> statement-breakpoint
-->
--> 3. Бейдж ревизии: он есть там, где ревизия опубликована И по ней есть кредит ревьюеров.
-->    Дата = дата публикации (момент одобрения в данных не хранится — вердикты истории не ведут).
UPDATE `chapter_revisions`
   SET `verified_at` = COALESCE(`published_at`, `submitted_at`),
       `verified_tier` = 'independent'
 WHERE `status` = 'published'
   AND `verified_at` IS NULL
   AND EXISTS (
     SELECT 1 FROM `reviewer_history` rh
      WHERE rh.`chapter_id` = `chapter_revisions`.`chapter_id`
        AND rh.`revision_number` = `chapter_revisions`.`number`
   );--> statement-breakpoint
--> 3b. Понижаем до 'invited' там, где ВСЕ кредитованные ревьюеры приглашены самим автором блога
-->     (`users.introduced_by` = handle автора). Хотя бы один независимый → уровень independent.
UPDATE `chapter_revisions`
   SET `verified_tier` = 'invited'
 WHERE `verified_at` IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM `reviewer_history` rh
       JOIN `users` ru ON ru.`handle` = rh.`handle`
       JOIN `chapters` c ON c.`id` = `chapter_revisions`.`chapter_id`
       JOIN `blogs` b ON b.`id` = c.`blog_id`
       JOIN `users` au ON au.`id` = b.`author_id`
      WHERE rh.`chapter_id` = `chapter_revisions`.`chapter_id`
        AND rh.`revision_number` = `chapter_revisions`.`number`
        AND (ru.`introduced_by` IS NULL OR ru.`introduced_by` <> au.`handle`)
   );--> statement-breakpoint
-->
--> 4. Денормализация на блог (по ней Ф15 фильтрует главную). Решение владельца: это ИСТОРИЧЕСКИЙ
-->    факт «блог проходил ревью» — агрегируем по ВСЕМ проверенным ревизиям, а не только по текущим,
-->    поэтому правка главы бейдж блога не гасит. Точная правда живёт на уровне главы.
UPDATE `blogs`
   SET `verified_at` = (
     SELECT MAX(cr.`verified_at`)
       FROM `chapter_revisions` cr
       JOIN `chapters` c ON c.`id` = cr.`chapter_id`
      WHERE c.`blog_id` = `blogs`.`id` AND cr.`verified_at` IS NOT NULL
   )
 WHERE EXISTS (
   SELECT 1 FROM `chapter_revisions` cr
     JOIN `chapters` c ON c.`id` = cr.`chapter_id`
    WHERE c.`blog_id` = `blogs`.`id` AND cr.`verified_at` IS NOT NULL
 );--> statement-breakpoint
UPDATE `blogs`
   SET `verified_tier` = CASE WHEN EXISTS (
     SELECT 1 FROM `chapter_revisions` cr
       JOIN `chapters` c ON c.`id` = cr.`chapter_id`
      WHERE c.`blog_id` = `blogs`.`id` AND cr.`verified_tier` = 'independent'
   ) THEN 'independent' ELSE 'invited' END
 WHERE `verified_at` IS NOT NULL;