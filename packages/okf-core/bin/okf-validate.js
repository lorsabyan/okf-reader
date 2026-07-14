#!/usr/bin/env node
// Thin shim so `bin.okf-validate` resolves to a plain .js entry point (npm/bunx
// convention). Prefers the built dist/cli.js (always present in the published
// package — see the `build`/`prepack` scripts in ../package.json) so a plain
// `npm install` works without Bun/Node type-stripping. In a fresh repo checkout
// dist/ may not exist yet, so fall back to the TS source, which Bun (and
// Node >= 22.6 outside node_modules) can run directly.
try {
  await import('../dist/cli.js');
} catch (err) {
  if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
  await import('../src/cli.ts');
}
