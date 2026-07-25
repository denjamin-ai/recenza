// Возможности аккаунта (Фаза 13) — замена взаимоисключающим ролям.
//
// Модель: ОДИН аккаунт может держать несколько возможностей. «Читатель» — базовый уровень,
// он есть у всех и НИКОГДА не является кабинетом, поэтому в CAPABILITY_ORDER его нет.
// Возможности выдаёт админ (решение владельца, Ф13) — самостоятельно их получить нельзя.
//
// Порт прототипного `rolesOf`/`hasRole` (docs/prototype/ui_kits/blog/src/shared/components.jsx:180-192)
// с одним отличием: «admin» в список не входит — админ аутентифицируется по env-паролю и не имеет
// строки в `users` (инвариант SessionData), поэтому у него нет и возможностей.
//
// Файл клиент-безопасен (никаких импортов из drizzle/схемы) — по образцу src/lib/blocks/constants.ts,
// чтобы навигация и формы не тащили схему БД в бандл.

export const CAPABILITY_ORDER = ["author", "reviewer"] as const;
export type Capability = (typeof CAPABILITY_ORDER)[number];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  author: "Автор",
  reviewer: "Ревьюер",
};

/** Подпись базового уровня — когда возможностей нет ни одной. */
export const READER_LABEL = "Читатель";

/** Минимум полей, по которым считаются возможности (структурно, без зависимости от типа User). */
export interface CapabilityHolder {
  canAuthor: boolean;
  isReviewer: boolean;
}

/** Возможности аккаунта в каноническом порядке. Гость/админ (null) → пустой список. */
export function capabilitiesOf(user: CapabilityHolder | null | undefined): Capability[] {
  if (!user) return [];
  return CAPABILITY_ORDER.filter((c) => (c === "author" ? user.canAuthor : user.isReviewer));
}

export function hasCapability(
  user: CapabilityHolder | null | undefined,
  capability: Capability,
): boolean {
  if (!user) return false;
  return capability === "author" ? user.canAuthor : user.isReviewer;
}

/** Подпись для меню/профиля: «Автор · Ревьюер», либо «Читатель», если возможностей нет. */
export function capabilitiesLabel(user: CapabilityHolder | null | undefined): string {
  const caps = capabilitiesOf(user);
  return caps.length > 0 ? caps.map((c) => CAPABILITY_LABEL[c]).join(" · ") : READER_LABEL;
}

/**
 * Куда вести пользователя после входа: обе возможности → «Рабочее место», одна → её кабинет,
 * ни одной → лента. Общий источник для login-редиректа и меню аватара.
 */
export function homeForCapabilities(user: CapabilityHolder | null | undefined): string {
  const caps = capabilitiesOf(user);
  if (caps.length > 1) return "/workspace";
  if (caps[0] === "author") return "/author";
  if (caps[0] === "reviewer") return "/reviewer";
  return "/";
}
