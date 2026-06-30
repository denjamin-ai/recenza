// Способы пожертвований (Фаза 10): мастер-флаг + способы (ссылки/QR). Раздельно от баннеров (§11.7).
import { getAdminDonation } from "@/lib/queries/admin";
import { ScreenHead, Card } from "@/app/admin/_components/primitives";
import { DonationManager } from "@/app/admin/_components/donation-manager";

export const dynamic = "force-dynamic";

export default async function AdminDonationPage() {
  const data = await getAdminDonation();
  return (
    <div className="max-w-3xl">
      <ScreenHead eyebrow="Платформа" title="Пожертвования" description="Способы поддержки в модалке «Поддержать»: ссылки и QR (загрузка, без генерации). Без указания сумм." />
      <Card>
        <DonationManager data={data} />
      </Card>
    </div>
  );
}
