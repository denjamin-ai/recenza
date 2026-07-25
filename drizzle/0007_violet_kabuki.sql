ALTER TABLE `chapter_revisions` ADD `review_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_reviewer` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `can_author` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `introduced_by` text REFERENCES users(handle);--> statement-breakpoint
--> Фаза 13, бэкфилл (дописан вручную поверх drizzle-kit — прецедент 0006_brainy_sphinx.sql).
--> Только UPDATE: ничего не дропается, откат кода безопасен.
--> 1. Роль → возможности. Читатель остаётся с обеими false (базовый уровень).
UPDATE `users` SET `is_reviewer` = 1 WHERE `role` = 'reviewer';--> statement-breakpoint
UPDATE `users` SET `can_author` = 1 WHERE `role` = 'author';--> statement-breakpoint
--> 2. Разведение осей. Порядок важен: сначала под-статусы ревью уходят в review_status,
-->    и только потом status схлопывается в draft (иначе второй UPDATE не найдёт строки).
UPDATE `chapter_revisions` SET `review_status` = 'in-review',         `status` = 'draft' WHERE `status` = 'under-review';--> statement-breakpoint
UPDATE `chapter_revisions` SET `review_status` = 'changes-requested', `status` = 'draft' WHERE `status` = 'changes-requested';--> statement-breakpoint
--> 3. Опубликованное: 'reviewed' там, где есть кредит ревьюеров на ЭТУ ревизию, иначе 'none'.
UPDATE `chapter_revisions` SET `review_status` = 'reviewed'
  WHERE `status` = 'published'
    AND EXISTS (
      SELECT 1 FROM `reviewer_history` rh
       WHERE rh.`chapter_id` = `chapter_revisions`.`chapter_id`
         AND rh.`revision_number` = `chapter_revisions`.`number`
    );
