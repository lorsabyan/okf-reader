import { describe, expect, test } from 'bun:test';
import type { Concept } from '@okf/core';
import { buildBundleIndex, searchBundle } from './search-bundle';

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

describe('buildBundleIndex', () => {
  test('lowercases every field, keyed by the concept id', () => {
    const bundle = {
      concepts: [
        concept({
          id: 'Tables/Orders',
          title: 'Orders TABLE',
          type: 'Table',
          description: 'A Dataset OF Orders',
          tags: ['Sales', 'CORE'],
          body: 'Some BODY text with Pageviews',
        }),
      ],
    };
    const index = buildBundleIndex(bundle);
    const entry = index.get('Tables/Orders')!;
    expect(entry.title).toBe('orders table');
    expect(entry.id).toBe('tables/orders');
    expect(entry.type).toBe('table');
    expect(entry.description).toBe('a dataset of orders');
    expect(entry.tags).toEqual(['sales', 'core']);
    expect(entry.tagsAndType).toBe('sales core table');
    expect(entry.body).toBe('some body text with pageviews');
    expect(entry.combined).toBe('orders table a dataset of orders sales core table some body text with pageviews');
  });

  test('searchBundle with a precomputed index returns identical results to computing it internally', () => {
    const bundle = {
      concepts: [
        concept({ id: 'a', title: 'Something else', body: 'mentions pageviews once in passing' }),
        concept({ id: 'b', title: 'Average Pageviews', description: 'total pageviews per session' }),
        concept({ id: 'c', title: 'Unrelated', body: 'no relevant terms here' }),
      ],
    };
    const index = buildBundleIndex(bundle);
    expect(searchBundle(bundle, 'pageviews', 8, index)).toEqual(searchBundle(bundle, 'pageviews'));
    expect(searchBundle(bundle, 'pageviews session', 8, index)).toEqual(searchBundle(bundle, 'pageviews session'));
  });
});
