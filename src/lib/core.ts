import { load as parseYaml } from 'js-yaml';

/**
 * Source-agnostic OKF bundle model. Everything here runs in both Node
 * (build-time SSG) and the browser (runtime viewer) — no fs, no node:path.
 */

export const RESERVED = new Set(['index.md', 'log.md']);
const LINK_RE = /\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g;

/** Extract raw markdown link targets (e.g. "tables/orders.md") from a concept body. */
export function extractLinkTargets(body: string): string[] {
  return [...body.matchAll(LINK_RE)].map((m) => m[1]);
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
}

export interface CoreBundle {
  name: string;
  concepts: Concept[];
  byId: Map<string, Concept>;
  backlinks: Map<string, string[]>; // id -> ids of concepts linking to it
  /** Raw file contents keyed by bundle-relative posix path (includes reserved files). */
  files: Map<string, string>;
}

/** Minimal, browser-safe frontmatter split. Returns empty data when absent/unparseable. */
export function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  try {
    const data = parseYaml(m[1]);
    return {
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      body: text.slice(m[0].length),
    };
  } catch {
    return { data: {}, body: text.slice(m[0].length) };
  }
}

/** Normalize a posix-ish path: resolves '.' and '..', collapses slashes. */
function normalizePosix(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Resolve a markdown link target to a concept id, relative to the linking doc. */
export function resolveLink(target: string, fromId: string): string {
  const clean = target.replace(/\.md$/, '');
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
    concepts.push({
      id,
      title: typeof data.title === 'string' ? data.title : id.split('/').pop()!,
      type: typeof data.type === 'string' ? data.type : 'Concept',
      typeExplicit: typeof data.type === 'string',
      description: typeof data.description === 'string' ? data.description : '',
      resource: typeof data.resource === 'string' ? data.resource : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      timestamp: data.timestamp != null ? String(data.timestamp) : undefined,
      body,
      outLinks: [],
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
