import { describe, expect, test } from 'bun:test';
import { MAX_RECENTS, relativeTime, removeRecent, upsertRecent, type RecentEntry } from './recents';

describe('upsertRecent', () => {
  test('adds a new entry to the front', () => {
    const list: RecentEntry[] = [{ kind: 'local', name: 'a', openedAt: 1 }];
    const next = upsertRecent(list, { kind: 'local', name: 'b', openedAt: 2 });
    expect(next.map((e) => e.name)).toEqual(['b', 'a']);
  });

  test('dedupes a github entry by src, moving it to the front and refreshing it', () => {
    const list: RecentEntry[] = [
      { kind: 'github', src: 'owner/repo', name: 'repo', openedAt: 1 },
      { kind: 'local', name: 'a', openedAt: 2 },
    ];
    const next = upsertRecent(list, { kind: 'github', src: 'owner/repo', name: 'repo', openedAt: 99 });
    expect(next).toEqual([
      { kind: 'github', src: 'owner/repo', name: 'repo', openedAt: 99 },
      { kind: 'local', name: 'a', openedAt: 2 },
    ]);
  });

  test('dedupes local entries by name, not by kind alone', () => {
    const list: RecentEntry[] = [{ kind: 'local', name: 'bundle', openedAt: 1 }];
    const next = upsertRecent(list, { kind: 'local', name: 'bundle', openedAt: 2 });
    expect(next).toHaveLength(1);
    expect(next[0].openedAt).toBe(2);
  });

  test('a github entry and a local entry with the same name are distinct', () => {
    const list: RecentEntry[] = [{ kind: 'local', name: 'shared', openedAt: 1 }];
    const next = upsertRecent(list, { kind: 'github', src: 'o/shared', name: 'shared', openedAt: 2 });
    expect(next).toHaveLength(2);
  });

  test('caps the list at MAX_RECENTS, dropping the oldest', () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) {
      list = upsertRecent(list, { kind: 'local', name: `b${i}`, openedAt: i });
    }
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].name).toBe(`b${MAX_RECENTS + 2}`);
    expect(list.map((e) => e.name)).not.toContain('b0');
  });
});

describe('removeRecent', () => {
  test('drops entries matching the predicate', () => {
    const list: RecentEntry[] = [
      { kind: 'local', name: 'a', openedAt: 1 },
      { kind: 'local', name: 'b', openedAt: 2 },
    ];
    expect(removeRecent(list, (e) => e.name === 'a')).toEqual([{ kind: 'local', name: 'b', openedAt: 2 }]);
  });
});

describe('relativeTime', () => {
  const now = 1_000_000_000;

  test('just now for sub-minute gaps', () => {
    expect(relativeTime(now - 10_000, now)).toBe('just now');
  });

  test('minutes', () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
  });

  test('hours', () => {
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
  });

  test('days', () => {
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2 d ago');
  });
});
