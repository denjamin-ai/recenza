// Словесный (word-level) дифф для инлайн-сравнения ревизий в ревью (Фаза 7).
// Порт `diffWords` из прототипа (docs/prototype/ui_kits/blog/src/review/review-page.jsx) — LCS на
// Uint16Array, без внешних зависимостей. Серверный (вызывается из BlockRenderer review-режима),
// поэтому zero-dep и детерминирован.
//
// Возвращает массив частей { type: "eq"|"ins"|"del", text }. Для рендера диффа берём eq+ins
// (вставки подсвечиваются `.diff-edit`, удаления опускаются) — как InlineDiff в прототипе.

export type DiffPart = { type: "eq" | "ins" | "del"; text: string };

// Токенизация: слова и пробельные группы по отдельности — дифф по словам, а не по символам.
function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function push(out: DiffPart[], type: DiffPart["type"], text: string): void {
  const last = out[out.length - 1];
  if (last && last.type === type) last.text += text;
  else out.push({ type, text });
}

/**
 * LCS-дифф двух строк по словам. Склеивает соседние части одного типа.
 * @returns части в порядке исходной/целевой строки: eq (общее), del (только в `a`), ins (только в `b`).
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const A = tokenize(a || "");
  const B = tokenize(b || "");
  const n = A.length;
  const m = B.length;

  // dp[i][j] = длина LCS суффиксов A[i:] и B[j:]. Uint16Array достаточно (блок ≤ 20k символов).
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push(out, "eq", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(out, "del", A[i]);
      i++;
    } else {
      push(out, "ins", B[j]);
      j++;
    }
  }
  while (i < n) push(out, "del", A[i++]);
  while (j < m) push(out, "ins", B[j++]);
  return out;
}
