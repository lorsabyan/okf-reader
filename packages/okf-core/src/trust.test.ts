import { describe, expect, test } from 'bun:test';
import {
  lastVerifiedAt,
  normalizeVerified,
  parseGenerated,
  parseSources,
  parseStatus,
  staleSince,
  trustTier,
} from './trust.ts';

describe('normalizeVerified', () => {
  test('a bare mapping counts as a one-element list (spec §5.2)', () => {
    expect(normalizeVerified({ by: 'human:ahormati', at: '2026-06-25T09:00:00Z' })).toEqual([
      { by: 'human:ahormati', at: '2026-06-25T09:00:00Z' },
    ]);
  });

  test('a list stays a list, in order', () => {
    const events = normalizeVerified([
      { by: 'human:a', at: '2026-06-25T09:00:00Z' },
      { by: 'process:nightly', at: '2026-06-26T02:00:00Z' },
    ]);
    expect(events.map((e) => e.by)).toEqual(['human:a', 'process:nightly']);
  });

  test('absent yields an empty array, so callers never branch on undefined', () => {
    expect(normalizeVerified(undefined)).toEqual([]);
    expect(normalizeVerified(null)).toEqual([]);
  });

  test('entries without a `by` actor are dropped', () => {
    expect(normalizeVerified([{ at: '2026-06-25T09:00:00Z' }, { by: '  ' }, 'nonsense'])).toEqual([]);
  });

  test('`at` is optional', () => {
    expect(normalizeVerified({ by: 'human:x' })).toEqual([{ by: 'human:x' }]);
  });
});

describe('trustTier', () => {
  test('no verified ⇒ unverified', () => {
    expect(trustTier({ verified: [] })).toBe('unverified');
    expect(trustTier({})).toBe('unverified');
  });

  test('non-human actors only ⇒ machine-confirmed', () => {
    expect(trustTier({ verified: [{ by: 'process:finance-nightly' }] })).toBe('machine-confirmed');
    expect(trustTier({ verified: [{ by: 'reference_agent/gemini-2.5-pro' }] })).toBe('machine-confirmed');
  });

  test('any human actor ⇒ human-reviewed, even mixed with machine actors', () => {
    expect(
      trustTier({ verified: [{ by: 'process:nightly' }, { by: 'human:ahormati' }] }),
    ).toBe('human-reviewed');
  });

  test('an actor merely containing "human:" does not count — the prefix is the signal', () => {
    expect(trustTier({ verified: [{ by: 'agent/not-human:x' }] })).toBe('machine-confirmed');
  });
});

describe('lastVerifiedAt', () => {
  test('returns the most recent timestamp regardless of order', () => {
    expect(
      lastVerifiedAt({
        verified: [
          { by: 'process:nightly', at: '2026-06-26T02:00:00Z' },
          { by: 'human:a', at: '2026-06-25T09:00:00Z' },
        ],
      }),
    ).toBe('2026-06-26T02:00:00Z');
  });

  test('undefined when no event carries a timestamp', () => {
    expect(lastVerifiedAt({ verified: [{ by: 'human:a' }] })).toBeUndefined();
    expect(lastVerifiedAt({ verified: [] })).toBeUndefined();
  });
});

describe('staleSince', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  test('a future stale_after is not stale', () => {
    expect(staleSince({ staleAfter: '2026-12-31' }, at('2026-07-30'))).toBeUndefined();
  });

  test('a past stale_after is stale, and reports the date', () => {
    expect(staleSince({ staleAfter: '2026-06-30' }, at('2026-07-30'))).toBe('2026-06-30');
  });

  test('the boundary day itself counts as stale (today >= stale_after)', () => {
    expect(staleSince({ staleAfter: '2026-07-30' }, at('2026-07-30'))).toBe('2026-07-30');
  });

  test('absent or unparseable stale_after is never stale', () => {
    expect(staleSince({}, at('2026-07-30'))).toBeUndefined();
    expect(staleSince({ staleAfter: 'next Tuesday' }, at('2026-07-30'))).toBeUndefined();
  });

  test('a late-evening local clock does not shift the boundary day', () => {
    // 23:30 UTC-ish on the day before: still not stale.
    expect(staleSince({ staleAfter: '2026-07-30' }, new Date('2026-07-29T23:30:00Z'))).toBeUndefined();
  });
});

describe('parseStatus', () => {
  test('recognized values pass through, case-insensitively', () => {
    expect(parseStatus('draft')).toBe('draft');
    expect(parseStatus('Deprecated')).toBe('deprecated');
  });

  test('absent or unrecognized ⇒ stable (spec §5.4 default)', () => {
    expect(parseStatus(undefined)).toBe('stable');
    expect(parseStatus('retired')).toBe('stable');
  });
});

describe('parseGenerated', () => {
  test('reads by and at', () => {
    expect(parseGenerated({ by: 'reference_agent/gemini-2.5-pro', at: '2026-06-20T22:53:05Z' })).toEqual({
      by: 'reference_agent/gemini-2.5-pro',
      at: '2026-06-20T22:53:05Z',
    });
  });

  test('`by` is required within generated (spec §5.2)', () => {
    expect(parseGenerated({ at: '2026-06-20T22:53:05Z' })).toBeUndefined();
    expect(parseGenerated(undefined)).toBeUndefined();
  });
});

describe('parseSources', () => {
  test('reads an entry with its credibility signals', () => {
    expect(
      parseSources([
        {
          id: 'ga4-schema',
          resource: 'https://developers.google.com/analytics',
          title: 'GA4 export schema',
          author: 'team:ga4-docs',
          usage_count: 5000,
          last_modified: '2026-05-30',
        },
      ]),
    ).toEqual([
      {
        id: 'ga4-schema',
        resource: 'https://developers.google.com/analytics',
        title: 'GA4 export schema',
        author: 'team:ga4-docs',
        usageCount: 5000,
        lastModified: '2026-05-30',
      },
    ]);
  });

  test('a scope descriptor is a valid resource, not a link', () => {
    const [source] = parseSources([{ resource: 'all queries in BigQuery project X' }]);
    expect(source.resource).toBe('all queries in BigQuery project X');
  });

  test('entries without a resource are dropped — it is required within an entry', () => {
    expect(parseSources([{ id: 'x', title: 'No resource' }])).toEqual([]);
  });

  test('absent yields an empty array', () => {
    expect(parseSources(undefined)).toEqual([]);
  });
});
