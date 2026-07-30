# Changelog

Notable changes to the reader app and to `@lorsabyan/okf-core`, the bundle model and
`okf-validate` CLI that ships from `packages/okf-core`. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**The version tracks this repo, not the format.** They line up at `0.2.x` today
because this release is what added OKF v0.2 support, but a future `0.3.0` would
not imply an OKF v0.3.

`@lorsabyan/okf-core` is versioned in lockstep with the app and is **not yet published to
npm**. While it is `0.x`, a minor bump may carry breaking API changes, per
semver's pre-1.0 rule.

Implementation detail beyond what is listed here lives in
[`plans/`](plans/README.md), which records each batch, its evidence, and the
decisions taken.

## [Unreleased]

## [0.2.0] — 2026-07-30

Reads **OKF v0.2**. Plans [013–017](plans/README.md).

### Added

- **Trust, status, and freshness in the UI.** A concept now shows its lifecycle
  `status` (when not the `stable` default), its trust tier derived from
  `verified` (§5.3), and a marker once past `stale_after` (§5.5).
- **Provenance rendering.** `sources` (§5.1) render below the body with author
  and last-modified, linked only when the resource is a followable URL — a
  `sources[].resource` may be a scope descriptor like *"all queries in BigQuery
  project X"*, which is deliberately not a link.
- **Attested Computation contracts** (§10). A computation concept shows its
  `runtime`, `parameters`, `executor.receipt` fields, and attester above the
  body, along with the rule that a caller supplies parameter values and never
  rewrites the computation — the boundary the type exists to enforce.
- **Health report gains `aging`, `unverified`, and `deprecated`** sections.
- **A second demo bundle**, `example-bundle-acme-retail/`, vendored
  byte-identical from upstream at `3fcbb9f`. The GA4 demo cannot exercise
  `verified`, `stale_after`, `deprecated`, or Attested Computations, because
  none are true of it — and inventing them would put fabricated provenance
  inside a provenance format.
- `.github/dependabot.yml`, using the **`bun`** ecosystem.

### Changed

- **BREAKING (`@lorsabyan/okf-core`): `HealthReport.stale` changed shape and meaning.**
  It was `{ id, timestamp }[]` computed from a 365-day age heuristic this repo
  invented. It is now `{ id, staleSince }[]` computed from the author's own
  `stale_after` (§5.5). The age heuristic survives as a separate `aging`
  field. A concept can be two years old and deliberately current, or a week old
  and already expired; one field got both wrong.
- **BREAKING (`@lorsabyan/okf-core`): `Concept` gained non-optional `verified`, `status`,
  and `sources`**, so consumers never branch on undefined. Also added:
  `generated`, `staleAfter`, `computation`, and `updatedAt`.
- **`updatedAt` is the field the UI should read.** It resolves `generated.at`
  and falls back to v0.1's `timestamp`, so the fallback lives in exactly one
  place and no UI or health code needs to know `timestamp` existed.
- `analyzeBundle` takes an injectable `now`, so a report no longer changes under
  callers as the clock crosses a concept's `stale_after`.
- `okf-validate` reports conformance against **v0.2**, and surfaces a
  bundle-declared `okf_version` (§12) when it differs.
- **`example-bundle/` migrated to v0.2 in place**, not re-vendored. Upstream
  rewrote its GA4 bundle during its own v0.2 migration, so re-vendoring would
  have swapped every metric and deleted the reader's only tour. See
  [plan 017](plans/017-revendor-example-bundle.md).
- Dependencies and workflow Actions brought current; `actions/checkout` v4 → v7
  had been running on the deprecated Node 20 runtime.

### Fixed

- **Links inside fenced code blocks were reported as broken**
  ([#8](https://github.com/lorsabyan/okf-reader/issues/8)). `extractLinkTargets`
  ran over the whole body, so a link used as an *example* inside a fence was
  link-checked as prose — and documenting OKF in OKF means writing example
  concepts inside fences. Fixed at the source, so the validator, health page,
  link graph, and root detection all agree.
- **A v0.2 bundle rendered with no dates and an empty landing page.** Both
  surfaces filtered on `timestamp`, which v0.2 retired: 0 of 9 concepts survived
  the "Recently updated" filter on a fully valid bundle.
- **`okf-validate` warned once per concept on any v0.2 bundle** — `no
  'timestamp' field`, for a field v0.2 deleted — then declared the bundle
  conformant with v0.1.
- **9 Dependabot security alerts** (4 high + 4 medium in `next`, 1 high in
  `js-yaml`). Dependabot's own PRs could never have merged: with no config it
  used the `npm` ecosystem, which bumps `package.json` without `bun.lock`, and
  CI installs `--frozen-lockfile`.

### Security

- `next` 16.2.10 → 16.2.12, `js-yaml` 5.2.1 → 5.2.2.

## [0.1.0] — 2026-07-15

Static-first Next.js reader for OKF v0.1 bundles: sidebar navigation, concept
pages, cross-links and backlinks, connection graphs, guided tours, full-text
search, bundle health, and a runtime viewer that opens a local directory or a
public GitHub repo in-browser. `@lorsabyan/okf-core` extracted as a workspace package with
the `okf-validate` CLI. Plans [001–012](plans/README.md).

[Unreleased]: https://github.com/lorsabyan/okf-reader/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lorsabyan/okf-reader/releases/tag/v0.2.0
[0.1.0]: https://github.com/lorsabyan/okf-reader/releases/tag/v0.1.0
