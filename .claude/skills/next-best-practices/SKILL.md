---
name: next-best-practices
description: >
  Конвенции Next.js 16 (App Router) для монолита Recenza. Применяй при написании
  любого серверного/клиентского кода: async params, RSC-границы, route handlers,
  кэш, dynamic. Вызывается в Цикле качества каждой кодовой фазы.
---

# Next.js 16 — рабочие конвенции Recenza

## Async dynamic APIs (Next.js 16 — обязательно)
- `params` и `searchParams` — **Promise**. Всегда `const { id } = await params;`.
- `cookies()`, `headers()`, `draftMode()` — тоже асинхронны: `const c = await cookies();`.
- Страницы/лейауты с запросом к БД: `export const dynamic = "force-dynamic";` (иначе кэш отдаст устаревшее).

## RSC-границы
- По умолчанию всё — Server Component. `"use client"` — только там, где есть состояние/события/браузерные API.
- Данные тянем в серверных компонентах через Drizzle напрямую; клиенту отдаём пропсами, не дублируем фетч.
- Не импортируй серверный код (db, auth, секреты) в клиентские компоненты. Граница — явная.
- `Suspense` + streaming для тяжёлых секций; маленькие острова интерактива, не «всё клиентское».

## Route handlers (`src/app/api/.../route.ts`)
- Экспортируй `GET/POST/PUT/DELETE`. Возвращай `NextResponse.json(...)` с корректным статусом.
- Гейтинг — первой строкой: `await requireAdmin()` / `requireAuthor()` / `requireReviewer()`.
  Помни: `requireUser()` бросает `NextResponse` — в хендлере его нужно `return`, не глотать.
- Мутации — только same-origin (проверка `Origin`). Тело валидируй до записи (zod/ручная проверка).
- Никакого raw SQL — только Drizzle. JSON-поля парсь в `try/catch`.

## Метаданные и публичные страницы
- `generateMetadata()` на каждой публичной странице: уникальные `title`/`description`/OG/canonical из данных.
- `NEXT_PUBLIC_BASE_URL` — канонический хост для sitemap/RSS/JSON-LD.

## Прочее
- Path alias `@/* → src/*`. Общие типы — из `src/types/index.ts`.
- Timestamps — Unix seconds (`Math.floor(Date.now()/1000)`). ID — `ulid()`.
- Изображения — `next/image`; шрифты — `next/font` (Lora/Literata/Fira, subsets latin+cyrillic).
- Никаких hardcoded-цветов — только CSS-переменные из `DESIGN-TOKENS.md`.

## Чеклист перед закрытием
- [ ] `await params`/`await cookies()` везде, где нужно; нет синхронного доступа к dynamic API
- [ ] `force-dynamic` на страницах с БД; нет случайного статик-кэша на персональных данных
- [ ] Клиентских компонентов минимум; секреты/БД не утекли на клиент
- [ ] У каждого route handler — гейтинг первой строкой и same-origin на мутациях
- [ ] У публичных страниц — `generateMetadata`
