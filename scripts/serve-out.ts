#!/usr/bin/env bun
// Dependency-free static file server for the built `out/` site, used as the
// Playwright webServer for e2e/screenshots. No `next start` — `next export`
// output is plain static files, and this avoids pulling in any HTTP
// framework just to serve them locally.
import { existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(join(import.meta.dir, '..', 'out'));
const PORT = Number(process.env.PORT ?? 4173);
// When set, mimics hosting `out/` under a sub-path (e.g. GitHub Pages'
// `/<repo>/`) instead of at the origin root: requests must carry the prefix
// to be served, everything else 404s. Used by e2e/basepath.e2e.ts to catch
// regressions where base-path-prefixed hrefs get lost (see src/lib/paths.ts).
const BASE_PATH = process.env.E2E_BASE_PATH ?? '';

/** Resolve a request pathname inside ROOT, rejecting any path traversal. */
function resolveWithinRoot(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed percent-encoding
  }
  const candidate = normalize(join(ROOT, decoded));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

function fileResponse(path: string, status = 200): Response {
  return new Response(Bun.file(path), { status });
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (BASE_PATH) {
      if (pathname === BASE_PATH) pathname = '/';
      else if (pathname.startsWith(BASE_PATH + '/')) pathname = pathname.slice(BASE_PATH.length);
      else return new Response('Not found (missing base path prefix)', { status: 404 });
    }

    const resolved = resolveWithinRoot(pathname);
    if (!resolved) return new Response('Forbidden', { status: 403 });

    let target = resolved;
    if (existsSync(target) && statSync(target).isDirectory()) {
      target = join(target, 'index.html');
    }

    if (existsSync(target) && statSync(target).isFile()) {
      return fileResponse(target);
    }

    const notFound = join(ROOT, '404.html');
    if (existsSync(notFound)) return fileResponse(notFound, 404);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`Serving ${ROOT} at ${server.url}`);
