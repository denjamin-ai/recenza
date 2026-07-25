--> Фаза 15 — витрина «Выбор редакции» + оживление жалоб.
--> Только ADD COLUMN: ничего не дропается и не пересоздаётся, откат кода безопасен.
--> ⚠️ `reports.target_type` в схеме стал типизированным (`enum: REPORT_TARGET_TYPES`), но в SQLite
-->    это остаётся `text` — миграция таблицу НЕ пересоздаёт, существующие строки ('comment') валидны.
--> Бэкфилла нет: `featured_at` заполняет админ вручную, `resolved_at` у жалоб, закрытых до Ф15,
-->    остаётся NULL (дата закрытия неизвестна — врать датой создания нельзя).
ALTER TABLE `blogs` ADD `featured_at` integer;--> statement-breakpoint
ALTER TABLE `reports` ADD `note` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `about_handle` text REFERENCES users(handle);--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;
