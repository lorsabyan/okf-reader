import type { Concept, CoreBundle } from './core';

/**
 * Guided tours: an ordinary OKF concept doc whose frontmatter has
 * `type: Tour` (case-insensitive) and a non-empty `steps` list of
 * concept ids. Browser-safe — no node imports.
 */

export function isTour(c: Concept): boolean {
  return c.type.toLowerCase() === 'tour' && !!c.steps && c.steps.length > 0;
}

/** All tour concepts in a bundle, in bundle (id-sorted) order. */
export function getTours(bundle: Pick<CoreBundle, 'concepts'>): Concept[] {
  return bundle.concepts.filter(isTour);
}

/** Tours that include `conceptId` as one of their steps. */
export function toursForStep(bundle: Pick<CoreBundle, 'concepts'>, conceptId: string): Concept[] {
  return getTours(bundle).filter((t) => (t.steps ?? []).includes(conceptId));
}

export function tourProgressKey(bundleName: string, tourId: string): string {
  return `okf-tour:${bundleName}:${tourId}`;
}

export function stepIndex(tour: Concept, conceptId: string): number {
  return (tour.steps ?? []).indexOf(conceptId);
}

/** The step after `conceptId`, or undefined if it's the last step or not found. */
export function nextStep(tour: Concept, conceptId: string): string | undefined {
  const i = stepIndex(tour, conceptId);
  if (i === -1) return undefined;
  return tour.steps?.[i + 1];
}

/** The step before `conceptId`, or undefined if it's the first step or not found. */
export function prevStep(tour: Concept, conceptId: string): string | undefined {
  const i = stepIndex(tour, conceptId);
  if (i <= 0) return undefined;
  return tour.steps?.[i - 1];
}

export interface TourStepInfo {
  id: string;
  title: string;
  /** False when the step references a concept id that isn't in the bundle (consumer-tolerant). */
  exists: boolean;
}

export interface TourSummary {
  id: string;
  title: string;
  description: string;
  steps: TourStepInfo[];
}

/** Resolve a tour's step ids to display info, tolerating steps that reference missing concepts. */
export function resolveTourSteps(bundle: Pick<CoreBundle, 'byId'>, tour: Concept): TourStepInfo[] {
  return (tour.steps ?? []).map((id) => {
    const c = bundle.byId.get(id);
    return { id, title: c?.title ?? id, exists: !!c };
  });
}

export function tourSummary(bundle: Pick<CoreBundle, 'byId'>, tour: Concept): TourSummary {
  return { id: tour.id, title: tour.title, description: tour.description, steps: resolveTourSteps(bundle, tour) };
}

export function getTourSummaries(bundle: CoreBundle): TourSummary[] {
  return getTours(bundle).map((t) => tourSummary(bundle, t));
}

/**
 * The step a Start/Continue button should link to: the first unvisited
 * *existing* step, or the first existing step if every step has been
 * visited (or none exist yet). Undefined only when the tour has no
 * resolvable steps at all.
 */
export function firstUnvisitedStep(steps: TourStepInfo[], visited: string[]): string | undefined {
  const existing = steps.filter((s) => s.exists);
  if (!existing.length) return undefined;
  const visitedSet = new Set(visited);
  return existing.find((s) => !visitedSet.has(s.id))?.id ?? existing[0].id;
}

export type TourButtonLabel = 'Start tour' | 'Continue' | 'Restart tour';

export function tourButtonLabel(steps: TourStepInfo[], visited: string[]): TourButtonLabel {
  const existing = steps.filter((s) => s.exists);
  if (!existing.length) return 'Start tour';
  const visitedCount = existing.filter((s) => visited.includes(s.id)).length;
  if (visitedCount === 0) return 'Start tour';
  if (visitedCount >= existing.length) return 'Restart tour';
  return 'Continue';
}
