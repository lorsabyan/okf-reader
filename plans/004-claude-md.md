# 004 — Add CLAUDE.md documenting the repo's load-bearing invariants for agents

- **Status**: DONE
- **Commit**: 8e223b8 (+ uncommitted improve batch in the working tree — quoted paths below verified against the tree)
- **Severity**: HIGH (leverage, not risk)
- **Category**: DX & Tooling
- **Rule**: audit [DX-01]
- **Estimated scope**: 1 new file (`CLAUDE.md`), ~60-90 lines. No code changes.

## Problem

This repo is routinely worked on by coding agents (see `plans/`), but its non-obvious invariants live only in scattered comments. An agent that doesn't know them breaks things in predictable ways:

- Naming a Playwright spec `*.test.ts` or `*.spec.ts` gets it swept into `bun test` (the unit runner) — the split only works because Playwright matches `*.e2e.ts` (`playwright.config.ts:16-18` — `testMatch: '**/*.e2e.ts'` with a comment explaining `bun test` would otherwise pick specs up).
- Adding a `node:*` import to `packages/okf-core/src/` outside `cli.ts`/`validate.ts` breaks the browser-safe contract of `@okf/core`'s `.` export (consumed by the client-side runtime viewer).
- Not knowing about the `predev`/`prebuild`/`pretypecheck` hooks (root `package.json:10,15,16`) that build `packages/okf-core/dist/` first — or that `bun test` doesn't need dist because the package's `"bun"` export condition resolves TS source.

## Target

Create `CLAUDE.md` at the repo root covering exactly these sections (concise — a screen or two, not a manual):

1. **What this is** — 2-3 sentences: static-first Next.js 16 reader for OKF knowledge bundles; Bun workspace with the app at root and `@okf/core` (bundle model + `okf-validate` CLI) in `packages/okf-core`.
2. **Commands** — `bun install`; `bun run dev`; the full gate in order: `bun run typecheck && bun test && bun run build && bun run e2e` (e2e requires the build first); `bun run screenshots`. State plainly: this is a Bun repo — use `bun`/`bunx`, never `npm`/`npx`.
3. **Test-file naming (load-bearing)** — unit tests are colocated `*.test.ts` run by `bun test`; Playwright specs MUST be `e2e/*.e2e.ts` (never `.test.ts`/`.spec.ts`) so `bun test` ignores them. Cite `playwright.config.ts`.
4. **@okf/core rules** — `src/index.ts` and everything it re-exports must stay browser-safe: `node:*` imports are allowed only in `src/cli.ts` and `src/validate.ts` (exposed as the `@okf/core/validate` subpath, never re-exported from `index.ts`). The package builds to `dist/` (gitignored) via root pre-hooks; Bun resolves the `"bun"` export condition straight to TS source, Node/Next resolve `dist/`.
5. **Conventions** — Tailwind v4 utilities with `cn()` from `src/lib/utils.ts`; `src/components/ui/*` are shadcn-generated primitives (regenerate via `bunx shadcn@latest add <name>`, don't hand-roll new ones); no linter is configured yet — match surrounding style; `example-bundle/` is vendored demo content (Apache 2.0, Google) — don't edit it to make tests pass.
6. **Plans workflow** — `plans/` holds numbered implementation plans with a status index in `plans/README.md`; keep numbering monotonic and update statuses when executing.

## Repo conventions to follow

Markdown style of the existing `README.md`/`CONTRIBUTING.md`: sentence-case headings, fenced `sh` blocks for commands, tight prose.

## Steps

1. Verify each claim above against the tree before writing it (`playwright.config.ts`, root `package.json` scripts, `packages/okf-core/package.json` exports, `.gitignore`).
2. Write `CLAUDE.md` with the six sections.
3. Re-read it as a cold-start agent: every command must be copy-pasteable and correct.

## Boundaries

- ONLY create `CLAUDE.md`. Do not modify any other file. Do not restate content that is wrong in CONTRIBUTING.md today (a separate plan fixes that file — write what is TRUE, verified against code).

## Verification

- **Mechanical**: `bun run typecheck && bun test` still pass (nothing changed); every command quoted in CLAUDE.md exists in `package.json`.
- **Done when**: the file exists, all claims verified, no other file touched.

## Escape hatches

- If any invariant stated in the Problem section doesn't match the tree (e.g. the export conditions changed), STOP and report the discrepancy instead of documenting a guess.
