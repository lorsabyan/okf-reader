import type { Heading } from '@/lib/markdown';

/**
 * "On this page" sticky right rail for concept pages with >= 3 headings.
 * Deliberately dumb — no scroll-spy, just links to the slug anchors
 * rehype-slug assigned during rendering.
 */
export default function PageToc({ headings }: { headings: Heading[] }) {
  if (headings.length < 3) return null;
  return (
    <aside className="hidden shrink-0 xl:block xl:w-56">
      <div className="sticky top-20 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
        <ul className="mt-2 space-y-1.5 border-l">
          {headings.map((h) => (
            <li key={h.id} className={h.depth === 3 ? 'pl-6' : 'pl-3'}>
              <a href={`#${h.id}`} className="block text-muted-foreground hover:text-foreground">
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
