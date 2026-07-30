import { describe, expect, test } from 'bun:test';
import { buildBundle } from './core.ts';
import { bundleFromJSON, bundleToJSON } from './serialize.ts';

const FILES = new Map([
  ['index.md', '# Metric\n\n* [A](a.md) - First.\n'],
  ['a.md', '---\ntype: Metric\ndescription: First.\ngenerated: { by: human:x, at: 2026-07-01T00:00:00Z }\n---\n\nSee [b](b.md).\n'],
  ['b.md', '---\ntype: Metric\ndescription: Second.\n---\n\nSee [a](a.md).\n'],
]);

describe('bundleToJSON', () => {
  test('survives JSON.stringify, which the raw bundle does not', () => {
    const bundle = buildBundle(FILES, 'test');
    // The failure this exists to prevent: Maps stringify to {}.
    expect(JSON.stringify(bundle.backlinks)).toBe('{}');
    const json = JSON.parse(JSON.stringify(bundleToJSON(bundle)));
    expect(json.backlinks['a']).toEqual(['b']);
    expect(Object.keys(json.files)).toHaveLength(3);
  });

  test('omits byId, which is an index rather than data', () => {
    expect(bundleToJSON(buildBundle(FILES, 'test'))).not.toHaveProperty('byId');
  });
});

describe('bundleFromJSON', () => {
  test('round-trips through JSON back to an equivalent bundle', () => {
    const original = buildBundle(FILES, 'test');
    const restored = bundleFromJSON(JSON.parse(JSON.stringify(bundleToJSON(original))));

    expect(restored.name).toBe(original.name);
    expect(restored.concepts.map((c) => c.id)).toEqual(original.concepts.map((c) => c.id));
    expect([...restored.byId.keys()]).toEqual([...original.byId.keys()]);
    expect([...restored.backlinks.entries()]).toEqual([...original.backlinks.entries()]);
    expect(restored.byId.get('a')!.updatedAt).toBe(original.byId.get('a')!.updatedAt);
  });

  test('rebuilds byId, which was never serialized', () => {
    const restored = bundleFromJSON(bundleToJSON(buildBundle(FILES, 'test')));
    expect(restored.byId.get('a')?.title).toBe('a');
  });

  test('re-derives the index rather than trusting a stale one', () => {
    // A hand-edited concepts/backlinks payload must not survive: files is the
    // source of truth, so the round-trip recomputes from it.
    const json = bundleToJSON(buildBundle(FILES, 'test'));
    json.backlinks = { a: ['nonexistent'] };
    json.concepts = [];
    const restored = bundleFromJSON(json);
    expect(restored.concepts).toHaveLength(2);
    expect(restored.backlinks.get('a')).toEqual(['b']);
  });
});
