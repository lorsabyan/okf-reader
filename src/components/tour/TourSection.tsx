import type { TourSummary } from '@/lib/tours';
import TourCard from './TourCard';

/**
 * "Tours" section for a bundle's home page — renders nothing when there are
 * none. Deliberately leaves `hrefFor` undefined rather than defaulting it:
 * this component has no 'use client' directive, so on the SSG home page it
 * renders as a Server Component wrapping the client TourCard, and a
 * defaulted function prop can't cross that boundary — TourCard supplies its
 * own client-side default (conceptHref) when the prop is omitted.
 */
export default function TourSection({
  bundleName,
  tours,
  hrefFor,
}: {
  bundleName: string;
  tours: TourSummary[];
  hrefFor?: (id: string) => string;
}) {
  if (!tours.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">Tours</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {tours.map((t) => (
          <TourCard key={t.id} bundleName={bundleName} tour={t} hrefFor={hrefFor} />
        ))}
      </div>
    </section>
  );
}
