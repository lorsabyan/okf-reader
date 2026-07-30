# 013 — Carry OKF v0.2 provenance, trust, and lifecycle fields in `@okf/core`

- **Status**: TODO
- **Commit**: 4ae3ca5 (all excerpts verified against the tree)
- **Severity**: HIGH (the reader silently discards every v0.2 signal)
- **Category**: Data model / spec conformance
- **Estimated scope**: `packages/okf-core/src/core.ts` + a new `trust.ts`, plus colocated tests.
- **Depends on**: —
- **Blocks**: 014, 015, 016

## Problem

OKF v0.2 superseded v0.1. It retired `timestamp` in favour of `generated: { by, at }`, and added
`verified`, `status`, `stale_after`, and `sources`. All four upstream reference bundles
(`ga4`, `stackoverflow`, `crypto_bitcoin`, `acme_retail`) are v0.2 today, and
`lorsabyan/okf-skill` authors v0.2.

`Concept` models none of it. Verbatim:

    // packages/okf-core/src/core.ts:38-50 — current
    export interface Concept {
      id: string;
      title: string;
      type: string;
      typeExplicit: boolean;
      description: string;
      resource?: string;
      tags: string[];
      timestamp?: string;
      body: string;
      outLinks: string[];
      steps?: string[];
    }

`buildBundle` reads exactly one lifecycle field:

    // packages/okf-core/src/core.ts:139 — current
    timestamp: data.timestamp != null ? String(data.timestamp) : undefined,

### Measured impact

Running `buildBundle` + `analyzeBundle` over upstream `acme_retail` (v0.2) versus the vendored
`example-bundle/` (v0.1):

| | v0.2 bundle | v0.1 bundle |
|---|---|---|
| `timestamp` on a concept | `undefined` | `2026-05-28T22:49:59+00:00` |
| v0.2 fields in the file | `generated, verified, status, stale_after, sources` | none |
| …retained by the model | **none** | n/a |
| concepts with a date | **0 of 9** | 12 of 12 |
| `health.undated` | **9 of 9** | 0 of 12 |

Note this is not a parse failure — `parseFrontmatter` uses `js-yaml` and reads the nested v0.2
frontmatter correctly. The data arrives and is then dropped on the floor by `buildBundle`.

## Target

### A. Extend `Concept`

    // target — packages/okf-core/src/core.ts
    export interface Actor {
      by: string;              // '<producer>/<version>' | 'human:<id>' | 'process:<id>'  (spec §7)
      at?: string;             // ISO 8601
    }

    export interface Source {
      id?: string;             // join key for [^id] body footnotes (spec §5.1)
      resource: string;        // URL, bundle path, or a scope descriptor — not always a link
      title?: string;
      author?: string;
      usageCount?: number;
      lastModified?: string;
    }

    export interface Concept {
      // ...existing fields, `timestamp` retained for v0.1 bundles...
      generated?: Actor;
      verified: Actor[];       // always an array; a bare mapping is a 1-element list (spec §5.2)
      status: 'draft' | 'stable' | 'deprecated';   // absent ⇒ 'stable' (spec §5.4)
      staleAfter?: string;     // YYYY-MM-DD (spec §5.5)
      sources: Source[];
      updatedAt?: string;      // generated.at ?? timestamp — the one field the UI should read
    }

`updatedAt` is the important one: it is the single place the v0.1 fallback lives, so no UI or
health code has to know that `timestamp` ever existed. Spec §13 requires consumers to keep
reading `timestamp` for v0.1 documents; this is where that happens, once.

`verified`, `sources`, and `status` are non-optional in the model (empty array / `'stable'`) so
consumers never branch on undefined. Absence still carries meaning — an empty `verified` is
exactly the "unverified" tier — but that is a *derived* answer, not a null check at each call
site.

### B. New `packages/okf-core/src/trust.ts`

Browser-safe (per CLAUDE.md's `@okf/core` rules — no `node:*`), re-exported from `index.ts`.

    export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed';

    /** Spec §5.3. Keyed on the `human:` actor prefix. */
    export function trustTier(c: Pick<Concept, 'verified'>): TrustTier;

    /** Spec §5.5: stale when today >= stale_after. `now` injectable for tests. */
    export function staleSince(c: Pick<Concept, 'staleAfter'>, now?: Date): string | undefined;

    /** Spec §5.2: a bare `{ by, at }` mapping counts as a one-element list. */
    export function normalizeVerified(value: unknown): Actor[];

Reference implementations exist upstream in
`GoogleCloudPlatform/knowledge-catalog@3fcbb9f:okf/src/reference_agent/bundle/document.py`
(`trust_tier`, `is_stale`, `normalize_verified`) — match their semantics exactly.

## Verification

- `bun test` — new colocated `core.test.ts` / `trust.test.ts` cases:
  - a v0.2 concept exposes `generated`, `verified`, `status`, `staleAfter`, `sources`
  - `updatedAt` prefers `generated.at`, falls back to `timestamp`, is undefined when neither
  - a **bare** `verified: { by, at }` mapping normalizes to a one-element array
  - `status` defaults to `'stable'` when absent
  - trust tiers: no `verified` ⇒ unverified; only `process:`/agent actors ⇒ machine-confirmed;
    any `human:` ⇒ human-reviewed, even mixed with machine actors
  - `staleSince` is inclusive of the boundary day (`today === stale_after` is stale)
  - unknown frontmatter keys still round-trip untouched (spec §4.1 forbids rejecting them)
- `bun run typecheck`
- Re-run the probe against `acme_retail`: all five v0.2 fields retained, `updatedAt` populated
  for 9 of 9 concepts.

## Out of scope

- Any UI change (015) or health/validator change (014).
- Attested Computation contract fields (016).
- Rendering `sources` — this plan only carries them.
