# 014 — Health and `okf-validate`: use the spec's staleness, stop demanding `timestamp`

- **Status**: DONE
- **Commit**: 4ae3ca5 (all excerpts verified against the tree)
- **Severity**: HIGH (every v0.2 concept produces a spurious warning; staleness is invented)
- **Category**: Bug / spec conformance
- **Estimated scope**: `packages/okf-core/src/health.ts`, `validate.ts`, `cli.ts` + tests.
- **Depends on**: 013

## Problem

### A. `okf-validate` warns once per concept on any v0.2 bundle

Verbatim output, running this repo's own CLI against upstream `acme_retail`:

    warning computations/gross-margin-period: no 'timestamp' field
    warning computations/revenue-ytd: no 'timestamp' field
    ... one per concept, 9 total
    acme_retail: 9 concept doc(s), 0 error(s), 10 warning(s)
    Bundle is conformant with OKF v0.1.

The warning is for a field v0.2 **deleted**. The source:

    // packages/okf-core/src/validate.ts:98-99 — current
    ...report.stale.map(({ id, timestamp }) => `${id}: 'timestamp' (${timestamp}) is more than a year old`),
    ...report.undated.map((id) => `${id}: no 'timestamp' field`),

The closing line also hardcodes the version the bundle was judged against.

### B. Staleness is invented rather than read

    // packages/okf-core/src/health.ts:3-4, 40-45 — current
    const DAY_MS = 24 * 60 * 60 * 1000;
    const STALE_AFTER_MS = 365 * DAY_MS;
    ...
    if (c.timestamp) {
      const ts = Date.parse(c.timestamp);
      if (!Number.isNaN(ts) && now - ts > STALE_AFTER_MS) stale.push({ id: c.id, timestamp: c.timestamp });
    } else {
      undated.push(c.id);
    }

"Older than a year" is a guess this repo made up. OKF v0.2 §5.5 provides `stale_after`, an
absolute date the *author* chose precisely so consumers stop guessing. A concept can be two years
old and deliberately current; another can be a week old and already expired. The heuristic gets
both wrong.

Both defects share a root cause: `timestamp` was the only date the model carried. 013 fixes that;
this plan consumes it.

## Target

### A. Health report keyed on the spec

    // target — packages/okf-core/src/health.ts
    export interface HealthReport {
      brokenLinks: { fromId: string; target: string }[];
      missingDescriptions: string[];
      untyped: string[];
      stale: { id: string; staleSince: string }[];   // from stale_after (§5.5), not age
      aging: { id: string; updatedAt: string }[];    // the old heuristic, renamed and demoted
      undated: string[];                              // no updatedAt at all
      unverified: string[];                           // trustTier === 'unverified' (§5.3)
      deprecated: string[];                           // status === 'deprecated' (§5.4)
      orphans: string[];
    }

- `stale` now means what the spec means: `today >= stale_after`.
- The 365-day rule survives as `aging` — still a useful smell for a bundle whose authors never set
  `stale_after`, but no longer masquerading as the spec's concept. Compute it from `updatedAt`, so
  it works for both v0.1 and v0.2 bundles.
- `undated` keys on `updatedAt`, so a v0.2 concept with `generated.at` is dated. It stays a warning
  only for concepts with neither — which is legitimate, since a bundle with no dates anywhere is
  genuinely harder to trust.
- `unverified` / `deprecated` are new, cheap, and are what a reader most wants flagged.

### B. Validator messages and version line

    // target — packages/okf-core/src/validate.ts
    ...report.stale.map(({ id, staleSince }) => `${id}: past its 'stale_after' (${staleSince})`),
    ...report.aging.map(({ id, updatedAt }) => `${id}: last updated ${updatedAt}, over a year ago`),
    ...report.undated.map((id) => `${id}: no 'generated.at' (or legacy 'timestamp')`),
    ...report.deprecated.map((id) => `${id}: status is 'deprecated'`),

Report conformance against **v0.2**, and honour a bundle-root `okf_version` when the bundle
declares one (spec §12) rather than asserting a version the bundle never claimed.

Keep the permissive stance: none of these are errors. Spec §11 makes `type` and parseable
frontmatter the only hard requirements, and explicitly forbids rejecting a bundle for missing
optional fields, unknown types, unknown keys, broken links, or missing indexes.

## Verification

- `bun test` — `health.test.ts` / `validate.test.ts`:
  - a concept past `stale_after` lands in `stale`; one with a future `stale_after` does not
  - the boundary day counts as stale
  - a v0.2 concept with `generated.at` is **not** in `undated`
  - a v0.1 concept with only `timestamp` is still dated and still ages
  - `unverified` / `deprecated` populate from `verified` and `status`
  - injectable `now`, so none of these tests rot
- **Regression gate**: `okf-validate` on all four upstream v0.2 bundles reports **0 errors and 0
  spurious `timestamp` warnings** (compare against `okf-skill`'s validator, which is clean on all
  four); `example-bundle/` keeps working while it is still v0.1 (until 017).
- `bun run typecheck`.

## Out of scope

- Rendering any of this (015).
- Changing the CLI's exit-code contract.
