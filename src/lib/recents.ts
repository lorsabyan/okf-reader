/**
 * "Recent bundles" list for the /open landing page. Persisted to
 * localStorage as a capped, deduped, most-recent-first JSON array.
 * Local entries additionally get a FileSystemDirectoryHandle stashed in
 * IndexedDB (see idb-handles.ts) when the File System Access API was used.
 */

export interface GithubRecentEntry {
  kind: 'github';
  src: string; // formatGithubRef(ref)
  name: string;
  openedAt: number;
}

export interface LocalRecentEntry {
  kind: 'local';
  name: string;
  openedAt: number;
}

export type RecentEntry = GithubRecentEntry | LocalRecentEntry;

export const MAX_RECENTS = 8;
const STORAGE_KEY = 'okf-recent-bundles';

/** Identity used for de-duplication: same GitHub source, or same local name. */
function identity(e: RecentEntry): string {
  return e.kind === 'github' ? `github:${e.src}` : `local:${e.name}`;
}

/** Pure: move-to-front an entry (replacing any existing match), capped at MAX_RECENTS. */
export function upsertRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  const key = identity(entry);
  return [entry, ...list.filter((e) => identity(e) !== key)].slice(0, MAX_RECENTS);
}

/** Pure: drop entries matching a predicate. */
export function removeRecent(list: RecentEntry[], predicate: (e: RecentEntry) => boolean): RecentEntry[] {
  return list.filter((e) => !predicate(e));
}

function isRecentEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  if (typeof e.name !== 'string' || typeof e.openedAt !== 'number') return false;
  if (e.kind === 'github') return typeof e.src === 'string';
  return e.kind === 'local';
}

function readAll(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter(isRecentEntry) : [];
  } catch {
    return [];
  }
}

function writeAll(list: RecentEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getRecents(): RecentEntry[] {
  return readAll();
}

export function recordGithubRecent(src: string, name: string): RecentEntry[] {
  const list = upsertRecent(readAll(), { kind: 'github', src, name, openedAt: Date.now() });
  writeAll(list);
  return list;
}

export function recordLocalRecent(name: string): RecentEntry[] {
  const list = upsertRecent(readAll(), { kind: 'local', name, openedAt: Date.now() });
  writeAll(list);
  return list;
}

export function deleteRecent(predicate: (e: RecentEntry) => boolean): RecentEntry[] {
  const list = removeRecent(readAll(), predicate);
  writeAll(list);
  return list;
}

/** "2 h ago" / "just now" / "3 d ago" — no date-fns, just enough for this list. */
export function relativeTime(fromMs: number, nowMs = Date.now()): string {
  const diff = Math.max(0, nowMs - fromMs);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days} d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} y ago`;
}
