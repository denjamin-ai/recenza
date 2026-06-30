// Слот карусели промо-баннеров на ленте (Фаза 10). RSC: тянет видимые баннеры + конфиг пожертвований,
// отдаёт клиентской карусели. Пусто (нет баннеров) → ничего не рендерит.

import { getVisibleBanners, getDonationConfig } from "@/lib/queries/monetization";
import { PromoCarousel } from "@/components/reader/promo-carousel";

export async function PromoCarouselSlot() {
  const [banners, donation] = await Promise.all([getVisibleBanners(), getDonationConfig()]);
  if (banners.length === 0) return null;
  return <PromoCarousel banners={banners} donation={donation} />;
}
