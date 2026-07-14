import { load as parseYaml } from 'js-yaml';

/**
 * Source-agnostic OKF bundle model. Everything here runs in both Node
 * (build-time SSG) and the browser (runtime viewer) — no fs, no node:path.
 */

export const RESERVED = new Set(['index.md', 'log.md']);

// Matches inline markdown links/images: optional leading `!` (image marker),
// `[text](target)` with an optional `<angle-bracketed target>` form and an
// optional trailing `"title"`/`'title'`. Link text itself is not allowed to
// contain `]` — good enough for concept prose, no nested-bracket support.
const LINK_RE = /(!?)\[[^\]]*\]\(\s*(?:<([^>]*)>|([^\s()]*))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Extract raw markdown link targets (e.g. "tables/orders.md") from a concept body. */
export function extractLinkTargets(body: string): string[] {
  const targets: string[] = [];
  for (const m of body.matchAll(LINK_RE)) {
    if (m[1] === '!') continue; // image, not a concept link
    const raw = m[2] ?? m[3] ?? '';
    if (!raw) continue;
    const withoutFragment = raw.split('#')[0];
    if (!withoutFragment.endsWith('.md')) continue;
    if (SCHEME_RE.test(withoutFragment) || withoutFragment.startsWith('//')) continue; // external
    targets.push(withoutFragment);
  }
  return targets;
}

/** True for reserved-file link targets (index/log) that never have a concept page. */
export function isReservedTarget(id: string): boolean {
  return id === 'index' || id.endsWith('/index') || id === 'log' || id.endsWith('/log');
}

export interface Concept {
  id: string; // path without .md, posix separators, e.g. "tables/events_"
  title: string;
  type: string;
  typeExplicit: boolean; // false when frontmatter had no `type` and it was defaulted
  description: string;
  resource?: string;
  tags: string[];
  timestamp?: string;
  body: string;
  outLinks: string[]; // concept ids this doc links to (existing only)
  steps?: string[]; // ordered concept ids, present for tour concepts (frontmatter `steps`)
}

export interface CoreBundle {
  name: string;
  concepts: Concept[];
  byId: Map<string, Concept>;
  backlinks: Map<string, string[]>; // id -> ids of concepts linking to it
  /** Raw file contents keyed by bundle-relative posix path (includes reserved files). */
  files: Map<string, string>;
}

/**
 * Minimal, browser-safe frontmatter split. Returns empty data when
 * absent/unparseable; `frontmatter` reports which of the three cases it
 * was ('ok' | 'invalid' YAML | 'none' at all), so strict consumers like
 * okf-validate can distinguish them without re-parsing.
 */
export function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
  frontmatter: 'ok' | 'invalid' | 'none';
} {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip leading BOM (Windows-authored files)
  const m = text.match(/^---\r?\n([\s\S]*?)(?:\r?\n)?---\r?\n?/);
  if (!m) return { data: {}, body: text, frontmatter: 'none' };
  // js-yaml throws on an empty document; an empty `---\n---` block is a
  // well-formed frontmatter delimiter with no fields, not invalid YAML.
  if (!m[1].trim()) return { data: {}, body: text.slice(m[0].length), frontmatter: 'ok' };
  try {
    const data = parseYaml(m[1]);
    return {
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      body: text.slice(m[0].length),
      frontmatter: 'ok',
    };
  } catch {
    return { data: {}, body: text.slice(m[0].length), frontmatter: 'invalid' };
  }
}

/**
 * Normalize a posix-ish path: resolves '.' and '..', collapses slashes.
 * A '..' that would climb above the segments collected so far is kept
 * verbatim (not clamped) so the result stays a path that escapes the
 * bundle root — that can never match a real concept id, so callers'
 * `exists()` checks correctly flag it as broken instead of it silently
 * (and wrongly) resolving to some unrelated root-level concept.
 */
function normalizePosix(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else out.push(part);
  }
  return out.join('/');
}

/** Resolve a markdown link target to a concept id, relative to the linking doc. */
export function resolveLink(target: string, fromId: string): string {
  const clean = target.split('#')[0].replace(/\.md$/, '');
  if (clean.startsWith('/')) return normalizePosix(clean);
  const fromDir = fromId.includes('/') ? fromId.slice(0, fromId.lastIndexOf('/')) : '';
  return normalizePosix(`${fromDir}/${clean}`);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Build a bundle from raw file contents (bundle-relative posix paths). */
export function buildBundle(files: Map<string, string>, name: string): CoreBundle {
  const concepts: Concept[] = [];
  for (const [path, text] of files) {
    if (!path.endsWith('.md') || RESERVED.has(baseName(path))) continue;
    if (path.split('/').some((part) => part.startsWith('.'))) continue;
    const id = path.replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(text);
    const typeExplicit = typeof data.type === 'string' && data.type.trim() !== '';
    concepts.push({
      id,
      title: typeof data.title === 'string' ? data.title : id.split('/').pop()!,
      type: typeExplicit ? (data.type as string) : 'Concept',
      typeExplicit,
      description: typeof data.description === 'string' ? data.description : '',
      resource: typeof data.resource === 'string' ? data.resource : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      timestamp: data.timestamp != null ? String(data.timestamp) : undefined,
      body,
      outLinks: [],
      steps: Array.isArray(data.steps) ? data.steps.map(String) : undefined,
    });
  }

  const byId = new Map(concepts.map((c) => [c.id, c]));
  const backlinks = new Map<string, string[]>();
  for (const c of concepts) {
    const seen = new Set<string>();
    for (const raw of extractLinkTargets(c.body)) {
      const target = resolveLink(raw, c.id);
      if (target !== c.id && byId.has(target) && !seen.has(target)) {
        seen.add(target);
        c.outLinks.push(target);
        backlinks.set(target, [...(backlinks.get(target) ?? []), c.id]);
      }
    }
  }

  concepts.sort((a, b) => a.id.localeCompare(b.id));
  return { name, concepts, byId, backlinks, files };
}

/** Group concepts by their top-level directory for navigation. */
export function navGroups(bundle: Pick<CoreBundle, 'concepts'>): { group: string; items: Concept[] }[] {
  const groups = new Map<string, Concept[]>();
  for (const c of bundle.concepts) {
    const g = c.id.includes('/') ? c.id.slice(0, c.id.indexOf('/')) : '(root)';
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({ group, items }));
}
