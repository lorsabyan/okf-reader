import { describe, expect, test } from 'bun:test';
import { buildBundle } from './core.ts';
import { analyzeBundle } from './health.ts';

describe('analyzeBundle', () => {
  const files = new Map([
    ['index.md', '# Root'],
    // typed, described, links to a real concept (orders) -> not orphan, not stale (recent).
    [
      'tables/customers.md',
      `---\ntype: Table\ndescription: Customers.\ntimestamp: ${new Date().toISOString()}\n---\nSee [orders](./orders.md).`,
    ],
    // linked-to by customers -> has inbound; also links to a broken target and a reserved one.
    [
      'tables/orders.md',
      `---\ntype: Table\ndescription: Orders.\ntimestamp: ${new Date().toISOString()}\n---\nBroken ref to [missing](./missing.md) and see [log](./log.md).`,
    ],
    // no explicit type -> untyped; no description -> missingDescriptions; no timestamp -> undated; no links either way -> orphan.
    ['tables/untouched.md', 'Just a body, no frontmatter at all.'],
    // explicit type but stale timestamp (>365 days old); links to customers so it's not an orphan.
    ['tables/ancient.md', '---\ntype: Table\ndescription: Old.\ntimestamp: 2000-01-01\n---\nSee [customers](./customers.md).'],
  ]);
  const bundle = buildBundle(files, 'test');
  const report = analyzeBundle(bundle);

  test('flags broken links but not reserved (index/log) targets', () => {
    expect(report.brokenLinks).toEqual([{ fromId: 'tables/orders', target: 'tables/missing' }]);
  });

  test('flags concepts with empty description', () => {
    expect(report.missingDescriptions).toContain('tables/untouched');
    expect(report.missingDescriptions).not.toContain('tables/orders');
  });

  test('flags concepts with no explicit frontmatter type', () => {
    expect(report.untyped).toEqual(['tables/untouched']);
  });

  test('flags stale concepts (>365 days old), sorted oldest first', () => {
    expect(report.stale).toEqual([{ id: 'tables/ancient', timestamp: '2000-01-01' }]);
  });

  test('lists undated concepts separately from stale ones', () => {
    expect(report.undated).toEqual(['tables/untouched']);
  });

  test('flags orphans (no inbound and no outbound links)', () => {
    expect(report.orphans).toEqual(['tables/untouched']);
  });

  test('customers has outbound only, orders has both -> neither is an orphan', () => {
    expect(report.orphans).not.toContain('tables/customers');
    expect(report.orphans).not.toContain('tables/orders');
  });
});
