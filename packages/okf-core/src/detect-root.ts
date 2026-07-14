import { RESERVED, extractLinkTargets, isReservedTarget, parseFrontmatter, resolveLink } from './core.ts';

/**
 * Detects when a file map's "real" bundle root is a subdirectory of what
 * was opened — e.g. someone points the reader at a repo root `ai-tutor/`
 * whose actual bundle lives in `ai-tutor/knowledge/`. Every bundle-absolute
 * link (`/concepts/x.md`) then dangles under the wrong root, even though
 * the bundle is internally consistent once re-rooted.
 *
 * Browser-safe: no node imports, no dependency on CoreBundle construction.
 */

export interface DetectedRoot {
  prefix: string;
  rootResolved: number;
  rootTotal: number;
  candidateResolved: number;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function isHidden(path: string): boolean {
  return path.split('/').some((part) => part.startsWith('.'));
}

/** True for a markdown file path that yields a real concept doc (mirrors buildBundle's filter). */
function isConceptPath(path: string): boolean {
  return path.endsWith('.md') && !RESERVED.has(baseName(path)) && !isHidden(path);
}

/** Concept ids (path minus .md) for files under `prefix` (prefix stripped), or all of them when prefix is ''. */
function conceptIdsUnder(paths: string[], prefix: string): Set<string> {
  const ids = new Set<string>();
  const strip = prefix ? `${prefix}/` : '';
  for (const p of paths) {
    if (prefix && !p.startsWith(strip)) continue;
    const rel = prefix ? p.slice(strip.length) : p;
    if (!rel || !isConceptPath(rel)) continue;
    ids.add(rel.replace(/\.md$/, ''));
  }
  return ids;
}

/**
 * Candidate root prefixes: every top-level directory, plus (for a
 * top-level dir that holds only subdirectories, no files directly inside
 * it) each of its immediate subdirectories as a nested `a/b` candidate.
 */
function candidatePrefixes(allPaths: string[]): string[] {
  const topRest = new Map<string, string[]>();
  for (const p of allPaths) {
    const idx = p.indexOf('/');
    if (idx === -1) continue;
    const dir = p.slice(0, idx);
    const rest = p.slice(idx + 1);
    if (!topRest.has(dir)) topRest.set(dir, []);
    topRest.get(dir)!.push(rest);
  }

  const candidates: string[] = [...topRest.keys()];
  for (const [dir, rests] of topRest) {
    const hasDirectFile = rests.some((r) => !r.includes('/'));
    if (hasDirectFile) continue; // dir has files directly in it, not "only directories"
    const subdirs = new Set<string>();
    for (const r of rests) {
      const i = r.indexOf('/');
      if (i !== -1) subdirs.add(r.slice(0, i));
    }
    for (const sub of subdirs) candidates.push(`${dir}/${sub}`);
  }
  return candidates;
}

/**
 * Suggest a better bundle root when the opened root's absolute
 * (`/...`) cross-links mostly dangle but would mostly resolve under a
 * subdirectory. Returns null when the root already looks fine, when
 * there aren't enough absolute links to judge (< 3), or when no
 * candidate is convincingly better.
 */
export function detectBundleRoot(files: Map<string, string>): DetectedRoot | null {
  const allPaths = [...files.keys()];
  const conceptPaths = allPaths.filter(isConceptPath);

  // Absolute link targets across every concept body in the map, resolved
  // to ids (fromId is irrelevant for absolute targets) and stripped of
  // reserved targets (index/log — always legal, never "resolve" to a page).
  const linkIds: string[] = [];
  for (const path of conceptPaths) {
    const { body } = parseFrontmatter(files.get(path)!);
    for (const target of extractLinkTargets(body)) {
      if (!target.startsWith('/')) continue;
      const id = resolveLink(target, '');
      if (isReservedTarget(id)) continue;
      linkIds.push(id);
    }
  }

  const rootTotal = linkIds.length;
  if (rootTotal < 3) return null;

  const rootIds = conceptIdsUnder(allPaths, '');
  const rootResolved = linkIds.filter((id) => rootIds.has(id)).length;
  const rootRate = rootResolved / rootTotal;
  if (rootRate >= 0.5) return null;

  let best: DetectedRoot | null = null;
  for (const prefix of candidatePrefixes(allPaths)) {
    const candidateIds = conceptIdsUnder(allPaths, prefix);
    const candidateResolved = linkIds.filter((id) => candidateIds.has(id)).length;
    const candidateRate = candidateResolved / rootTotal;
    if (candidateRate < 0.8) continue;
    if (candidateResolved <= rootResolved) continue;
    if (!best || candidateResolved > best.candidateResolved) {
      best = { prefix, rootResolved, rootTotal, candidateResolved };
    }
  }
  return best;
}
