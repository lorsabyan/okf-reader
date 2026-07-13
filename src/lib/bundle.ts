import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const RESERVED = new Set(['index.md', 'log.md']);
const LINK_RE = /\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g;

export interface Concept {
  id: string; // path without .md, posix separators, e.g. "tables/events_"
  title: string;
  type: string;
  description: string;
  resource?: string;
  tags: string[];
  timestamp?: string;
  body: string;
  outLinks: string[]; // concept ids this doc links to (existing only)
}

export interface Bundle {
  name: string;
  dir: string;
  concepts: Concept[];
  byId: Map<string, Concept>;
  backlinks: Map<string, string[]>; // id -> ids of concepts linking to it
}

function walk(dir: string, root: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, acc);
    else if (entry.name.endsWith('.md') && !RESERVED.has(entry.name)) acc.push(full);
  }
  return acc;
}

/** Resolve a markdown link target to a concept id, relative to the linking doc. */
export function resolveLink(target: string, fromId: string): string {
  const clean = target.replace(/\.md$/, '');
  if (clean.startsWith('/')) return clean.slice(1);
  const fromDir = fromId.includes('/') ? fromId.slice(0, fromId.lastIndexOf('/')) : '';
  return path.posix.normalize(path.posix.join(fromDir, clean));
}

let cached: Bundle | null = null;

export function loadBundle(): Bundle {
  if (cached) return cached;
  const dir = path.resolve(process.env.OKF_BUNDLE ?? path.join(process.cwd(), 'example-bundle'));
  const name = process.env.OKF_BUNDLE_NAME ?? path.basename(dir);

  const concepts: Concept[] = walk(dir, dir).map((file) => {
    const id = path.relative(dir, file).split(path.sep).join('/').replace(/\.md$/, '');
    const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
    return {
      id,
      title: (data.title as string) ?? id.split('/').pop()!,
      type: (data.type as string) ?? 'Concept',
      description: (data.description as string) ?? '',
      resource: data.resource as string | undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      timestamp: data.timestamp ? String(data.timestamp) : undefined,
      body: content,
      outLinks: [],
    };
  });

  const byId = new Map(concepts.map((c) => [c.id, c]));
  const backlinks = new Map<string, string[]>();
  for (const c of concepts) {
    const seen = new Set<string>();
    for (const m of c.body.matchAll(LINK_RE)) {
      const target = resolveLink(m[1], c.id);
      if (target !== c.id && byId.has(target) && !seen.has(target)) {
        seen.add(target);
        c.outLinks.push(target);
        backlinks.set(target, [...(backlinks.get(target) ?? []), c.id]);
      }
    }
  }

  concepts.sort((a, b) => a.id.localeCompare(b.id));
  cached = { name, dir, concepts, byId, backlinks };
  return cached;
}

/** Group concepts by their top-level directory for navigation. */
export function navGroups(bundle: Bundle): { group: string; items: Concept[] }[] {
  const groups = new Map<string, Concept[]>();
  for (const c of bundle.concepts) {
    const g = c.id.includes('/') ? c.id.slice(0, c.id.indexOf('/')) : '(root)';
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({ group, items }));
}
