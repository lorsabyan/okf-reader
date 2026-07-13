'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { conceptHref } from '@/lib/paths';
import { getTourProgress, setActiveTour } from '@/lib/tour-progress';
import { firstUnvisitedStep, tourButtonLabel, tourProgressKey, type TourSummary } from '@okf/core';

/**
 * A single tour's card: title, description, step count, progress, and a
 * Start/Continue/Restart button linking to the right next step. Used by
 * both the SSG home page and the runtime viewer's HomeView.
 */
export default function TourCard({
  bundleName,
  tour,
  hrefFor = conceptHref,
}: {
  bundleName: string;
  tour: TourSummary;
  hrefFor?: (id: string) => string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setVisited(getTourProgress(tourProgressKey(bundleName, tour.id)).visited);
  }, [bundleName, tour.id]);

  const total = tour.steps.filter((s) => s.exists).length;
  // Progress-dependent bits are gated behind `mounted` to avoid a hydration mismatch.
  const visitedCount = mounted ? tour.steps.filter((s) => s.exists && visited.includes(s.id)).length : 0;
  const target = mounted ? firstUnvisitedStep(tour.steps, visited) : tour.steps.find((s) => s.exists)?.id;
  const label = mounted ? tourButtonLabel(tour.steps, visited) : 'Start tour';

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <a href={hrefFor(tour.id)} className="hover:underline">
            {tour.title}
          </a>
        </CardTitle>
        {tour.description && <CardDescription>{tour.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <Badge variant="outline">
          {total} step{total === 1 ? '' : 's'}
          {mounted ? ` · ${visitedCount} visited` : ''}
        </Badge>
        {target && (
          <Button size="sm" asChild onClick={() => setActiveTour(bundleName, tour.id)}>
            <a href={hrefFor(target)}>{label}</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
