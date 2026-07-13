import { describe, expect, test } from 'bun:test';
import { loadBundle, navGroups, resolveLink } from './bundle';

describe('resolveLink', () => {
  test('bundle-absolute links resolve from root', () => {
    expect(resolveLink('/tables/customers.md', 'datasets/sales')).toBe('tables/customers');
  });

  test('relative links resolve against the linking doc directory', () => {
    expect(resolveLink('./customers.md', 'tables/orders')).toBe('tables/customers');
    expect(resolveLink('../datasets/sales.md', 'tables/orders')).toBe('datasets/sales');
  });

  test('root-level concepts resolve relative siblings', () => {
    expect(resolveLink('./other.md', 'readme-ish')).toBe('other');
  });
});

describe('loadBundle (example-bundle)', () => {
  const bundle = loadBundle();

  test('loads concepts with required type field', () => {
    expect(bundle.concepts.length).toBeGreaterThan(0);
    for (const c of bundle.concepts) expect(c.type).toBeTruthy();
  });

  test('reserved files are not concepts', () => {
    for (const c of bundle.concepts) {
      expect(c.id.endsWith('/index')).toBe(false);
      expect(c.id).not.toBe('index');
    }
  });

  test('backlinks are the reverse of outLinks', () => {
    for (const c of bundle.concepts) {
      for (const target of c.outLinks) {
        expect(bundle.backlinks.get(target)).toContain(c.id);
      }
    }
  });

  test('navGroups covers every concept exactly once', () => {
    const total = navGroups(bundle).reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(bundle.concepts.length);
  });
});
