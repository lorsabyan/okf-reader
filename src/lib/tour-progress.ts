/**
 * Client-only localStorage helpers for tour progress and the "active" tour.
 * Every function guards `typeof window` so it's safe to import from
 * components that also render on the server.
 */

export interface TourProgress {
  visited: string[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getTourProgress(key: string): TourProgress {
  const data = readJson<Partial<TourProgress>>(key, {});
  return { visited: Array.isArray(data.visited) ? data.visited.map(String) : [] };
}

/** Mark a step visited (idempotent) and persist. Returns the updated progress. */
export function markStepVisited(key: string, stepId: string): TourProgress {
  if (typeof window === 'undefined') return { visited: [] };
  const progress = getTourProgress(key);
  if (!progress.visited.includes(stepId)) progress.visited.push(stepId);
  window.localStorage.setItem(key, JSON.stringify(progress));
  return progress;
}

const ACTIVE_TOUR_PREFIX = 'okf-active-tour:';

export function activeTourKey(bundleName: string): string {
  return `${ACTIVE_TOUR_PREFIX}${bundleName}`;
}

/** The tourId currently "active" for this bundle, or null. */
export function getActiveTour(bundleName: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(activeTourKey(bundleName));
}

/** Set (or clear, with `null`) the active tour for this bundle. */
export function setActiveTour(bundleName: string, tourId: string | null): void {
  if (typeof window === 'undefined') return;
  const key = activeTourKey(bundleName);
  if (tourId) window.localStorage.setItem(key, tourId);
  else window.localStorage.removeItem(key);
}
