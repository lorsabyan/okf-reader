import fs from 'node:fs';
import path from 'node:path';
import { buildBundle, type CoreBundle } from './core.ts';

/**
 * Node-only bundle loading, exposed as the `@lorsabyan/okf-core/node` subpath.
 *
 * Kept out of `index.ts` for the same reason as `./validate`: that entry point
 * is imported directly by the client-side runtime viewer and must stay free of
 * `node:*`. Kept *separate from* `./validate` because loading is not validating
 * — a consumer that only wants to read a bundle should not have to pull in the
 * validator to do it.
 *
 * This exists because the same recursive fs-walk had already been written twice
 * (here and in the reader app) and plan 009 found that an MCP server would have
 * written a third. One implementation, three consumers.
 */

/** Read every `.md` file under `dir`, keyed by bundle-relative posix path. */
export function readBundleFiles(dir: string, root: string = dir, acc: Map<string, string> = new Map()): Map<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Hidden files and directories are not bundle content.
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readBundleFiles(full, root, acc);
    else if (entry.name.endsWith('.md')) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      acc.set(rel, fs.readFileSync(full, 'utf-8'));
    }
  }
  return acc;
}

/**
 * Load a bundle from a directory on disk.
 *
 * `name` defaults to the directory's basename, which is what every current
 * caller wants; pass it explicitly to override (the reader honours
 * `OKF_BUNDLE_NAME` this way).
 */
export function loadBundleFromDir(dir: string, name?: string): CoreBundle {
  const resolved = path.resolve(dir);
  return buildBundle(readBundleFiles(resolved), name ?? path.basename(resolved));
}
