// Секция публичных комментариев (Фаза 8). RSC-шелл: грузит тред с сервера (getChapterComments) и отдаёт
// клиентской CommentsSection. id секции уникален в режиме whole (по главе) для корректных deep-link/скролла.

import { getChapterComments, type CommentViewer } from "@/lib/queries/comments";
import { CommentsSection } from "./comments-section";

export async function CommentsSlot({
  blogSlug,
  chapterSlug,
  revision,
  blogAuthorId,
  sectionId,
  viewer,
}: {
  blogSlug: string;
  chapterSlug: string;
  revision: number;
  blogAuthorId: string;
  sectionId: string;
  viewer: CommentViewer | null;
}) {
  const data = await getChapterComments({
    blogSlug,
    chapterSlug,
    currentRevision: revision,
    viewer,
    blogAuthorId,
  });

  return (
    <section
      id={sectionId}
      aria-label="Комментарии"
      data-revision={revision}
      className="mt-12 border-t border-[var(--border)] pt-8"
    >
      <h2 className="text-[length:var(--type-h4)]">
        Комментарии{data.total > 0 ? ` · ${data.total}` : ""}
      </h2>
      <CommentsSection
        blogSlug={blogSlug}
        chapterSlug={chapterSlug}
        sectionId={sectionId}
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
