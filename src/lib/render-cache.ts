/**
 * Per-scope memo for expensive pure computations (markdown renders).
 * Keyed by an owning object (e.g. the loaded bundle) via WeakMap so a
 * replaced bundle's cache is garbage-collected wholesale; within a scope,
 * insertion-order FIFO eviction beyond MAX_ENTRIES.
 */
const caches = new WeakMap<object, Map<string, unknown>>();
const MAX_ENTRIES = 100;

export function cachedCompute<T>(scope: object, key: string, compute: () => T): T {
  let cache = caches.get(scope);
  if (!cache) {
    cache = new Map();
    caches.set(scope, cache);
  }
  if (cache.has(key)) return cache.get(key) as T;
  const value = compute();
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
  return value;
}
