// «Выбор редакции» (Фаза 15): ручное закрепление блогов на витрине главной.
// Страховка R-2 — пока блогов с независимым бейджем меньше порога, витрину наполняет редакция,
// а не алгоритм. Если не закрепить ничего и проверенных нет, главная честно показывает пустое
// состояние со ссылкой на каталог (решение владельца: отката на «показать всё» нет).

import { getAdminFeatured } from "@/lib/queries/admin";
import { ScreenHead, Card } from "@/app/admin/_components/primitives";
import { FeaturedManager } from "@/app/admin/_components/featured-manager";
import { SHOWCASE_MIN_VERIFIED } from "@/lib/showcase";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedPage() {
  const blogs = await getAdminFeatured();
  const verifiedCount = blogs.filter((b) => b.verifiedTier === "independent" && !b.hidden).length;

  return (
    <div className="max-w-3xl">
      <ScreenHead
        eyebrow="Платформа"
        title="Выбор редакции"
        description={`Закреплённые блоги показываются на главной. Пока блогов с независимым ревью меньше ${SHOWCASE_MIN_VERIFIED}, витрину ведёт эта подборка.`}
      />
      <Card>
        <FeaturedManager blogs={blogs} verifiedCount={verifiedCount} />
      </Card>
    </div>
  );
}
