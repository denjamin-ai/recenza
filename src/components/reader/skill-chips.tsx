// Чипы ключевых навыков главы (chapters.skills) — видны читателю, ОТДЕЛЬНО от blog.tags.

export function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Ключевые навыки главы">
      {skills.map((s) => (
        <li
          key={s}
          className="rounded-[var(--radius-pill)] border border-[var(--accent)] px-2.5 py-0.5 text-[length:var(--type-small)] text-[var(--accent)]"
        >
          {s}
        </li>
      ))}
    </ul>
  );
}
