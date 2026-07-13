import fs from 'node:fs';
import path from 'node:path';
import { buildBundle, type CoreBundle } from './core';

export { navGroups, resolveLink, type Concept } from './core';
export type Bundle = CoreBundle & { dir: string };

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

let cached: Bundle | null = null;

/** Build-time loader: reads the bundle directory from disk (SSG mode). */
export function loadBundle(): Bundle {
  if (cached) return cached;
  const dir = path.resolve(process.env.OKF_BUNDLE ?? path.join(process.cwd(), 'example-bundle'));
  const name = process.env.OKF_BUNDLE_NAME ?? path.basename(dir);
  cached = { ...buildBundle(walk(dir, dir, new Map()), name), dir };
  return cached;
}
