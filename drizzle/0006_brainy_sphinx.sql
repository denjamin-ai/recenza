-- ui-feedback-5 (П1): голоса переезжают с глав на блоги (модель прототипа).
-- 1) новая таблица blog_votes; 2) data-миграция: голос пользователя за блог = знак суммы его
-- голосов по главам блога (нулевые суммы отбрасываются). chapter_votes НЕ дропается (deprecated;
-- деструктивные миграции запрещены), новые записи в неё не пишутся.
CREATE TABLE `blog_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`blog_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blog_id`) REFERENCES `blogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_votes_user_blog_uq` ON `blog_votes` (`user_id`,`blog_id`);--> statement-breakpoint
INSERT INTO `blog_votes` (`id`, `user_id`, `blog_id`, `value`, `created_at`)
SELECT
	'bvm_' || cv.`user_id` || '_' || c.`blog_id`,
	cv.`user_id`,
	c.`blog_id`,
	CASE WHEN SUM(cv.`value`) > 0 THEN 1 ELSE -1 END,
	MIN(cv.`created_at`)
FROM `chapter_votes` cv
JOIN `chapters` c ON c.`id` = cv.`chapter_id`
GROUP BY cv.`user_id`, c.`blog_id`
HAVING SUM(cv.`value`) != 0;
