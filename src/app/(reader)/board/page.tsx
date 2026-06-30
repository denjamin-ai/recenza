// Публичная доска «Ищем ревьюеров» (Фаза 10, §11.6). Точка входа — баннер ленты (pb_recruit → /board).
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBoardCalls } from "@/lib/queries/board";
import { ReviewerBoard } from "@/components/reader/reviewer-board";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ищем ревьюеров",
  description: "Открытые направления для рецензирования на Recenza. Откликнитесь или станьте ревьюером.",
  alternates: { canonical: absoluteUrl("/board") },
  openGraph: {
    title: "Ищем ревьюеров | Recenza",
    description: "Открытые направления для рецензирования. Помогите авторам выпускать качественные статьи.",
    url: absoluteUrl("/board"),
  },
};

export default async function BoardPage() {
  const [calls, user] = await Promise.all([getPublicBoardCalls(), getCurrentUser()]);
  return <ReviewerBoard calls={calls} isAuthed={!!user} />;
}
