# 017 — Migrate `example-bundle/` to OKF v0.2

- **Status**: DONE
- **Commit**: 4ae3ca5 (audit) — revised at execution time, see "Corrected premise"
- **Severity**: MED (the demo contradicts the format the reader now supports)
- **Category**: Vendored content / docs
- **Estimated scope**: `example-bundle/` frontmatter, `README.md`, screenshots.
- **Depends on**: 013, 014, 015 (016 optional)

## Corrected premise

**The original plan was wrong and was not executed as written.** It assumed
`example-bundle/` was upstream's GA4 bundle at an older commit, so re-vendoring
from a newer commit would be a mechanical refresh. Checking upstream's history
before touching anything showed otherwise:

- Upstream **rewrote** its GA4 bundle during its own v0.2 migration (commit
  `780fe9d`). `event_count`, `avg_pageviews`, `user_count` and the whole
  `references/joins/` directory were **deleted** and replaced with seven
  different metrics (`acquired_users`, `purchasers`, …).
- `tours/ga4-essentials.md` is **ours**, added in okf-reader commit `696d549`.
  Tours are this reader's extension — `steps` appears zero times in the OKF
  spec — so upstream has none and never will.
- That tour's steps point at `event_count`, `user_count`, `day_count`: three of
  the metrics upstream deleted.

So a wholesale re-vendor would have replaced every metric, dropped the joins
doc, **deleted the reader's only tour**, and broken three e2e tests — while
presenting itself as a routine content refresh. `example-bundle/` is the
pre-v0.2 upstream bundle (byte-identical to it, verified against upstream git)
plus one local concept.

**Decision: migrate in place instead.** Keep every existing concept and convert
only the frontmatter encoding. The demo's job is to demo okf-reader, and the
tour is a first-class okf-reader feature that needs demo content.

## What was done

### A. Frontmatter migrated, content untouched

For all 12 concept docs:

    # before (v0.1)                      # after (v0.2)
    timestamp: '2026-05-28T22:50:07Z'    generated:
                                           by: reference_agent/unknown
                                           at: '2026-05-28T22:50:07Z'

`at` preserves the **original instant**. The content did not change, only its
encoding, so claiming a new generation date would be false. (Upstream set `at`
to its migration date — but upstream genuinely regenerated its content at the
same time; we did not.)

`generated.by` is `reference_agent/unknown` on the 11 vendored docs. OKF v0.1
had no `generated` field, and upstream's history records no model either — the
producer is known, its version is not, and that missing information is exactly
what v0.2 added `generated` to fix. `tours/ga4-essentials.md` gets
`human:lorsabyan`, the commit author of `696d549`.

### B. `# Citations` → `sources`

Each trailing `# Citations` URL list (11 docs, 4 distinct URLs) became `sources`
entries with a slug `id` and the `resource`, and the body section was removed.

**No `title` was invented.** The real page titles are recorded nowhere we can
verify, and §5.1 makes `title` optional — fabricating them would be invented
provenance inside a provenance format, which is the one thing this format must
not contain. `Provenance` falls back to rendering the `resource`.

**No `[^id]` body footnotes were added.** Attributing a specific claim to a
specific source is a judgement about which sentence rests on which URL. Upstream
made those judgements while regenerating prose; inferring them mechanically
would be guessing. Frontmatter provenance is asserted; per-claim attribution is
simply not claimed, which §5.1 permits.

**No `verified`, `status`, or `stale_after` were added.** Nobody verified this
content and nothing about it is deprecated or expiring. Inventing trust signals
to make the demo look richer would be exactly the fabrication above. The demo
therefore shows the `unverified` tier honestly — which is itself a useful thing
for a reader to see rendered.

### C. Docs

`README.md` now states that the bundle is no longer byte-identical to any
upstream commit, names the two local changes, and explains why re-vendoring was
rejected. Screenshots regenerated.

## Verification

- Both validators agree the migrated bundle is **conformant with OKF v0.2, 0
  errors**: this repo's `okf-validate` (2 orphan warnings) and okf-skill's
  independent Python validator (1 missing-`index.md` warning). Both warnings are
  pre-existing structural observations, not migration defects.
- `bun run typecheck && bun test && bun run build && bun run e2e` — 225 tests,
  e2e 6 passed / 1 skipped. **No e2e assertion needed changing**, which is the
  clearest evidence that migrating in place preserved the demo: the tour flow,
  the "Event Count" navigation, and the "Cited by" backlink all still hold.
- Screenshots show the new UI: the trust-tier badge and a date sourced from
  `generated.at`.
- Provenance verified in the built static output.

## Out of scope

- Re-vendoring upstream's current GA4 bundle. Rejected above; it would delete
  the tour and swap all content.
- ~~A second demo bundle.~~ **Done in the same batch**: `example-bundle-acme-retail/`
  vendors upstream's Acme Retail byte-identical at `3fcbb9f`. It carries
  `verified` (8 docs), `stale_after` (7), `status: deprecated` (1), and two
  Attested Computations — the trust features GA4 cannot demonstrate without
  fabricating them. It is not the default demo and is not used by tests or
  screenshots; the reader builds one bundle at a time.
