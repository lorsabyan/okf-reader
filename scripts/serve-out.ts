#!/usr/bin/env bun
// Dependency-free static file server for the built `out/` site, used as the
// Playwright webServer for e2e/screenshots. No `next start` — `next export`
// output is plain static files, and this avoids pulling in any HTTP
// framework just to serve them locally.
import { existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(join(import.meta.dir, '..', 'out'));
const PORT = Number(process.env.PORT ?? 4173);

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
    const resolved = resolveWithinRoot(url.pathname);
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
