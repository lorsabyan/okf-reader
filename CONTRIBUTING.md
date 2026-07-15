# Contributing

## Setup

```sh
bun install                          # Bun workspace: app + packages/okf-core
bunx playwright install chromium     # once, for the e2e suite
```

## Workflow

```sh
bun run dev            # app at http://localhost:3000
bun run typecheck       # tsc --noEmit
bun test                # unit tests (app + @okf/core)
bun run build            # static export to out/ (+ pagefind index)
bun run e2e              # Playwright smoke suite against out/ — build first
bun run screenshots       # regenerate docs/*.png used in the README
```

Before opening a PR, run the full local gate:

```sh
bun run typecheck && bun test && bun run build && bun run e2e
```

## Pull requests

- Match existing code style; keep `@okf/core`'s `index.ts` (and everything it
  re-exports) browser-safe — `node:*` imports only in `src/cli.ts` and
  `src/validate.ts`.
- Add or update unit tests for `src/` and `packages/okf-core/src` changes,
  and e2e coverage (`e2e/smoke.e2e.ts`) for user-facing flows (the `.e2e.ts`
  suffix is required so `bun test` ignores Playwright specs).
- No new runtime dependencies in the app without discussion — `@playwright/test`
  and similar tooling stay dev-only.
- Keep PRs focused; note any follow-up work rather than expanding scope.
