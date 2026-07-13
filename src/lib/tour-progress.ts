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

export interface ActiveTourState {
  id: string;
  /** `Date.now()` at the last time the tour was actively used (bar rendered, step marked, or explicitly resumed). */
  lastActiveAt: number;
}

/** The tour currently "active" for this bundle (id + last-active timestamp), or null. */
export function getActiveTour(bundleName: string): ActiveTourState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(activeTourKey(bundleName));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveTourState>;
    if (typeof parsed.id === 'string') {
      return { id: parsed.id, lastActiveAt: typeof parsed.lastActiveAt === 'number' ? parsed.lastActiveAt : Date.now() };
    }
  } catch {
    // Legacy format from before lastActiveAt existed: a bare tourId string.
  }
  return { id: raw, lastActiveAt: Date.now() };
}

/** Set (or clear, with `null`) the active tour for this bundle, refreshing `lastActiveAt` to now. */
export function setActiveTour(bundleName: string, tourId: string | null): void {
  if (typeof window === 'undefined') return;
  const key = activeTourKey(bundleName);
  if (tourId) window.localStorage.setItem(key, JSON.stringify({ id: tourId, lastActiveAt: Date.now() } satisfies ActiveTourState));
  else window.localStorage.removeItem(key);
}

const TOUR_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type TourBarMode = 'bar' | 'chip';

/**
 * Pure decision logic for `TourBar`: a tour that hasn't been actively used
 * in over 7 days renders as a small floating "Resume tour" chip instead of
 * pinning the full sticky bar to every step page forever.
 */
export function tourBarMode(lastActiveAt: number, now: number = Date.now()): TourBarMode {
  return now - lastActiveAt > TOUR_STALE_AFTER_MS ? 'chip' : 'bar';
}
