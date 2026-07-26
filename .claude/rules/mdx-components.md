---
description: Конвенции MDX и блочного контента (рендер главы/ревью).
globs:
  - "src/components/mdx/**"
  - "src/lib/mdx.ts"
  - "src/components/editor/**"
---

# Правило: MDX и блоки

- Типы блоков: `p, h2, h3, quote, list (bullet/numbered/todo), code, callout (note/warning/info),
  mermaid, image, table, embed`. **Рендер идентичен в ридере и в ревью** (один компонент-рендерер).
- ⚠️ **MDX-конвейера в проекте НЕТ** (проверено аудитом ИБ 2026-07-26; `next-mdx-remote` и
  `rehype-pretty-code` были объявлены в `package.json` без единой ссылки в `src/` — удалены).
  Блоки — структурный JSON, рендерятся в React-узлы (`src/components/blocks/block-renderer.tsx`),
  текст экранируется React автоматически. Это безопаснее MDX — возвращать MDX не нужно.
- ⚠️ Функции **`stripDangerousHtml()` не существует** и она не требуется: HTML из пользовательского
  текста не собирается вовсе. Не ссылаться на неё и не «восстанавливать».
- Код: подсветка `shiki` напрямую в RSC (dual theme `github-dark`/`github-light`) + кнопка копирования.
  Mermaid — клиентский ленивый компонент, тема-aware, `securityLevel:"strict"`.
  LaTeX — `katex` в RSC: блок `latex` и инлайн `$...$` (`trust:false`, `throwOnError:true`).
  Изображения — `next/image` + `alt`, src только `/uploads/`.
- Единственные разрешённые `dangerouslySetInnerHTML` — вывод Shiki, KaTeX, Mermaid и JSON-LD.
  Новых добавлять нельзя. URL внутри контента: http(s) либо одиночный `/` (см. `security.md`).
- Заголовки: `rehype-slug` для id (deep links). Один `<h1>` на страницу, иерархия без пропусков.
- В ревью-режиме диаграммы рендерятся рядом с исходником (collapsible `<details>`).
- Редактор (Variant B): writing-first; слэш-меню (`/`, 14 типов), markdown-шорткаты в начале абзаца
  (`## `, `### `, `> `, `- `, `1. `, `[] `, ` ``` `, `$$`, `> note:/warning:/info:/mermaid:`),
  инлайн-тулбар на выделении (B/I/Code/Link). Метаданные — в `ChapterSettingsPopover`, обвязка ревью —
  в правой шторке `SubmitSheet`.
- Для SEO-описаний использовать plain-text экстрактор (стрип кода/ссылок/HTML+JSX), не сырой MDX.
