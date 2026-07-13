import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { buildBundle, RESERVED, type CoreBundle } from './core.ts';
import { analyzeBundle } from './health.ts';

/**
 * `okf-validate` — v0.1 conformance checker for an OKF bundle directory.
 * Node-only (fs/path); the library itself (core/tours/health) stays
 * browser-safe. Mirrors the semantics of the reference Python validator
 * (okf/scripts/validate_okf.py in lorsabyan/okf-skill):
 *   - missing or unparseable YAML frontmatter -> error
 *   - missing/empty `type` field -> error
 *   - everything analyzeBundle finds (broken links, missing descriptions,
 *     untyped, stale, undated, orphans) -> warnings
 * Exit code: 1 on errors (or on warnings with --strict), 0 otherwise.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function walk(dir: string, root: string, acc: Map<string, string>): Map<string, string> {
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

/** Whether `text` has a well-formed `---\n...\n---` YAML frontmatter block. */
function hasValidFrontmatter(text: string): boolean {
  const m = text.match(FRONTMATTER_RE);
  if (!m) return false;
  try {
    parseYaml(m[1]);
    return true;
  } catch {
    return false;
  }
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
  const files = walk(resolved, resolved, new Map());
  const bundle = buildBundle(files, name);

  const errors: string[] = [];
  for (const [relPath, text] of files) {
    const base = relPath.slice(relPath.lastIndexOf('/') + 1);
    if (RESERVED.has(base)) continue;

    if (!hasValidFrontmatter(text)) {
      errors.push(`${relPath}: missing or unparseable YAML frontmatter block`);
      continue;
    }
    const id = relPath.replace(/\.md$/, '');
    const concept = bundle.byId.get(id);
    if (concept && !concept.typeExplicit) {
      errors.push(`${relPath}: frontmatter is missing a non-empty 'type' field`);
    }
  }

  const report = analyzeBundle(bundle);
  const warnings: string[] = [
    ...report.brokenLinks.map(({ fromId, target }) => `${fromId}: link to missing concept '${target}'`),
    ...report.missingDescriptions.map((id) => `${id}: no 'description' - index generators and previews rely on it`),
    ...report.untyped.map((id) => `${id}: frontmatter is missing a non-empty 'type' field (defaulted to 'Concept')`),
    ...report.stale.map(({ id, timestamp }) => `${id}: 'timestamp' (${timestamp}) is more than a year old`),
    ...report.undated.map((id) => `${id}: no 'timestamp' field`),
    ...report.orphans.map((id) => `${id}: orphan - no inbound or outbound links`),
  ];

  return { bundle, errors, warnings };
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  const strict = args.includes('--strict');
  const target = args.find((a) => !a.startsWith('--'));

  if (!target) {
    console.error('usage: okf-validate <bundle-dir> [--strict]');
    return 2;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`error: ${target} is not a directory`);
    return 2;
  }

  const { bundle, errors, warnings } = validateBundle(target);
  for (const msg of errors) console.log(`ERROR   ${msg}`);
  for (const msg of warnings) console.log(`warning ${msg}`);
  console.log(`\n${target}: ${bundle.concepts.length} concept doc(s), ${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length || (strict && warnings.length)) return 1;
  console.log('Bundle is conformant with OKF v0.1.');
  return 0;
}

// Always run: this module is CLI-only (never imported by the library entry
// or by app code), and is loaded both directly (`bun src/cli.ts`) and via
// the `bin/okf-validate.js` shim, where `import.meta.main` would be false.
process.exit(main(process.argv));
