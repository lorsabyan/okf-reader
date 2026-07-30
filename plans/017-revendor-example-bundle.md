# 017 — Re-vendor `example-bundle/` at OKF v0.2

- **Status**: TODO
- **Commit**: 4ae3ca5 (all excerpts verified against the tree)
- **Severity**: MED (the demo content contradicts the format the reader will support)
- **Category**: Vendored content / docs
- **Estimated scope**: `example-bundle/` contents, `README.md`, screenshots, e2e fixtures.
- **Depends on**: 013, 014, 015 (016 optional)

## Problem

`example-bundle/` is the vendored GA4 e-commerce bundle from
`GoogleCloudPlatform/knowledge-catalog`, and it is the **v0.1** edition:

| | count |
|---|---|
| files with `timestamp:` | 12 |
| files with `generated:` | 0 |
| files with `# Citations` | 11 |
| concept docs | 12 |

Upstream's GA4 bundle has since been migrated to v0.2 — `timestamp` replaced by
`generated: { by, at }`, the `# Citations` body list replaced by `sources` frontmatter with
`[^id]` footnotes.

So once 013–015 land, the reader will support v0.2 while its own demo content, screenshots, and
e2e fixtures all exercise the legacy shape. Nothing would be *broken* — v0.1 stays readable by
design — but the shipped example would show none of the trust, freshness, or provenance UI the
work adds, which is the least convincing possible demo of it.

CLAUDE.md says: *"`example-bundle/` is vendored demo content … don't edit it to make tests pass."*
That rule stands. This is not editing it to make tests pass — it is re-vendoring it from upstream
at a newer revision, which is the sanctioned way to change it. Attribution stays intact.

## Target

### A. Re-vendor from a pinned upstream commit

Replace `example-bundle/` with upstream `okf/bundles/ga4/` at a **pinned commit**, not `main`.
`lorsabyan/okf-skill` pins `3fcbb9f`; using the same commit keeps the two repos telling one story.

Record the commit in the vendoring note so a future bump is one edit, and preserve the existing
Apache-2.0 / Copyright Google LLC attribution.

Do **not** hand-edit the bundle contents afterwards. If something about it breaks a test, the test
or the reader is what should change — that is precisely what the CLAUDE.md rule protects.

### B. Update what points at it

- `README.md` — any statement about the example bundle's shape or its `timestamp` field.
- Screenshots (`bun run screenshots`) — dates and the new badges will differ.
- `e2e/smoke.e2e.ts` / `basepath.e2e.ts` — any assertion naming a concept, date, or count that the
  re-vendor changes. Check `docs/*.png` references too.
- Any unit test that fixtures off `example-bundle/`.

### C. Consider keeping a v0.1 fixture

v0.1 support is a deliberate, spec-mandated fallback (§13), and once the demo bundle is v0.2 there
would be no v0.1 content left in the repo exercising it. Keep a small hand-written v0.1 fixture
under test fixtures — not as vendored content — so the `timestamp` → `updatedAt` fallback and the
`# Citations` body form stay covered after this lands.

## Verification

- `bun run typecheck && bun test && bun run build && bun run e2e`.
- `okf-validate example-bundle` → 0 errors, 0 warnings (the upstream bundles are clean under both
  this repo's validator once 014 lands and under `okf-skill`'s).
- Browser pass: the demo now exercises trust tiers and `generated.at` dates end to end.
- Confirm the re-vendored tree is byte-identical to upstream at the pinned commit — no local edits.

## Out of scope

- Vendoring the other three upstream bundles. One demo bundle is enough, and `acme_retail` is the
  one worth reaching for when testing Attested Computations (016) since it is the only bundle that
  has any.
