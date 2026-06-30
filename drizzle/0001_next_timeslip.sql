--> ON DELETE SET NULL добавлен вручную: drizzle-kit опускает onDelete для ADD COLUMN в SQLite
--> (snapshot уже фиксирует set null — дрейфа на следующем generate нет). Колонка nullable, default NULL.
ALTER TABLE `users` ADD `pinned_blog_id` text REFERENCES blogs(id) ON DELETE SET NULL;