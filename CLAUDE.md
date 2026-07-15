# CLAUDE.md

Guidance for agents working in this repo. Keep this current — it documents
invariants, not preferences.

## What this is

A static-first Next.js 16 reader for Open Knowledge Format (OKF) knowledge
bundles: sidebar navigation, concept pages, cross-links, backlinks, and
guided tours over a directory of markdown + frontmatter. It's a Bun
workspace — the reader app lives at the root, and the source-agnostic
bundle model + `okf-validate` CLI live in `packages/okf-core` as the
`@okf/core` package.

## Commands

This is a Bun repo — use `bun`/`bunx`, never `npm`/`npx`.

```sh
bun install                                            # install the workspace
bun run dev                                            # app at http://localhost:3000

# full local gate, in order (e2e needs the build first):
bun run typecheck && bun test && bun run build && bun run e2e

bun run screenshots                                    # regenerate docs/*.png
```

`predev`/`prebuild`/`pretypecheck` hooks (root `package.json`) build
`packages/okf-core/dist/` first. `bun test` doesn't need that step — the
package's `"bun"` export condition resolves straight to TS source.

## Test-file naming (load-bearing)

Unit tests are colocated `*.test.ts`, run by `bun test`. Playwright specs
**must** be named `e2e/*.e2e.ts` — never `.test.ts` or `.spec.ts`.
`bun test` auto-discovers `*.test.*`/`*.spec.*` anywhere in the repo, so a
misnamed Playwright spec gets swept into the unit-test run and fails there
instead of under `playwright test`. See `playwright.config.ts`
(`testMatch: /.*\.e2e\.ts/`).

## @okf/core rules

`packages/okf-core/src/index.ts` and everything it re-exports (`core.ts`,
`tours.ts`, `health.ts`, `detect-root.ts`) must stay browser-safe — no
`node:*` imports. It's consumed directly by the client-side runtime viewer.

`node:*` imports are allowed only in `src/cli.ts` and `src/validate.ts`,
exposed as the separate `@okf/core/validate` subpath — never re-exported
from `index.ts`.

The package builds to `packages/okf-core/dist/` (gitignored) via the root
pre-hooks above. Bun resolves the `"bun"` export condition straight to TS
source; Node/Next resolve the built `dist/` output.

## Conventions

- Tailwind v4 utilities, composed with `cn()` from `src/lib/utils.ts`
  (`clsx` + `tailwind-merge`).
- `src/components/ui/*` are shadcn-generated primitives — regenerate/add via
  `bunx shadcn@latest add <name>` rather than hand-rolling new ones.
- No linter is configured yet (no ESLint/Biome config in the repo) — match
  surrounding style.
- `example-bundle/` is vendored demo content (the GA4 e-commerce bundle from
  GoogleCloudPlatform/knowledge-catalog, Copyright Google LLC, Apache 2.0) —
  don't edit it to make tests pass.

## Plans workflow

`plans/` holds numbered implementation plans with a status index in
`plans/README.md`. Keep numbering monotonic and update each plan's status
there as it's executed.
