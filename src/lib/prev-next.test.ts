import { describe, expect, test } from 'bun:test';
import { buildBundle } from '@okf/core';
import { prevNextInGroup } from './prev-next';

// Two nav groups ("tables" and "metrics") built via buildBundle, mirroring
// the fixture pattern in packages/okf-core/src/core.test.ts. navGroups
// sorts concepts alphabetically by id within each group, so within
// "tables" the order is a, b, c.
function fixtureBundle() {
  const files = new Map([
    ['tables/a.md', '---\ntype: Table\n---\nFirst table.'],
    ['tables/b.md', '---\ntype: Table\n---\nSecond table.'],
    ['tables/c.md', '---\ntype: Table\n---\nThird table.'],
    ['metrics/x.md', '---\ntype: Metric\n---\nOnly metric.'],
  ]);
  return buildBundle(files, 'test');
}

describe('prevNextInGroup', () => {
  test('a middle item gets both a prev and a next within its group', () => {
    const bundle = fixtureBundle();
    expect(prevNextInGroup(bundle, 'tables/b')).toEqual({
      prev: { id: 'tables/a', title: 'a' },
      next: { id: 'tables/c', title: 'c' },
    });
  });

  test('the first item in a group has no prev', () => {
    const bundle = fixtureBundle();
    const result = prevNextInGroup(bundle, 'tables/a');
    expect(result.prev).toBeUndefined();
    expect(result.next).toEqual({ id: 'tables/b', title: 'b' });
  });

  test('the last item in a group has no next', () => {
    const bundle = fixtureBundle();
    const result = prevNextInGroup(bundle, 'tables/c');
    expect(result.next).toBeUndefined();
    expect(result.prev).toEqual({ id: 'tables/b', title: 'b' });
  });

  test('a single-item group has neither prev nor next', () => {
    const bundle = fixtureBundle();
    expect(prevNextInGroup(bundle, 'metrics/x')).toEqual({});
  });

  test('an unknown concept id resolves to an empty result', () => {
    const bundle = fixtureBundle();
    expect(prevNextInGroup(bundle, 'tables/does-not-exist')).toEqual({});
  });

  test('prev/next never cross group boundaries', () => {
    // "tables/c" has no next even though "metrics/x" exists in the bundle —
    // groups (top-level directories) are a hard boundary.
    const bundle = fixtureBundle();
    expect(prevNextInGroup(bundle, 'tables/c').next).toBeUndefined();
    expect(prevNextInGroup(bundle, 'metrics/x')).toEqual({});
  });
});
