'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { conceptHref } from '@/lib/paths';
import { PROSE_CLASS } from '@/lib/prose';
import { getTourProgress, setActiveTour } from '@/lib/tour-progress';
import { firstUnvisitedStep, tourButtonLabel, tourProgressKey, type TourStepInfo } from '@okf/core';

export interface TourViewTour {
  id: string;
  title: string;
  type: string;
  description: string;
  timestamp?: string;
  tags: string[];
}

/**
 * The concept page for a tour itself: badges/title header (consistent with
 * regular concept pages), the tour's intro body, and an ordered step list
 * with visited checkmarks. Used by both the SSG concept page and the
 * runtime viewer's ConceptView when `isTour(concept)`.
 */
export default function TourView({
  bundleName,
  tour,
  introHtml,
  steps,
  hrefFor = conceptHref,
}: {
  bundleName: string;
  tour: TourViewTour;
  introHtml: string;
  steps: TourStepInfo[];
  hrefFor?: (id: string) => string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const key = tourProgressKey(bundleName, tour.id);

  useEffect(() => {
    setMounted(true);
    setVisited(getTourProgress(key).visited);
  }, [key]);

  const target = mounted ? firstUnvisitedStep(steps, visited) : steps.find((s) => s.exists)?.id;
  const label = mounted ? tourButtonLabel(steps, visited) : 'Start tour';
  const start = () => setActiveTour(bundleName, tour.id);

  return (
    <article className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{tour.type}</Badge>
        {tour.timestamp && <time className="text-sm text-muted-foreground">{tour.timestamp.slice(0, 10)}</time>}
        {tour.tags.map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{tour.title}</h1>
      {tour.description && <p className="mt-2 text-lg text-muted-foreground">{tour.description}</p>}

      {introHtml && <section className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: introHtml }} />}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Steps</h2>
          {target && (
            <Button size="sm" asChild onClick={start}>
              <a href={hrefFor(target)}>{label}</a>
            </Button>
          )}
        </div>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => {
            const isVisited = mounted && visited.includes(s.id);
            return (
              <li key={s.id} className="flex items-center gap-2.5 text-sm leading-relaxed">
                <span
                  className={
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ' +
                    (isVisited ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')
                  }
                >
                  {isVisited ? <Check className="size-3" /> : i + 1}
                </span>
                {s.exists ? (
                  <a href={hrefFor(s.id)} className="font-medium text-primary hover:underline" onClick={start}>
                    {s.title}
                  </a>
                ) : (
                  <span className="text-muted-foreground" title={`Not yet written: ${s.id}`}>
                    {s.title} <span className="text-xs">(missing)</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <Separator className="mt-10" />
      <footer className="py-4 text-xs text-muted-foreground">Concept ID: {tour.id}</footer>
    </article>
  );
}
