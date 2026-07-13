import { describe, expect, test } from 'bun:test';
import { tourBarMode } from './tour-progress';

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
