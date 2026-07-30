import path from 'node:path';
import { type CoreBundle } from '@lorsabyan/okf-core';
import { loadBundleFromDir } from '@lorsabyan/okf-core/node';

export { navGroups, resolveLink, type Concept } from '@lorsabyan/okf-core';
export type Bundle = CoreBundle & { dir: string };

let cached: Bundle | null = null;

/** Build-time loader: reads the bundle directory from disk (SSG mode). */
export function loadBundle(): Bundle {
  if (cached) return cached;
  const dir = path.resolve(process.env.OKF_BUNDLE ?? path.join(process.cwd(), 'example-bundle'));
  const name = process.env.OKF_BUNDLE_NAME ?? path.basename(dir);
  cached = { ...loadBundleFromDir(dir, name), dir };
  return cached;
}
