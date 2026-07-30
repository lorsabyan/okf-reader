# 015 — Surface trust, status, and freshness in the reader UI

- **Status**: DONE
- **Commit**: 4ae3ca5 (all excerpts verified against the tree)
- **Severity**: HIGH (v0.2 bundles render undated, with an empty landing page)
- **Category**: UI / spec conformance
- **Estimated scope**: `src/app/(reader)/page.tsx`, `c/[...slug]/page.tsx`, `health/page.tsx`,
  `src/components/open/HealthView.tsx`, plus a small `TrustBadge` component.
- **Depends on**: 013, 014

## Problem

### A. A v0.2 bundle has no dates anywhere in the UI

The concept page only renders `timestamp`, which v0.2 removed:

    // src/app/(reader)/c/[...slug]/page.tsx:78-80 — current
    {concept.timestamp && (
      <time className="text-sm text-muted-foreground">{concept.timestamp.slice(0, 10)}</time>
    )}

### B. The landing page's "recent" list is empty for v0.2

    // src/app/(reader)/page.tsx:15-16 — current
    .filter((c) => c.timestamp)
    .sort((a, b) => (b.timestamp! < a.timestamp! ? -1 : 1))

Measured on upstream `acme_retail`: **0 of 9** concepts survive that filter. The primary landing
surface renders empty for a fully valid, fully dated bundle.

### C. Nothing conveys trust, status, or expiry

The metadata row is type + date + tags:

    // src/app/(reader)/c/[...slug]/page.tsx:76-86 — current
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <Badge>{concept.type}</Badge>
      {concept.timestamp && (...)}
      {concept.tags.map((t) => (<Badge key={t} variant="outline">{t}</Badge>))}
    </div>

A reader cannot tell a human-reviewed, currently-valid metric from a `deprecated` one that expired
last year. For a tool whose purpose is helping people decide whether to trust a definition, that
is the gap that matters most — and it is exactly what v0.2 added the fields to answer.

`metrics/gross-margin-legacy.md` in upstream `acme_retail` is the case in point: `status:
deprecated`, its body saying "Do not use for new analyses". The reader shows it identically to the
current metric beside it.

## Target

### A. One date field, fed by `updatedAt`

    // target — c/[...slug]/page.tsx
    {concept.updatedAt && (
      <time className="text-sm text-muted-foreground" dateTime={concept.updatedAt}>
        {concept.updatedAt.slice(0, 10)}
      </time>
    )}

and on the landing page, `.filter((c) => c.updatedAt)` / sort by `updatedAt`. Since 013 puts the
v0.1 fallback inside `updatedAt`, both surfaces work for v0.1 and v0.2 bundles with no branching.

### B. `TrustBadge` in the metadata row

Render, in this order: type, **status** (only when not `stable`), **trust tier**, **stale**, date,
tags.

- `status: deprecated` → destructive badge, `draft` → muted badge, `stable` → nothing (it is the
  default; a badge on every concept is noise).
- Trust tier → `human-reviewed` uses the accent hue introduced in plan 011, `machine-confirmed` is
  outline, `unverified` is muted. Tooltip naming the actor(s) and the latest `at`.
- Past `stale_after` → warning token from plan 011, reading e.g. `stale since 2026-12-31`.

Keep it advisory in tone. Spec §5.3 is explicit that trust tiers are signals, not access control —
so nothing here should hide or gate content, only label it.

### C. Provenance section

Below the body, when `sources` is non-empty: a compact list of `title` (or `resource`), linked
when `resource` is a followable URL or in-bundle path, plus `author` and `lastModified` when
present. Reuse `isSafeResourceUrl` from `src/lib/resource-url.ts` — a `sources[].resource` may be
a scope descriptor like `all queries in BigQuery project X`, which is deliberately not a link and
must not be rendered as one.

### D. Health page

Surface the new report fields from 014: `stale` (spec-driven), `deprecated`, `unverified`;
demote the old age heuristic to an `aging` section. `HealthView.tsx` (runtime viewer) and
`health/page.tsx` (static) both consume `analyzeBundle`, so both need the same treatment.

## Verification

- `bun test` for any extracted pure logic (badge selection given a concept).
- `bun run typecheck && bun test && bun run build && bun run e2e`.
- **Browser pass required** (this batch is visual, per the precedent set by plans 010–012):
  `OKF_BUNDLE=<upstream acme_retail> bun run dev` — desktop + 375px, light + dark. Confirm:
  - the landing page's recent list is populated (was empty)
  - concept pages show a date
  - `metrics/gross-margin-legacy` is visibly marked deprecated
  - a concept with a past `stale_after` shows the stale marker (force with a local edit)
- Re-run against `example-bundle/` (still v0.1 until 017) and confirm no regression: dates still
  render, no trust/status badges appear where the fields are absent.

## Out of scope

- Attested Computation rendering (016).
- Re-vendoring the demo bundle (017).
