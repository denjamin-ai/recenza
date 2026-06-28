// Гостевой intent-replay: гость жмёт реакцию → /login?next=…&intent=… → после входа реплей.
// Без localStorage. Токен компактный и allowlisted; декод валидирует глагол + формат id.
// Безопасность: реплей всегда идёт через авторизованный API (server-side auth + ownership);
// next обязан быть относительным (anti-open-redirect). Мусорный intent молча игнорируется.

export type IntentVerb = "vote" | "bookmark" | "follow";

export interface Intent {
  verb: IntentVerb;
  id: string;
  /** только для verb='vote' */
  value?: 1 | -1;
}

const VERBS: readonly IntentVerb[] = ["vote", "bookmark", "follow"];
// id наших сущностей — ulid/фиксированные seed-id: латиница/цифры/_/-, до 64 символов.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Кодирование: `vote:<chapterId>:1` | `bookmark:<blogId>` | `follow:<authorId>`. */
export function encodeIntent(intent: Intent): string {
  if (intent.verb === "vote") return `vote:${intent.id}:${intent.value ?? 1}`;
  return `${intent.verb}:${intent.id}`;
}

/** Разбор с валидацией. Возвращает null на любом несоответствии (не бросает). */
export function parseIntent(raw: string | null | undefined): Intent | null {
  if (!raw) return null;
  const parts = raw.split(":");
  const verb = parts[0] as IntentVerb;
  if (!VERBS.includes(verb)) return null;

  const id = parts[1];
  if (!id || !ID_RE.test(id)) return null;

  if (verb === "vote") {
    const value = parts[2] === "-1" ? -1 : parts[2] === "1" ? 1 : null;
    if (value === null || parts.length !== 3) return null;
    return { verb, id, value };
  }
  if (parts.length !== 2) return null;
  return { verb, id };
}

/**
 * Anti-open-redirect: разрешён только относительный путь сайта.
 * Отклоняем абсолютные URL, протокол-relative (`//host`) и обратные слэши.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
