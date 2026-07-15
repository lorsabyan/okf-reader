# 005 — Config & docs hygiene batch: CI permissions, shadcn dep, types skew, stale docs, editorconfig, hooks

- **Status**: DONE
- **Commit**: 8e223b8 (+ uncommitted improve batch — all excerpts verified against the tree)
- **Severity**: MEDIUM (several small HIGH-confidence items batched)
- **Category**: Security + Dependencies + Docs + DX
- **Rule**: audit [SEC-01], [DEP-01], [DEP-02], [DX-02]/[DOCS-01], [DOCS-02], [DX-03]
- **Estimated scope**: 7 files, all small edits + 2 new files.

## Problem & Targets (one per item)

### A. [SEC-01] `ci.yml` has no `permissions` block

`.github/workflows/ci.yml` starts:

    name: CI

    on:
      push:
        branches: [main]
      pull_request:

    jobs:
      check:
        runs-on: ubuntu-latest

No `permissions:` anywhere — the job inherits repo-default token scope, but only reads contents. `deploy.yml:11-14` already scopes correctly.

**Target**: add at top level (after `on:` block, before `jobs:`):

    permissions:
      contents: read

### B. [DEP-01] `shadcn` CLI is a production dependency with zero imports

Root `package.json:40` — `"shadcn": "4.13.0"` in `dependencies`. `grep -rn "from 'shadcn'" src scripts` → nothing (only prose comments mention shadcn). It's a scaffolding CLI invoked via `bunx shadcn@latest add …`, not a library.

**Target**: delete the line from `dependencies` (do NOT move to devDependencies), run `bun install` to update `bun.lock`.

### C. [DEP-02] `@types/js-yaml@4.0.9` against runtime `js-yaml@5.2.1`

`packages/okf-core/package.json` — dependencies has `"js-yaml": "5.2.1"`, devDependencies has `"@types/js-yaml": "4.0.9"`. Investigate first: run `bun pm view js-yaml@5.2.1` / check `packages/okf-core/node_modules/js-yaml/package.json` for a `types`/`typings` field or bundled `*.d.ts`. js-yaml v5 likely ships its own TypeScript types (it's the ESM rewrite); if so, **remove `@types/js-yaml` entirely**. If it doesn't, check whether DefinitelyTyped has a 5.x line (`bun pm view @types/js-yaml versions | tail -3`); bump if yes, otherwise keep 4.0.9 and add a one-line comment in package.json is impossible — instead note it in the plan report.

**Verification for this item**: `bun run typecheck` stays clean after the change.

### D. [DX-02]/[DOCS-01] CONTRIBUTING.md stale claims

`CONTRIBUTING.md:30` — "keep `packages/okf-core` browser-safe (no `node:*` imports outside `src/cli.ts`)" — stale: `src/validate.ts` is now the legitimately node-only validator module.
`CONTRIBUTING.md:32` — "e2e coverage (`e2e/smoke.spec.ts`) for user-facing flows" — the file is `e2e/smoke.e2e.ts`, and the `.e2e.ts` suffix is load-bearing (keeps `bun test` from running Playwright specs).

**Target**: reword line 30 to "keep `@okf/core`'s `index.ts` (and everything it re-exports) browser-safe — `node:*` imports only in `src/cli.ts` and `src/validate.ts`"; fix line 32 to `e2e/smoke.e2e.ts` and append "(the `.e2e.ts` suffix is required so `bun test` ignores Playwright specs)".

### E. [DOCS-02] `next.config.mjs` comment is stale + check whether `transpilePackages` is still needed

Current (`next.config.mjs:12-14`):

    // @okf/core is an unbuilt workspace package (exports point at TS source);
    // tell Next to run it through its own transpiler like app code.
    transpilePackages: ['@okf/core'],

The premise is stale: the package now builds `dist/` (root `predev`/`prebuild`/`pretypecheck` hooks) and its `exports` `default` condition points at `dist/*.js`; only the `bun` condition points at TS source.

**Target**: (1) Try REMOVING `transpilePackages` entirely; run `bun run build` AND `NEXT_BASE_PATH=/okf-reader bun run build && E2E_BASE_PATH=/okf-reader bunx playwright test e2e/basepath.e2e.ts`. If both pass, delete the option and its comment. (2) If either fails, KEEP the option and rewrite the comment truthfully, e.g.: "@okf/core resolves to built dist/ for Node (see the pre* hooks), but Next still needs transpilePackages because <observed reason>." Report which branch you took and why.

### F. [DX-03] No `.editorconfig`, no pre-commit hook

**Target 1**: new `.editorconfig` at repo root:

    root = true

    [*]
    charset = utf-8
    end_of_line = lf
    insert_final_newline = true
    indent_style = space
    indent_size = 2
    trim_trailing_whitespace = true

    [*.md]
    trim_trailing_whitespace = false

**Target 2**: dependency-free pre-commit hook. Create executable `.githooks/pre-commit`:

    #!/bin/sh
    # Fast local gate — full build/e2e stays in CI.
    bun run typecheck && bun test

Wire it without any new dependency: add to root `package.json` scripts: `"prepare": "git config core.hooksPath .githooks"`. Run `bun install` once to trigger it; verify `git config core.hooksPath` prints `.githooks`. Make the hook file executable (`chmod +x`).

## Repo conventions to follow

- YAML style of the existing workflows (2-space, no quotes unless needed).
- `package.json` scripts stay alphabetically grouped as-is; add `prepare` near the other lifecycle scripts (`predev` etc.).

## Steps

1. Item A (ci.yml), verify YAML with a re-read.
2. Item B (`bun install` after), item C (investigate → change → `bun run typecheck`).
3. Item D, then item E (the build experiments — do these AFTER B/C so the lockfile is settled).
4. Item F, verify hook fires (`git stash` nothing; just run `.githooks/pre-commit` directly).
5. Full verification below.

## Boundaries

- Files in scope: `.github/workflows/ci.yml`, root `package.json`, `bun.lock`, `packages/okf-core/package.json`, `CONTRIBUTING.md`, `next.config.mjs`, new `.editorconfig`, new `.githooks/pre-commit`.
- Do NOT touch `deploy.yml`, any `src/` file, `CLAUDE.md` (another plan owns it), or any test file. Do not add any npm dependency (no husky).
- Do not commit.

## Verification

- **Mechanical**: `bun run typecheck && bun test` pass; `bun run build` passes; the basePath build + `e2e/basepath.e2e.ts` pass (required for item E either way); `bun audit` no longer lists a `shadcn › postcss` path; `git config core.hooksPath` → `.githooks`.
- **Done when**: all six items done (or E's keep-branch documented), all checks green, diff limited to the in-scope files.

## Escape hatches

- If removing `shadcn` changes anything under `src/components/ui` type-wise (it shouldn't — components import radix/cva directly), STOP and report.
- If `bun install` rewrites unrelated parts of `bun.lock` beyond removing shadcn's subtree, note it in the report (bun may compact formatting — acceptable) but don't hand-edit the lockfile.
- If item C finds neither bundled types nor a 5.x @types line, keep 4.0.9 and say so — do not downgrade js-yaml.
