// Промо-баннеры ленты (Фаза 10): админ управляет каруселью. Раздельно от пожертвований (§11.7).
import { getAdminBanners } from "@/lib/queries/admin";
import { ScreenHead, Card } from "@/app/admin/_components/primitives";
import { BannerManager } from "@/app/admin/_components/banner-manager";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const banners = await getAdminBanners();
  return (
    <div className="max-w-3xl">
      <ScreenHead eyebrow="Платформа" title="Промо-баннеры" description="Карусель на ленте. Действие по клику: внутренняя ссылка, внешняя ссылка или открытие окна пожертвований." />
      <Card>
        <BannerManager banners={banners} />
      </Card>
    </div>
  );
}
