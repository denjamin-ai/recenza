import type { Metadata } from "next";
import { PortfolioEditor } from "@/app/author/_components/editor/portfolio-editor";
import { getCurrentUser } from "@/lib/auth";
import { getPortfolioForAuthor } from "@/lib/queries/author";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Портфолио «Об авторе»", robots: { index: false, follow: false } };

export default async function PortfolioEditPage() {
  const user = await getCurrentUser(); // гарантированно автор (гард в layout)
  const portfolio = user ? await getPortfolioForAuthor(user.id) : null;
  return (
    <PortfolioEditor
      initialBlocks={portfolio?.blocks ?? []}
      initialVisible={portfolio?.isVisible ?? false}
    />
  );
}
