// Отзыв инвайт-ссылки эксперта автором (Фаза 14). Только своя ссылка и только пока она не отработала.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expertInvites } from "@/lib/db/schema";
import { getCurrentUser, requireAuthor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { hitActionRate } from "@/lib/rate-limit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAuthor();
  if (gate instanceof NextResponse) return gate;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const rl = hitActionRate(`expert-invite:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите секунду." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 1) } },
    );
  }

  const { id } = await params;
  // Ownership — в самом WHERE: чужую ссылку нельзя отозвать и нельзя отличить от несуществующей.
  const updated = await db
    .update(expertInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(expertInvites.id, id),
        eq(expertInvites.byHandle, user.handle),
        eq(expertInvites.status, "pending"),
      ),
    )
    .returning({ id: expertInvites.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Ссылка не найдена или уже неактивна." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
