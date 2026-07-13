import { describe, expect, test } from 'bun:test';
import type { Concept } from '@okf/core';
import { searchBundle } from './search-bundle';

function concept(overrides: Partial<Concept> & Pick<Concept, 'id'>): Concept {
  return {
    title: overrides.id,
    type: 'Concept',
    typeExplicit: true,
    description: '',
    tags: [],
    body: '',
    outLinks: [],
    ...overrides,
  };
}

describe('searchBundle', () => {
  test('empty query returns no hits', () => {
    const bundle = { concepts: [concept({ id: 'a', title: 'Alpha', body: 'alpha body' })] };
    expect(searchBundle(bundle, '')).toEqual([]);
    expect(searchBundle(bundle, '   ')).toEqual([]);
  });

  test('ranks a title match above a body-only match', () => {
    const bundle = {
      concepts: [
        concept({ id: 'a', title: 'Something else', body: 'mentions pageviews once in passing' }),
        concept({ id: 'b', title: 'Average Pageviews', body: 'no relevant terms here' }),
      ],
    };
    const hits = searchBundle(bundle, 'pageviews');
    expect(hits[0].id).toBe('b');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  test('multiple query words are ANDed across the concept', () => {
    const bundle = {
      concepts: [
        concept({ id: 'both', title: 'Event Count', description: 'total pageviews per session' }),
        concept({ id: 'one-only', title: 'Pageviews only', description: 'nothing else matches' }),
      ],
    };
    const hits = searchBundle(bundle, 'pageviews session');
    expect(hits.map((h) => h.id)).toEqual(['both']);
  });

  test('excerpt highlights the match and escapes HTML found in the body', () => {
    const bundle = {
      concepts: [
        concept({
          id: 'unsafe',
          title: 'Unsafe',
          body: 'before <script>alert(1)</script> pageviews after',
        }),
      ],
    };
    const [hit] = searchBundle(bundle, 'pageviews');
    expect(hit.excerptHtml).toContain('<mark>pageviews</mark>');
    expect(hit.excerptHtml).not.toContain('<script>');
    expect(hit.excerptHtml).toContain('&lt;script&gt;');
  });

  test('falls back to the description when the match is not in the body', () => {
    const bundle = {
      concepts: [
        concept({
          id: 'desc-only',
          title: 'Desc only',
          description: 'covers pageviews conceptually',
          body: 'the body never mentions the term',
        }),
      ],
    };
    const [hit] = searchBundle(bundle, 'pageviews');
    expect(hit.excerptHtml).toContain('<mark>pageviews</mark>');
    expect(hit.excerptHtml).not.toContain('body never mentions');
  });

  test('respects the limit', () => {
    const bundle = {
      concepts: Array.from({ length: 20 }, (_, i) => concept({ id: `c${i}`, title: `Pageviews ${i}` })),
    };
    expect(searchBundle(bundle, 'pageviews', 3)).toHaveLength(3);
    expect(searchBundle(bundle, 'pageviews')).toHaveLength(8);
  });
});
