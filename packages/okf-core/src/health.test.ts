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

  test('flags aging concepts (>365 days since updatedAt), sorted oldest first', () => {
    expect(report.aging).toEqual([{ id: 'tables/ancient', updatedAt: '2000-01-01' }]);
  });

  test('an old concept is aging, not stale — nothing here sets stale_after', () => {
    expect(report.stale).toEqual([]);
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

describe('analyzeBundle v0.2 lifecycle', () => {
  const AT = '2026-06-20T22:53:05Z';
  const now = new Date('2026-07-30T12:00:00Z');
  const build = (files: Record<string, string>) =>
    analyzeBundle(buildBundle(new Map(Object.entries(files)), 'test'), now);

  test('stale comes from stale_after, not from age', () => {
    const report = build({
      'a.md': `---\ntype: Metric\ndescription: d\ngenerated: { by: human:x, at: ${AT} }\nstale_after: 2026-06-30\n---\nB.`,
      'b.md': `---\ntype: Metric\ndescription: d\ngenerated: { by: human:x, at: ${AT} }\nstale_after: 2026-12-31\n---\nB.`,
    });
    expect(report.stale).toEqual([{ id: 'a', staleSince: '2026-06-30' }]);
    expect(report.aging).toEqual([]);
  });

  test('a freshly generated concept past its stale_after is stale but not aging', () => {
    const report = build({
      'a.md': `---\ntype: Metric\ndescription: d\ngenerated: { by: human:x, at: ${AT} }\nstale_after: 2026-07-01\n---\nB.`,
    });
    expect(report.stale.map((s) => s.id)).toEqual(['a']);
    expect(report.aging).toEqual([]);
  });

  test('an ancient concept with a future stale_after is aging but not stale', () => {
    const report = build({
      'a.md': '---\ntype: Metric\ndescription: d\ngenerated: { by: human:x, at: 2020-01-01T00:00:00Z }\nstale_after: 2030-01-01\n---\nB.',
    });
    expect(report.stale).toEqual([]);
    expect(report.aging.map((a) => a.id)).toEqual(['a']);
  });

  test('a v0.2 concept with generated.at is not undated', () => {
    const report = build({
      'a.md': `---\ntype: Metric\ndescription: d\ngenerated: { by: human:x, at: ${AT} }\n---\nB.`,
    });
    expect(report.undated).toEqual([]);
  });

  test('a v0.1 concept with only a timestamp is still dated', () => {
    const report = build({ 'a.md': `---\ntype: Metric\ndescription: d\ntimestamp: ${AT}\n---\nB.` });
    expect(report.undated).toEqual([]);
  });

  test('only a concept with neither date is undated', () => {
    expect(build({ 'a.md': '---\ntype: Metric\ndescription: d\n---\nB.' }).undated).toEqual(['a']);
  });

  test('unverified and deprecated are reported from the trust and lifecycle families', () => {
    const report = build({
      'a.md': `---\ntype: Metric\ndescription: d\nstatus: deprecated\nverified: { by: human:x, at: ${AT} }\n---\nB.`,
      'b.md': '---\ntype: Metric\ndescription: d\n---\nB.',
    });
    expect(report.deprecated).toEqual(['a']);
    expect(report.unverified).toEqual(['b']);
  });

  test('the report is stable as the clock moves, given an injected now', () => {
    const files = { 'a.md': '---\ntype: Metric\ndescription: d\nstale_after: 2026-08-01\n---\nB.' };
    const before = analyzeBundle(buildBundle(new Map(Object.entries(files)), 't'), new Date('2026-07-31T00:00:00Z'));
    const after = analyzeBundle(buildBundle(new Map(Object.entries(files)), 't'), new Date('2026-08-01T00:00:00Z'));
    expect(before.stale).toEqual([]);
    expect(after.stale).toEqual([{ id: 'a', staleSince: '2026-08-01' }]);
  });
});
