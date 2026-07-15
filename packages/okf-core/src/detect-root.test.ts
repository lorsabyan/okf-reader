import { describe, expect, test } from 'bun:test';
import { detectBundleRoot } from './detect-root.ts';

describe('detectBundleRoot', () => {
  test('suggests the nested root when opened at a repo root above it (ai-tutor shape)', () => {
    const files = new Map([
      ['README.md', '# ai-tutor\n\nSee the knowledge base.'],
      ['knowledge/index.md', '# Knowledge base'],
      [
        'knowledge/concepts/intro.md',
        '---\ntype: Concept\n---\nSee [basics](/concepts/basics.md) and [advanced](/concepts/advanced.md).',
      ],
      [
        'knowledge/concepts/basics.md',
        '---\ntype: Concept\n---\nBack to [intro](/concepts/intro.md).',
      ],
      [
        'knowledge/concepts/advanced.md',
        '---\ntype: Concept\n---\nSee [intro](/concepts/intro.md) and [basics](/concepts/basics.md).',
      ],
    ]);

    const result = detectBundleRoot(files);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('knowledge');
    expect(result!.candidateResolved).toBeGreaterThan(result!.rootResolved);
    expect(result!.rootTotal).toBeGreaterThanOrEqual(3);
  });

  test('returns null for a well-rooted bundle whose absolute links already resolve', () => {
    const files = new Map([
      ['index.md', '# Root'],
      [
        'tables/orders.md',
        '---\ntype: Table\n---\nFK to [customers](/tables/customers.md) and [items](/tables/items.md).',
      ],
      ['tables/customers.md', '---\ntype: Table\n---\nSee [orders](/tables/orders.md).'],
      ['tables/items.md', '---\ntype: Table\n---\nSee [orders](/tables/orders.md).'],
    ]);

    expect(detectBundleRoot(files)).toBeNull();
  });

  test('returns null when there are no absolute links to judge by', () => {
    const files = new Map([
      ['index.md', '# Root'],
      ['tables/orders.md', '---\ntype: Table\n---\nSee [customers](./customers.md).'],
      ['tables/customers.md', '---\ntype: Table\n---\nSee [orders](./orders.md).'],
    ]);

    expect(detectBundleRoot(files)).toBeNull();
  });

  test('suggests a nested a/b candidate when the top-level dir holds only subdirectories (no direct files)', () => {
    // "repo" has no .md directly inside it — only the "pkg" subdirectory —
    // so candidatePrefixes should offer the nested "repo/pkg" candidate
    // (not just the top-level "repo" one), and it's the one whose stripped
    // ids actually match the absolute link targets.
    const files = new Map([
      ['README.md', '# repo'],
      [
        'repo/pkg/concepts/intro.md',
        '---\ntype: Concept\n---\nSee [basics](/concepts/basics.md) and [advanced](/concepts/advanced.md).',
      ],
      ['repo/pkg/concepts/basics.md', '---\ntype: Concept\n---\nBack to [intro](/concepts/intro.md).'],
      [
        'repo/pkg/concepts/advanced.md',
        '---\ntype: Concept\n---\nSee [intro](/concepts/intro.md) and [basics](/concepts/basics.md).',
      ],
    ]);

    const result = detectBundleRoot(files);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('repo/pkg');
    expect(result!.rootResolved).toBe(0);
    expect(result!.candidateResolved).toBe(result!.rootTotal);
  });

  test('accepts a candidate at exactly the 0.8 resolve-rate boundary (the check is `< 0.8`, so ==0.8 passes)', () => {
    // 5 total absolute links; under the "docs" candidate, 4 resolve and 1
    // dangles (points at a concept that was never written) — a 4/5 = 0.8
    // rate, which the strict `candidateRate < 0.8` rejection does NOT reject.
    const files = new Map([
      ['index.md', '# Root'],
      [
        'docs/concepts/a.md',
        '---\ntype: Concept\n---\nSee [b](/concepts/b.md), [c](/concepts/c.md), and [d](/concepts/d.md).',
      ],
      ['docs/concepts/b.md', '---\ntype: Concept\n---\nBack to [a](/concepts/a.md).'],
      ['docs/concepts/c.md', '---\ntype: Concept\n---\nBack to [a](/concepts/a.md).'],
    ]);

    const result = detectBundleRoot(files);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('docs');
    expect(result!.rootTotal).toBe(5);
    expect(result!.candidateResolved).toBe(4);
    expect(result!.candidateResolved / result!.rootTotal).toBe(0.8);
  });

  test('returns null when no candidate resolves any better than the root (all absolute links dangle everywhere)', () => {
    const files = new Map([
      ['index.md', '# Root'],
      [
        'docs/concepts/a.md',
        '---\ntype: Concept\n---\nSee [x](/concepts/nonexistent1.md), [y](/concepts/nonexistent2.md), and [z](/concepts/nonexistent3.md).',
      ],
    ]);

    expect(detectBundleRoot(files)).toBeNull();
  });
});
