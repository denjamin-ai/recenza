// Лимиты текстов промо-баннеров (клиент-безопасный модуль без drizzle — паттерн blocks/constants.ts).
// Общий источник для админ-формы (maxLength + счётчик) и API (явный 400 вместо тихого slice).
// Значения подобраны под слайд карусели h≈144px: длиннее — контент клиппится.

export const BANNER_LIMITS = {
  eyebrow: 40,
  title: 90,
  cta: 30,
} as const;

export type BannerTextField = keyof typeof BANNER_LIMITS;

export const BANNER_FIELD_LABEL: Record<BannerTextField, string> = {
  eyebrow: "Надзаголовок",
  title: "Заголовок",
  cta: "Текст кнопки",
};

/** null — длина в норме; иначе готовое русское сообщение об ошибке. */
export function bannerFieldError(field: BannerTextField, value: string): string | null {
  const max = BANNER_LIMITS[field];
  if (value.trim().length > max) return `${BANNER_FIELD_LABEL[field]}: до ${max} символов.`;
  return null;
}
