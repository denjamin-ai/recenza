---
description: Конвенции Next.js 16 App Router.
globs:
  - "src/app/**"
---

# Правило: Next.js 16 App Router

- Динамические `params` — `Promise`: `const { id } = await params`. Аналогично `searchParams`.
- Страницы с запросом к БД: `export const dynamic = "force-dynamic"`.
- Route-группы по ролям: `app/admin/(protected)/`, `app/author/(protected)/`,
  `app/reviewer/(protected)/`, `app/(reader)/`, публичный сегмент. Layout группы вызывает свой `require*`.
- Серверные компоненты по умолчанию; `"use client"` только там, где нужен интерактив/хуки/браузерные API.
- Не тащить серверные секреты в клиентские компоненты. Данные грузить в RSC, передавать пропсами.
- Метаданные — `generateMetadata()` / `metadata`. Шаблон title: `"%s | Recenza"`. У статей — OG + canonical.
- API-роуты в `src/app/api/`. Все мутации — проверка same-origin; ролевой гейтинг (`require*`) первой строкой.
- `loading.tsx`/`error.tsx` для тяжёлых сегментов. Никаких клиентских редиректов вместо серверного гейтинга.
