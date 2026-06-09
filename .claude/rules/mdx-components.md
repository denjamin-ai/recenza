---
description: Конвенции MDX и блочного контента (рендер главы/ревью).
globs:
  - "src/components/mdx/**"
  - "src/lib/mdx.ts"
  - "src/components/editor/**"
---

# Правило: MDX и блоки

- Типы блоков (**12**): `p, h2, h3, quote, list (bullet/numbered/todo), code, callout (note/warning/info),
  mermaid, latex, image, table, embed`. **Рендер идентичен в ридере и в ревью** (один компонент-рендерер).
- MDX компилируется через `next-mdx-remote/rsc` + `rehype-pretty-code` (Shiki dual theme:
  `github-dark`/`github-light`). Перед persist suggestion/контента — `stripDangerousHtml()`.
- Код: подсветка Shiki + кнопка копирования. Mermaid — клиентский ленивый компонент, тема-aware.
  LaTeX — `remark-math` + `rehype-katex` (`$inline$`, `$$block$$`); тип блока `latex` ↔ `$$block$$`.
  Изображения — `next/image` + `alt`.
- Заголовки: `rehype-slug` для id (deep links). Один `<h1>` на страницу, иерархия без пропусков.
- В ревью-режиме диаграммы рендерятся рядом с исходником (collapsible `<details>`).
- Редактор (Variant B): writing-first; слэш-меню (`/`, **12 типов блоков / 14 пунктов** — list ×3 подтипа),
  markdown-шорткаты в начале абзаца
  (`## `, `### `, `> `, `- `, `1. `, `[] `, ` ``` `, `$$`, `> note:/warning:/info:/mermaid:`),
  инлайн-тулбар на выделении (B/I/Code/Link). Метаданные — в `ChapterSettingsPopover`, обвязка ревью —
  в правой шторке `SubmitSheet`.
- Для SEO-описаний использовать plain-text экстрактор (стрип кода/ссылок/HTML+JSX), не сырой MDX.
