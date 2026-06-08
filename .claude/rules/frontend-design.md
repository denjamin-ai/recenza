---
description: Дизайн-система — типографика, цвет, анимации, a11y.
globs:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/globals.css"
---

# Правило: Frontend-дизайн

- **Шрифты:** Lora (заголовки, `--font-lora`), Literata (текст, `--font-literata`), Fira Code (код,
  `--font-fira`). Через `next/font/google`, subsets `["latin","cyrillic"]`. Других шрифтов не вводить.
- **Цвет:** акцент — teal (light `#0f766e` / dark `#2dd4bf`) + семантические (success/warning/danger/info).
  Только **CSS-переменные** через Tailwind-утилиты. Запрещены raw-цвета (`text-red-500`, hex в TSX).
- **Поверхности:** спокойная редакторская эстетика — **тонкие границы, без теней** (box-shadow только
  для focus-ring). Тёмная/светлая темы (`next-themes`); никаких `bg-white/bg-black/text-white/text-black`
  без переменных.
- **Анимации:** только `transform` и `opacity` (никогда `width/height/margin`). Stagger через
  `--index`. Обязательно `@media (prefers-reduced-motion: reduce)` — отключение анимаций.
- **A11y:** skip-to-content + `<main tabIndex={-1}>`; `aria-label` на всех icon-кнопках;
  `focus-visible: ring-2 ring-offset-2` акцентом; `role="tablist"` на strip глав; `aria-live` тосты;
  цвет — не единственный сигнификатор (у статуса есть текст). Хит-таргеты ≥36/44px.
- Текст интерфейса — на русском. `text-wrap: pretty` для абзацев.
