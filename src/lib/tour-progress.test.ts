import { afterEach, describe, expect, test } from 'bun:test';
import { getActiveTour, getTourProgress, markStepVisited, setActiveTour, tourBarMode } from './tour-progress';

describe('tourBarMode', () => {
  const now = 1_700_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  test('renders the full bar just after activity', () => {
    expect(tourBarMode(now, now)).toBe('bar');
  });

  test('renders the full bar within the 7-day freshness window', () => {
    expect(tourBarMode(now - 6 * DAY, now)).toBe('bar');
  });

  test('renders the full bar exactly at the 7-day boundary', () => {
    expect(tourBarMode(now - 7 * DAY, now)).toBe('bar');
  });

  test('renders the compact chip once activity is more than 7 days stale', () => {
    expect(tourBarMode(now - 8 * DAY, now)).toBe('chip');
  });

  test('renders the compact chip for a long-abandoned tour', () => {
    expect(tourBarMode(now - 90 * DAY, now)).toBe('chip');
  });
});

/** Minimal in-memory Storage stub — just enough for tour-progress's getItem/setItem/removeItem usage. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
}

describe('localStorage-backed helpers', () => {
  afterEach(() => {
    // The stub must never leak into other test files.
    delete (globalThis as any).window;
  });

  function installWindow(): MemoryStorage {
    const storage = new MemoryStorage();
    (globalThis as any).window = { localStorage: storage };
    return storage;
  }

  describe('getActiveTour', () => {
    test('returns null when nothing is stored', () => {
      installWindow();
      expect(getActiveTour('bundle-a')).toBeNull();
    });

    test('parses a well-formed { id, lastActiveAt } record', () => {
      const storage = installWindow();
      storage.setItem('okf-active-tour:bundle-a', JSON.stringify({ id: 'onboarding', lastActiveAt: 123 }));
      expect(getActiveTour('bundle-a')).toEqual({ id: 'onboarding', lastActiveAt: 123 });
    });

    test('falls back to a legacy bare tourId string, stamping a fresh numeric lastActiveAt', () => {
      const storage = installWindow();
      storage.setItem('okf-active-tour:bundle-a', 'onboarding');
      const before = Date.now();
      const result = getActiveTour('bundle-a');
      const after = Date.now();
      expect(result?.id).toBe('onboarding');
      expect(typeof result?.lastActiveAt).toBe('number');
      expect(result!.lastActiveAt).toBeGreaterThanOrEqual(before);
      expect(result!.lastActiveAt).toBeLessThanOrEqual(after);
    });

    test('falls back to the legacy shape for corrupt JSON (the raw string becomes the id)', () => {
      const storage = installWindow();
      storage.setItem('okf-active-tour:bundle-a', '{oops');
      const result = getActiveTour('bundle-a');
      expect(result?.id).toBe('{oops');
      expect(typeof result?.lastActiveAt).toBe('number');
    });

    test('falls back to the legacy shape when valid JSON lacks a string id', () => {
      const storage = installWindow();
      const raw = JSON.stringify({ lastActiveAt: 999 });
      storage.setItem('okf-active-tour:bundle-a', raw);
      const result = getActiveTour('bundle-a');
      // The whole raw JSON string becomes the legacy id, per current source.
      expect(result?.id).toBe(raw);
      expect(typeof result?.lastActiveAt).toBe('number');
    });
  });

  describe('getTourProgress', () => {
    test('defaults to an empty visited list when nothing is stored', () => {
      installWindow();
      expect(getTourProgress('tour-1')).toEqual({ visited: [] });
    });

    test('coerces a non-array visited field to an empty list', () => {
      const storage = installWindow();
      storage.setItem('tour-1', JSON.stringify({ visited: 'nope' }));
      expect(getTourProgress('tour-1')).toEqual({ visited: [] });
    });
  });

  describe('markStepVisited', () => {
    test('marking the same step twice stores it only once', () => {
      installWindow();
      markStepVisited('tour-1', 'step-1');
      const progress = markStepVisited('tour-1', 'step-1');
      expect(progress.visited).toEqual(['step-1']);
      expect(getTourProgress('tour-1').visited).toEqual(['step-1']);
    });
  });

  describe('setActiveTour', () => {
    test('setting null removes the stored key', () => {
      const storage = installWindow();
      setActiveTour('bundle-a', 'onboarding');
      expect(storage.getItem('okf-active-tour:bundle-a')).not.toBeNull();
      setActiveTour('bundle-a', null);
      expect(storage.getItem('okf-active-tour:bundle-a')).toBeNull();
      expect(getActiveTour('bundle-a')).toBeNull();
    });
  });
});
