import { describe, expect, test } from 'bun:test';
import { buildBundle } from './core.ts';
import { loadBundleFromDir, readBundleFiles } from './node.ts';

const DEMO = new URL('../../../example-bundle', import.meta.url).pathname;

describe('loadBundleFromDir', () => {
  test('loads the demo bundle from disk', () => {
    const bundle = loadBundleFromDir(DEMO);
    expect(bundle.name).toBe('example-bundle');
    expect(bundle.concepts.length).toBeGreaterThan(0);
    expect(bundle.byId.get('tables/events_')?.type).toBe('BigQuery Table');
  });

  test('matches building from the same files by hand', () => {
    // The point of this module: one implementation, not three near-identical
    // fs-walks. If it drifts from buildBundle over the same input, it is wrong.
    const viaLoader = loadBundleFromDir(DEMO);
    const viaFiles = buildBundle(readBundleFiles(DEMO), 'example-bundle');
    expect(viaLoader.concepts.map((c) => c.id)).toEqual(viaFiles.concepts.map((c) => c.id));
    expect([...viaLoader.backlinks.entries()]).toEqual([...viaFiles.backlinks.entries()]);
  });

  test('name defaults to the directory basename and can be overridden', () => {
    expect(loadBundleFromDir(DEMO).name).toBe('example-bundle');
    expect(loadBundleFromDir(DEMO, 'Custom').name).toBe('Custom');
  });

  test('skips hidden files and directories', () => {
    const files = readBundleFiles(DEMO);
    expect([...files.keys()].some((k) => k.split('/').some((p) => p.startsWith('.')))).toBe(false);
  });

  test('keys are bundle-relative posix paths', () => {
    const files = readBundleFiles(DEMO);
    expect([...files.keys()].every((k) => !k.startsWith('/') && !k.includes('\\'))).toBe(true);
  });
});
