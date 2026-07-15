# Improvement plans

Three batches. 001–003: `improve-react` audit at commit `8e223b8` (2026-07-15) —
React Doctor scan (score 46, driven by verified-false-positive security
diagnostics) + five-category manual audit. 004–009: `/improve` full audit at the
same commit (with 001–003 applied, uncommitted) — four-category subagent audit
(tests+DX, debt+docs, deps+supply-chain, direction) vetted line-by-line and
second-opinioned by a fresh-context advisor. 010–012: UI/UX review at commit
`b24f7eb` — a live browser pass (light/dark, desktop/mobile, every major page)
cross-checked by a fresh-context advisor against the source.

| Plan | Title | Severity | Status | Depends on |
|------|-------|----------|--------|------------|
| [001](001-search-palette-and-shared-index.md) | Search-palette state defects + shared lowercase index (+ parallel local reads, shiki dep, sr-only broken-link text) | HIGH | DONE | — |
| [002](002-static-reader-a11y.md) | Static reader a11y: skip link, aria-current, SVG graph, tour status | HIGH | DONE | — |
| [003](003-open-viewer-hardening.md) | Runtime viewer: error boundary, live regions, consume index + render cache | HIGH | DONE | 001 |
| [004](004-claude-md.md) | Add CLAUDE.md documenting agent-facing invariants | HIGH | DONE | — |
| [005](005-config-docs-hygiene.md) | Hygiene batch: CI permissions, shadcn dep, @types/js-yaml skew, stale docs, editorconfig, dependency-free pre-commit hook | MED | DONE | — |
| [006](006-test-github-source.md) | Unit-test fetchGithubBundle (mocked fetch) | HIGH | DONE | — |
| [007](007-test-local-source-and-xss-vectors.md) | Unit-test local folder-open path + widen XSS regression vectors | HIGH | DONE | — |
| [008](008-test-pure-logic-batch.md) | Unit-test batch: tour-progress, detect-root thresholds, prev-next | MED | DONE | — |
| [009](009-spike-publish-okf-core.md) | Design spike: publish @okf/core + first external consumer (report only) | DIR | DONE | — |
| [010](010-header-responsive-fix.md) | Fix global header's total lack of responsive behavior (wraps/breaks at 375px) | HIGH | DONE | — |
| [011](011-color-token-pass.md) | Introduce one accent hue + warning token; wire health severity and badge distinction | HIGH | DONE | — |
| [012](012-polish-wrap-and-copy.md) | Fix mid-word URL wrapping (break-all → break-words); reword dev-mode search message | LOW | DONE | — |

## Execution order (batch 2)

1. **004–009 all run in parallel** — fully disjoint file ownership: 004 = `CLAUDE.md`; 005 = workflows/manifests/CONTRIBUTING/next.config/.editorconfig/.githooks; 006 = `src/lib/sources/github.test.ts`; 007 = `src/lib/sources/local.test.ts` + `src/lib/markdown.test.ts`; 008 = `tour-progress.test.ts`, `detect-root.test.ts`, `prev-next.test.ts`; 009 = `plans/009-report.md` only.
2. Full gate after all: `bun run typecheck && bun test && bun run build && bun run e2e` (+ the basePath build/e2e — required by 005's `transpilePackages` experiment either way).

## Execution order (batch 3)

1. **010–012 all run in parallel** — fully disjoint file ownership: 010 = `src/app/layout.tsx` + `src/components/HeaderNav.tsx`; 011 = `src/app/globals.css` + `src/components/ui/badge.tsx` + `src/components/open/HealthView.tsx` + `src/app/(reader)/health/page.tsx`; 012 = `src/app/(reader)/c/[...slug]/page.tsx` + `src/components/SearchDialog.tsx`.
2. Every plan in this batch requires a **behavior check in a real browser** (`bun run dev`), not just typecheck/tests — these are visual/UX fixes. Full gate after all three land: `bun run typecheck && bun test && bun run build && bun run e2e`, plus a manual browser pass at desktop + 375px, light + dark.

## Considered and rejected / deferred (batch 2)

- ~~shadcn removal~~ — [DEP-01] was a FALSE POSITIVE: `src/app/globals.css:3` imports `shadcn/tailwind.css` (CSS-only export; JS-import greps missed it). The package is load-bearing; the executor reverted via the plan escape hatch. Do not re-report.
- SHA-pinning GitHub Actions — LOW for this threat model (OIDC deploy, no stored secrets, fork PRs unprivileged); revisit if secrets are ever added.
- Transitive postcss moderate advisory — build-time-only reachability (processes only the project's own CSS); clear with a future `bun update`.
- Version-pinning policy normalization — cosmetic; lockfile + `--frozen-lockfile` already pin CI.
- README sample-output nit (`./example-bundle:` prefix) — not worth a change.
- SSG↔runtime view dedup now ALSO includes the home view (third instance, `src/app/(reader)/page.tsx` ↔ `OpenViewer` `HomeView`) and the pure-derivation duplication (`candidateTours`, recently-updated) — folded into the standing dedup follow-up below, not a new plan.
- Unused `@okf/core` tour exports (`stepIndex`/`nextStep`/`prevStep`) + dead `bundle.ts` re-exports + import-path convention — investigate during the dedup/god-file pass (wire TourBar to the helpers or document/remove them).

## Deliberately not planned (standing follow-up candidates)

- Health-report, concept-article, **and home-view** deduplication between SSG and runtime views, plus the OpenViewer.tsx god-file split — high-churn refactors; dedicated pass.
- Linter adoption (`eslint-config-next` or Biome) — repo-wide, own PR.
- React Compiler trial, `<meta>` CSP for self-hosted `/open`, `startTransition` + hover-warmed render cache.
- Direction options on hold: log.md history rendering (DIR-01, strongest spec grounding), GitHub PAT/zip sources (DIR-02), `okf-validate --fix` spike (DIR-03), multi-bundle catalog (DIR-05).
