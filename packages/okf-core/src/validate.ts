import fs from 'node:fs';
import path from 'node:path';
import { buildBundle, parseFrontmatter, RESERVED, type CoreBundle } from './core.ts';
import { analyzeBundle } from './health.ts';

/**
 * `okf-validate` — v0.1 conformance checker for an OKF bundle directory.
 * Node-only (fs/path); the library itself (core/tours/health) stays
 * browser-safe. Mirrors the semantics of the reference Python validator
 * (okf/scripts/validate_okf.py in lorsabyan/okf-skill):
 *   - missing or unparseable YAML frontmatter -> error
 *   - missing/empty `type` field -> error
 *   - timestamp present but not ISO-8601-shaped (`YYYY-MM-DD...`) -> warning
 *   - everything else analyzeBundle finds (broken links, missing
 *     descriptions, untyped, stale, undated, orphans) -> warnings
 *
 * This module is Node-only and is NOT re-exported from `./index.ts` (which
 * must stay importable in the browser); it is exposed as the `@okf/core/validate`
 * package subpath instead. `cli.ts` is a thin wrapper around `validateBundle`
 * that only handles argv parsing, printing, and the process exit code.
 */

// Mirrors the Python validator's ISO-8601-ish shape check: a leading YYYY-MM-DD.
const TIMESTAMP_SHAPE_RE = /^\d{4}-\d{2}-\d{2}/;

/** Recursively collect `.md` files under `dir`, keyed by path relative to `root` (posix separators). */
export function walk(dir: string, root: string, acc: Map<string, string> = new Map()): Map<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, acc);
    else if (entry.name.endsWith('.md')) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      acc.set(rel, fs.readFileSync(full, 'utf-8'));
    }
  }
  return acc;
}

/** True when `data.type` is missing, non-string, or blank/whitespace-only. */
function hasMissingOrEmptyType(data: Record<string, unknown>): boolean {
  const t = data.type;
  return typeof t !== 'string' || t.trim().length === 0;
}

export interface ValidationResult {
  bundle: CoreBundle;
  errors: string[];
  warnings: string[];
}

/** Read a bundle directory from disk and check it against the OKF v0.1 spec. */
export function validateBundle(dir: string): ValidationResult {
  const resolved = path.resolve(dir);
  const name = path.basename(resolved);
  const files = walk(resolved, resolved);
  const bundle = buildBundle(files, name);

  const errors: string[] = [];
  const timestampWarnings: string[] = [];
  // ids that were already reported via the explicit-type ERROR check below, so
  // analyzeBundle's `untyped` warning (which relies on core.ts's typeExplicit)
  // doesn't report the same concept twice.
  const explicitlyUntyped = new Set<string>();

  for (const [relPath, text] of files) {
    const base = relPath.slice(relPath.lastIndexOf('/') + 1);
    if (RESERVED.has(base)) continue;

    // Same parser buildBundle uses (BOM stripping, empty blocks, ...) — the
    // validator must never call a file malformed that the model reads fine.
    const parsed = parseFrontmatter(text);
    if (parsed.frontmatter !== 'ok') {
      errors.push(`${relPath}: missing or unparseable YAML frontmatter block`);
      continue;
    }

    const id = relPath.replace(/\.md$/, '');
    if (hasMissingOrEmptyType(parsed.data)) {
      errors.push(`${relPath}: frontmatter is missing a non-empty 'type' field`);
      explicitlyUntyped.add(id);
    }

    const timestamp = parsed.data.timestamp;
    if (timestamp != null && !TIMESTAMP_SHAPE_RE.test(String(timestamp))) {
      timestampWarnings.push(`${relPath}: 'timestamp' (${String(timestamp)}) does not look like ISO 8601`);
    }
  }

  const report = analyzeBundle(bundle);
  const warnings: string[] = [
    ...report.brokenLinks.map(({ fromId, target }) => `${fromId}: link to missing concept '${target}'`),
    ...report.missingDescriptions.map((id) => `${id}: no 'description' - index generators and previews rely on it`),
    ...report.untyped
      .filter((id) => !explicitlyUntyped.has(id))
      .map((id) => `${id}: frontmatter is missing a non-empty 'type' field (defaulted to 'Concept')`),
    ...timestampWarnings,
    ...report.stale.map(({ id, timestamp }) => `${id}: 'timestamp' (${timestamp}) is more than a year old`),
    ...report.undated.map((id) => `${id}: no 'timestamp' field`),
    ...report.orphans.map((id) => `${id}: orphan - no inbound or outbound links`),
  ];

  return { bundle, errors, warnings };
}
