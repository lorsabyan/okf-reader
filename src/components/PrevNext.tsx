import { conceptHref } from '@/lib/paths';
import type { AdjacentConcept } from '@/lib/prev-next';

type HrefFor = (id: string) => string;

/** Bottom-of-page prev/next nav, alphabetical within the sidebar's group order. */
export default function PrevNext({
  prev,
  next,
  hrefFor = conceptHref,
}: {
  prev?: AdjacentConcept;
  next?: AdjacentConcept;
  hrefFor?: HrefFor;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Concept navigation" className="mt-10 flex items-stretch justify-between gap-4 border-t pt-6 text-sm">
      <div className="min-w-0">
        {prev && (
          <a href={hrefFor(prev.id)} className="block truncate font-medium text-primary hover:underline">
            ← Previous: {prev.title}
          </a>
        )}
      </div>
      <div className="min-w-0 text-right">
        {next && (
          <a href={hrefFor(next.id)} className="block truncate font-medium text-primary hover:underline">
            Next: {next.title} →
          </a>
        )}
      </div>
    </nav>
  );
}
