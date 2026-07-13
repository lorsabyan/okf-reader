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
});
