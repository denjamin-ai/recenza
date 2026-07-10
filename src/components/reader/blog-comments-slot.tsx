// Merged-секция комментариев режима «Весь блог» (ui-feedback-4 П8). RSC-шелл: грузит комментарии
// ВСЕХ опубликованных глав одним запросом (getBlogComments) и отдаёт клиентской CommentsSection
// в blog-режиме. id="comments" + aria-label «Комментарии» — те же, что у секции главы (POM e2e).

import { getBlogComments, type CommentViewer } from "@/lib/queries/comments";
import { CommentsSection } from "./comments-section";

export async function BlogCommentsSlot({
  blogSlug,
  chapters,
  blogAuthorId,
  viewer,
}: {
  blogSlug: string;
  chapters: { slug: string; title: string; revision: number }[];
  blogAuthorId: string;
  viewer: CommentViewer | null;
}) {
  const data = await getBlogComments({ blogSlug, chapters, viewer, blogAuthorId });

  return (
    <section id="comments" aria-label="Комментарии" className="mt-12 border-t border-[var(--border)] pt-8">
      <h2 className="text-[length:var(--type-h4)]">
        Комментарии{data.total > 0 ? ` · ${data.total}` : ""}
      </h2>
      <CommentsSection
        blogSlug={blogSlug}
        chapterSlug={null}
        chapters={chapters.map((c) => ({ slug: c.slug, title: c.title }))}
        sectionId="comments"
        current={data.current}
        older={data.older}
        total={data.total}
        canComment={data.canComment}
        blockedReason={data.blockedReason}
        isAuthed={viewer != null}
        viewerId={viewer?.id ?? null}
      />
    </section>
  );
}
