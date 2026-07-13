'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { conceptHref } from '@/lib/paths';
import { getActiveTour, markStepVisited, setActiveTour } from '@/lib/tour-progress';
import { tourProgressKey } from '@/lib/tours';

export interface TourBarStep {
  id: string;
  title: string;
}

export interface TourBarTour {
  id: string;
  title: string;
  /** Ordered, existing steps only — missing-concept steps are skipped for navigation. */
  steps: TourBarStep[];
}

/**
 * Sticky bottom bar shown when the concept currently being viewed is a step
 * of the "active" tour (localStorage `okf-active-tour:<bundleName>`). Marks
 * the step visited on render. Renders nothing if no candidate tour is active.
 */
export default function TourBar({
  bundleName,
  conceptId,
  tours,
  hrefFor = conceptHref,
}: {
  bundleName: string;
  conceptId: string;
  /** Tours (already filtered to ones containing conceptId as a step) this concept could belong to. */
  tours: TourBarTour[];
  hrefFor?: (id: string) => string;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setActiveTourId(getActiveTour(bundleName));
  }, [bundleName]);

  const tour = tours.find((t) => t.id === activeTourId);
  const idx = tour ? tour.steps.findIndex((s) => s.id === conceptId) : -1;

  useEffect(() => {
    if (!tour || idx === -1) return;
    markStepVisited(tourProgressKey(bundleName, tour.id), conceptId);
    // Only re-run when the identity of the visited step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.id, conceptId, idx]);

  if (!mounted || !tour || idx === -1) return null;

  const total = tour.steps.length;
  const prev = idx > 0 ? tour.steps[idx - 1] : undefined;
  const next = idx < total - 1 ? tour.steps[idx + 1] : undefined;
  const isLast = idx === total - 1;

  const exit = () => {
    setActiveTour(bundleName, null);
    setActiveTourId(null);
  };
  const finish = () => {
    setActiveTour(bundleName, null);
    setActiveTourId(null);
  };

  return (
    <>
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-6">
          <div className="min-w-0 truncate text-sm">
            <span className="font-medium">{tour.title}</span>
            <span className="ml-2 text-muted-foreground">
              Step {idx + 1} of {total}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={exit}>
              Exit
            </Button>
            {prev ? (
              <Button variant="outline" size="sm" asChild>
                <a href={hrefFor(prev.id)}>Prev</a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Prev
              </Button>
            )}
            {isLast ? (
              <Button size="sm" asChild onClick={finish}>
                <a href={hrefFor(tour.id)}>Finish</a>
              </Button>
            ) : next ? (
              <Button size="sm" asChild>
                <a href={hrefFor(next.id)}>Next</a>
              </Button>
            ) : (
              <Button size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
