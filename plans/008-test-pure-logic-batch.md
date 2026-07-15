# 008 — Unit-test batch: tour-progress storage branches, detect-root thresholds, prev-next boundaries

- **Status**: DONE
- **Commit**: 8e223b8 (+ uncommitted improve batch)
- **Severity**: MEDIUM
- **Category**: Test Coverage
- **Rule**: audit [TEST-03], [TEST-04], [TEST-05]
- **Estimated scope**: 3 test files — extend `src/lib/tour-progress.test.ts`, extend `packages/okf-core/src/detect-root.test.ts`, new `src/lib/prev-next.test.ts`.

## Problem

Three clusters of pure(ish) logic with zero coverage on their interesting branches:

**A. `src/lib/tour-progress.ts`** — only `tourBarMode` is tested. Untested: the legacy-format branch in `getActiveTour` (`:52-60` — a bare tourId string from before `lastActiveAt` existed falls through the JSON-parse catch and returns `{ id: raw, lastActiveAt: Date.now() }`); `getTourProgress`'s coercion (`:21-24` — non-array `visited` → `[]`); `markStepVisited` idempotence (`:27-33`); `setActiveTour(name, null)` removing the key (`:64-69`). All guard `typeof window` — bun:test has no `window` by default, so the tests must install a minimal stub:

    (globalThis as any).window = { localStorage: <in-memory Storage stub> };

and delete it in `afterEach`/`afterAll`. Check how the existing `tour-progress.test.ts` handles this (it tests the pure `tourBarMode`, so it may not — the stub pattern is yours to add cleanly).

**B. `packages/okf-core/src/detect-root.ts`** — `detect-root.test.ts` covers the single-level `knowledge/` case, a well-rooted null, and a no-absolute-links null. Untested: `candidatePrefixes` emitting nested `a/b` candidates when a top-level dir holds ONLY subdirectories (`:51-74`), and the accept thresholds (`:~113-116` — candidate resolve-rate must be ≥ 0.8 AND strictly better than the root's). Read the current source first — line numbers are approximate.

**C. `src/lib/prev-next.ts`** — no test file. Boundary logic (verbatim current source):

    export function prevNextInGroup(bundle: Pick<CoreBundle, 'concepts'>, conceptId: string): PrevNextResult {
      for (const { items } of navGroups(bundle)) {
        const index = items.findIndex((c) => c.id === conceptId);
        if (index === -1) continue;
        const prev = index > 0 ? items[index - 1] : undefined;
        const next = index < items.length - 1 ? items[index + 1] : undefined;
        return {
          prev: prev ? { id: prev.id, title: prev.title } : undefined,
          next: next ? { id: next.id, title: next.title } : undefined,
        };
      }
      return {};
    }

## Target

**A** — extend `tour-progress.test.ts`: legacy bare-string `getActiveTour` returns `{id: raw}` with a numeric `lastActiveAt`; corrupt JSON (`'{oops'`) → same legacy fallback (the raw string becomes the id — assert current behavior); valid JSON without `id` string → legacy fallback too; `getTourProgress` with `{"visited": "nope"}` → `{visited: []}`; `markStepVisited` twice with the same step stores it once; `setActiveTour(name, null)` removes the key; every test cleans its stubbed storage.

**B** — extend `detect-root.test.ts` with the existing fixture style (Map of path→frontmattered markdown): (1) a bundle at `repo/pkg/knowledge/…` where `repo/` and `repo/pkg/` contain no `.md` files directly → the nested candidate `pkg/knowledge` (or per the function's actual contract — read it) is detected; (2) a fixture engineered near the 0.8 resolve-rate boundary: candidate resolving 4/5 absolute links (0.8, accepted — or rejected if the comparison is strict `<`; READ THE CODE and pin the actual boundary semantics in the test name); (3) a candidate that resolves no better than the root → null.

**C** — new `src/lib/prev-next.test.ts`: build a bundle via `buildBundle` from `@okf/core` (see `search-bundle.test.ts` for the fixture pattern) with two groups (e.g. `tables/a.md`, `tables/b.md`, `tables/c.md`, `metrics/x.md`): middle item → both prev and next; first → no prev; last → no next; single-item group → neither; unknown id → `{}`; and prev/next never cross groups (`tables/c` has no next even though `metrics/x` exists).

## Repo conventions to follow

bun:test; fixture styles referenced above per file. Test names in the repo read as behavior sentences ('an empty `type` is an ERROR…') — match that.

## Steps

1. Read all three source files + their existing tests; report drift if excerpts above don't match.
2. Implement A, B, C; run scoped: `bun test src/lib/tour-progress.test.ts src/lib/prev-next.test.ts && bun test packages/okf-core/src/detect-root.test.ts`.
3. Full `bun test` + `bun run typecheck`.

## Boundaries

- Files in scope: the three test files only. Do NOT modify any source file — surprising behavior gets reported, not fixed. Careful in B: another convention — okf-core tests must not import from the app (`src/`).
- No new dependencies (no happy-dom — the minimal window stub above suffices). No build/e2e.

## Verification

- **Mechanical**: full `bun test` green (no leakage of the window stub into other test files — run the FULL suite to prove it); `bun run typecheck` clean.
- **Done when**: all branches listed above have a test, full suite green, diff limited to the three test files.
