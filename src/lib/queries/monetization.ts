// Публичные read-helpers монетизации (Фаза 10): видимые промо-баннеры ленты + конфиг пожертвований.
// Используются в RSC ленты ((reader)/page.tsx). Без авторизации — данные публичные.

import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { donationMethods, promoBanners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DONATIONS_ENABLED_KEY, getAppFlag } from "@/lib/queries/settings";
import type { BannerAction, DonationType } from "@/types";

export interface FeedBanner {
  id: string;
  eyebrow: string | null;
  title: string | null;
  cta: string | null;
  tone: string | null;
  icon: string | null;
  action: BannerAction | null;
  target: string | null;
}

export async function getVisibleBanners(): Promise<FeedBanner[]> {
  return db
    .select({
      id: promoBanners.id,
      eyebrow: promoBanners.eyebrow,
      title: promoBanners.title,
      cta: promoBanners.cta,
      tone: promoBanners.tone,
      icon: promoBanners.icon,
      action: promoBanners.action,
      target: promoBanners.target,
    })
    .from(promoBanners)
    .where(eq(promoBanners.visible, true))
    .orderBy(asc(promoBanners.sort));
}

export interface DonationMethodView {
  id: string;
  name: string;
  type: DonationType;
  url: string | null;
  qrUrl: string | null;
  hint: string | null;
  isPrimary: boolean;
}

export interface DonationConfig {
  enabled: boolean;
  methods: DonationMethodView[];
}

/** Конфиг модалки «Поддержать»: флаг + видимые способы. Если флаг off → enabled=false (методы скрыты). */
export async function getDonationConfig(): Promise<DonationConfig> {
  const enabled = await getAppFlag(DONATIONS_ENABLED_KEY);
  if (!enabled) return { enabled: false, methods: [] };
  const methods = await db
    .select({
      id: donationMethods.id,
      name: donationMethods.name,
      type: donationMethods.type,
      url: donationMethods.url,
      qrUrl: donationMethods.qrUrl,
      hint: donationMethods.hint,
      isPrimary: donationMethods.isPrimary,
    })
    .from(donationMethods)
    .where(eq(donationMethods.visible, true))
    .orderBy(asc(donationMethods.sort));
  return { enabled: true, methods };
}
