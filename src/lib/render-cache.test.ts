import { describe, expect, test } from 'bun:test';
import { cachedCompute } from './render-cache';

describe('cachedCompute', () => {
  test('same scope + key returns the identical result and only computes once', () => {
    const scope = {};
    let calls = 0;
    const compute = () => {
      calls++;
      return { value: 'result' };
    };
    const first = cachedCompute(scope, 'k', compute);
    const second = cachedCompute(scope, 'k', compute);
    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  test('different scopes get separate entries even with the same key', () => {
    const scopeA = {};
    const scopeB = {};
    const a = cachedCompute(scopeA, 'k', () => ({ from: 'a' }));
    const b = cachedCompute(scopeB, 'k', () => ({ from: 'b' }));
    expect(a).not.toBe(b);
    expect(a).toEqual({ from: 'a' });
    expect(b).toEqual({ from: 'b' });
  });

  test('evicting beyond 100 entries re-computes the evicted key', () => {
    const scope = {};
    let firstKeyCalls = 0;
    cachedCompute(scope, 'key-0', () => {
      firstKeyCalls++;
      return 'first';
    });
    // Fill the cache with 100 more distinct keys, pushing 'key-0' out (FIFO).
    for (let i = 1; i <= 100; i++) {
      cachedCompute(scope, `key-${i}`, () => `value-${i}`);
    }
    cachedCompute(scope, 'key-0', () => {
      firstKeyCalls++;
      return 'first-again';
    });
    expect(firstKeyCalls).toBe(2);
  });
});
