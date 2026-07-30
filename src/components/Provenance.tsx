import { ExternalLink } from 'lucide-react';
import type { Source } from '@okf/core';
import { isSafeResourceUrl } from '@/lib/resource-url';

/**
 * The `sources` a concept derives from (spec §5.1).
 *
 * A `resource` is not always a link. It may be a bundle-relative path, or a
 * population/scope descriptor the consumer cannot follow at all — the spec's own
 * example is "all queries in BigQuery project X". Only http(s) resources are
 * rendered as anchors, matching how `concept.resource` is already gated.
 *
 * In-bundle source paths render as text for now: resolving them to a concept
 * route differs between the static reader and the runtime viewer, and is not
 * worth an abstraction for this alone.
 */
export default function Provenance({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-sm font-semibold tracking-tight">Sources</h2>
      <ul className="mt-3 space-y-2">
        {sources.map((s, i) => {
          const label = s.title || s.resource;
          const signals = [
            s.author && `by ${s.author}`,
            s.lastModified && `updated ${s.lastModified}`,
            s.usageCount != null && `${s.usageCount.toLocaleString()} uses`,
          ].filter(Boolean);

          return (
            <li key={s.id ?? `${s.resource}-${i}`} className="text-sm leading-relaxed break-words">
              {isSafeResourceUrl(s.resource) ? (
                <a
                  href={s.resource}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {label}
                </a>
              ) : (
                <span>{label}</span>
              )}
              {s.title && s.title !== s.resource && !isSafeResourceUrl(s.resource) && (
                <span className="text-muted-foreground"> — {s.resource}</span>
              )}
              {signals.length > 0 && <span className="text-muted-foreground"> ({signals.join(' · ')})</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
