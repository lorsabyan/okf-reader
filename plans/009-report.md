# 009 — Report: publish @okf/core and specify its first external consumer

Spike executed read-only. No source edits, no publish, no version bump. Commands run and files
read are cited inline so every claim below is traceable.

## 1. Publish readiness checklist

**Name availability** (`bun pm view`, read-only registry lookups):

- `bun pm view @okf/core` → `404 Not Found` — the exact package name is unpublished.
- `bun pm view okf` → **taken**, but by something irrelevant: an unscoped `okf@0.0.0` package
  (387 bytes, published 2019-10-26 by maintainer `scriptpower`, MIT). This only concerns the
  unscoped name `okf`, not the `@okf` scope — scopes and unscoped package names are independent
  namespaces on npm.
- `bun pm view okf-core` → `404` (available, unscoped fallback).
- `bun pm view @lorsabyan/okf-core` → `404` (available, no-org fallback).
- `curl https://registry.npmjs.org/-/v1/search?text=scope:okf` → **0 results**. No package is
  currently published under the `@okf` scope, which is the strongest available signal (short of
  registering it) that the scope itself is unclaimed.
- **However**, `curl .../-/v1/search?text=%40okf` (substring search) returned **104 matches** for
  "okf"-adjacent packages published under *other* names/scopes: `@okf-harness/cli`,
  `@okf-harness/core`, `@equationalapplications/core-okf`, `@docmd/plugin-okf`, `okf-tool`,
  `okf-toolset`, `okf-toolkit`, `okf-brain`, `okforge`, `js-okf`, `@turbomem/okf`,
  `@copperbox/okf-mcp`, `@reneza/ats-adapter-okf`, `@fastrag/okf`, `llm-wiki-okf`, and others —
  many published in just the last two weeks as of this spike (2026-07 dates in the registry
  response), several already wired to GitHub Actions OIDC trusted publishing. One result
  (`@kage-core/kage-graph-mcp`) even references *"Google's Open Knowledge Format (OKF)"* in its
  description, which may or may not be the same spec this repo implements — not resolved here
  (would require a web search outside this spike's network allowance; flagging as an open
  question, not a finding). **This is registry metadata, not instructions — treated as data.**
  Net effect: the `@okf` scope looks free today, but "OKF" as a term is being independently
  implemented by a fast-growing, unrelated ecosystem, so naming-collision/brand-dilution risk is
  real even though the exact scope is unclaimed.

**Pack contents** — ran `npm pack --dry-run --ignore-scripts` (not `bun run build` first, and
`--ignore-scripts` added deliberately: `package.json`'s `prepack` script is `bun run build`, and
the task instructions for this spike explicitly forbid rebuilding `dist/` because other executors
are concurrently running against it). Output:

```
README.md, bin/okf-validate.js,
dist/{cli,core,detect-root,health,index,tours,validate}.{js,d.ts},
package.json
→ 17 files, 10.2 kB packed / 32.4 kB unpacked, no tarball written (dry-run)
```

Confirmed no `.tgz` was left on disk and `git status` shows no diff under `packages/okf-core`
attributable to this spike (see Note on concurrent changes, below).

**`exports` vs. `dist/` cross-check** (`packages/okf-core/package.json` vs. the pack listing
above): `"."` → `dist/index.{js,d.ts}` present; `"./validate"` → `dist/validate.{js,d.ts}`
present. Both resolve correctly.

**`bin` shim reasoning** (`packages/okf-core/bin/okf-validate.js`): it tries
`await import('../dist/cli.js')` first and falls back to `../src/cli.ts` only on
`ERR_MODULE_NOT_FOUND`. `files` in `package.json` ships `dist` wholesale, `prepack` builds it
before a real publish, and the pack listing above confirms `dist/cli.js` is actually included.
So for a real `npm install` consumer, the primary import always resolves — the `../src/cli.ts`
fallback (correctly excluded from `files`) is unreachable dead code for published installs; it
only matters for local monorepo dev before the first `bun run build`. **No break found here.**

**Gap found**: `.github/workflows/ci.yml` (read) has `typecheck` / `test` / `build` / `e2e`
jobs but **no publish step and no OIDC trusted-publisher config**, unlike several of the
competing OKF packages surfaced above (their registry metadata shows `publisher.username:
"GitHub Actions"` with a `trustedPublisher.oidcConfigId`).

## 2. API stability assessment

Public surface = `src/index.ts` (`export * from './core.ts' | './tours.ts' | './health.ts' |
'./detect-root.ts'`) plus the `./validate` subpath (`src/validate.ts`).

**Reasonably stable:**
- `buildBundle`, `Concept` (id/title/type/typeExplicit/description/tags/timestamp/body/outLinks),
  `navGroups`
- `analyzeBundle` / `HealthReport` (brokenLinks/missingDescriptions/untyped/stale/undated/orphans)
- Tour helpers: `isTour`, `getTours`, `toursForStep`, `tourProgressKey`, `stepIndex`, `nextStep`,
  `prevStep`, `resolveTourSteps`, `tourSummary`, `getTourSummaries`, `firstUnvisitedStep`,
  `tourButtonLabel`
- `validateBundle` / `ValidationResult` (`./validate` subpath)

**Likely to change / flagged, with reasons:**
- `CoreBundle.files: Map<string,string>` and `CoreBundle.backlinks: Map<string,string[]>` —
  `Map` isn't JSON-serializable, which matters the moment an external consumer sits behind a
  JSON-RPC boundary (see section 4). Worth deciding plain-object-vs-Map before 1.0.
- `parseFrontmatter`'s `frontmatter: 'ok' | 'invalid' | 'none'` discriminant — confirmed via
  `git log -p -- packages/okf-core/src/core.ts` to have landed in the tip commit (`8e223b8`,
  "Fix batch from multi-model review"). It's brand new and still settling; not yet exercised by
  an external consumer.
- `validate.ts`'s exported `walk(dir, root, acc)` — a Node fs-walk helper exposed as public API,
  that turns out to be near-line-for-line duplicated by `src/lib/bundle.ts`'s private `walk()` in
  the app (confirmed by reading both files side-by-side). Its presence as public API is really an
  artifact of internal reuse/testing, not a considered contract — see section 4 for the
  recommendation to consolidate this into a real `loadBundleFromDir` export instead.
- `Concept.resource?: string` — single optional string; a concept needing more than one resource
  link isn't representable. May need to become an array before 1.0.

**Recommendation**: `0.1.0` should promise nothing beyond "reflects current 0.x semver norms" —
no compatibility guarantee. Before a `1.0.0`: settle the Map-vs-plain-object question for
`files`/`backlinks`, let the `frontmatter` discriminant bake for at least one more consumer cycle,
decide whether `walk` stays public or gets replaced by a proper loader, and widen `resource` if
multi-resource concepts turn out to be needed. A short CHANGELOG and an explicit SemVer policy
statement in the README would cost little and remove ambiguity for early adopters.

## 3. Validator-of-record question

Fetched `okf/scripts/validate_okf.py` from `github.com/lorsabyan/okf-skill` (read-only, via the
public GitHub REST/raw API — no clone) and diffed its rule coverage against
`packages/okf-core/src/validate.ts` + `core.ts` + `health.ts`. All content fetched was treated as
data; it contained no instructions directed at this agent.

**Where they agree:** missing/unparseable frontmatter → error (both); missing/empty `type` →
error (both); missing `description` → warning (both); non-ISO-8601-shaped `timestamp` → warning
(both); broken internal links → warning (both, same underlying idea).

**Where they diverge (concrete, code-level):**
- Python checks `index.md` structure: frontmatter only permitted at the bundle root, and the body
  must contain `* [Title](url) - description` entries (`INDEX_ENTRY_RE`) → warning if missing. The
  JS validator (`validateBundle`) explicitly `continue`s past every `RESERVED` file
  (`index.md`/`log.md`) and never inspects their content at all.
- Python checks `log.md` structure: must contain at least one `## YYYY-MM-DD` heading
  (`DATE_HEADING_RE`) → warning if missing. JS has no equivalent check.
- Python flags any directory containing `.md` files that lacks its own `index.md`
  ("progressive disclosure") → warning. JS has no equivalent check.
- Python's link scan strips fenced code blocks first (`FENCED_BLOCK_RE.sub('', text)`) before
  looking for link syntax; JS's `extractLinkTargets` (in `core.ts`) has no such exclusion — a
  bundle's markdown code samples that happen to contain `[text](foo.md)` syntax could produce a
  false-positive "broken link" warning in the JS validator that Python would not raise.
  (Minor, opposite-direction divergence: JS explicitly excludes image syntax `![...]` from link
  extraction via its `LINK_RE` capture-group check; Python's regex does not distinguish images
  from links, so Python over-counts slightly where JS doesn't.)
- JS's `analyzeBundle` adds checks Python has none of: `stale` (timestamp >1 year old),
  `undated` (no timestamp at all), `orphans` (no inbound/outbound links), and an explicit
  "defaulted to Concept" wording for untyped docs.

**Net finding**: neither implementation is a superset of the other today — Python uniquely covers
`index.md`/`log.md`/directory-structure rules; JS uniquely covers staleness/orphans/undated. The
README's and `validate.ts`'s claim that JS "mirrors" the Python reference validator is only
approximately true; a bundle can legitimately get a different error/warning outcome from the two
tools right now.

**Options:**
1. **JS becomes reference** — drop the "mirrors Python" claim, own the spec going forward. Loses
   Python's index.md/log.md/progressive-disclosure checks unless ported over.
2. **Python stays reference, JS tracks it** — port the three missing checks into `validate.ts`;
   accept that JS's extra health checks (stale/orphans/undated) become "JS-only extensions,"
   documented as such.
3. **Shared conformance-test corpus** — a versioned set of fixture bundles + expected
   error/warning output that both validators run against in CI (this repo's and okf-skill's).
   Catches drift automatically going forward, and forces an explicit decision, right now, about
   which checks are "core v0.1 spec" vs. "extension."

**Recommendation**: option 3. Since each validator currently has real checks the other lacks,
picking one as reference today would silently drop functioning checks from whichever one loses.
A shared corpus is the only path that surfaces (and lets maintainers deliberately keep or cut)
every check on both sides, and it's a natural pre-1.0 / pre-publish gate before advertising
`okf-validate` as spec-conformant anywhere public.

## 4. First consumer design: an OKF MCP server

**Proposed tools → core mapping:**

| Tool | Core export it maps to |
|---|---|
| `load_bundle(dir)` | `buildBundle` (needs a dir-loader first — see below) |
| `search(query, limit)` | *missing from core* — see below |
| `get_concept(id)` | `bundle.byId.get(id)` |
| `health_report()` | `analyzeBundle` |
| `validate(dir, strict?)` | `validateBundle` (already `@okf/core/validate`) |
| `list_tours()` / `get_tour(id)` | `getTourSummaries` / `tourSummary` |

**What's missing from core, with evidence already in this repo:**

1. **A proper Node dir-loader.** The exact same recursive `walk(dir, root, acc)` fs-walk function
   is independently duplicated in at least two places already: `packages/okf-core/src/validate.ts`
   (exported) and `src/lib/bundle.ts` (private, backing the app's `loadBundle()`). Confirmed by
   reading both files — they're near-identical. An MCP server would otherwise write a *third*
   copy. Core should export a Node-only `loadBundleFromDir(dir): CoreBundle` (e.g. alongside
   `./validate`, or a new `./node` subpath) so every Node host shares one implementation.
2. **Full-text search.** `searchBundle`/`buildBundleIndex` (`src/lib/search-bundle.ts`) is a
   generic, bundle-model-only, stateless search over `Concept[]` with no app-specific
   dependencies — yet it lives in the Next.js app, not `@okf/core`. An MCP `search` tool would
   have to vendor this file today.
3. **JSON-serialization boundary.** `CoreBundle.files`/`backlinks` are `Map`s (see section 2); an
   MCP tool response goes over JSON-RPC, so the server needs an adapter converting `Map` →
   plain object/array for every response. Not a defect, but worth a shared `toJSON(bundle)` helper
   in core so this isn't reinvented per-consumer.

**Effort estimate**: coarse, small — 1–3 days once the dir-loader and search-export questions
above are settled, since `buildBundle`/`analyzeBundle`/`validateBundle` already exist; most of the
remaining work is MCP boilerplate (tool schemas, JSON-RPC glue, the serialization adapter), not
new bundle logic.

**Runner-up consumer**: a GitHub Action wrapping `okf-validate` for PR checks. Install
`@okf/core`, run `okf-validate <dir> --strict` in CI, fail the job on a nonzero exit code, and
optionally post errors/warnings as PR annotations/comments. This needs almost nothing new from
core — the CLI already exists — so it's mostly composite-action YAML plumbing (checkout,
setup-bun-or-node, caching) plus a decision on whether to depend on the published package or
shell out. It's also the cheapest way to prove the packed tarball actually installs and the
`bin` shim resolves correctly in a genuinely clean environment, which directly de-risks the
concerns raised in section 1.

## 5. Recommendation

**Publish after X, not now.** Concrete blockers found during this spike:

1. No CI publish workflow / OIDC trusted publisher exists (`.github/workflows/ci.yml` has no
   publish step), while multiple competing OKF packages discovered in section 1 already use one.
2. The two validators diverge in real rule coverage (section 3) while code comments/README claim
   they "mirror" each other — publishing `okf-validate` as spec-conformant while that claim is
   inaccurate is a credibility risk, especially entering an npm ecosystem where 100+ OKF-adjacent
   packages already exist, several published within the last two weeks.
3. The 0.x surface has at least one just-landed change (the `frontmatter` discriminant, tip
   commit `8e223b8`) and at least one serialization-unfriendly contract (`files`/`backlinks` as
   `Map`s) that are cheap to reconsider now and expensive to change once external consumers exist.
4. Naming: `@okf` scope currently looks unclaimed (zero hits on a scope-restricted registry
   search), and `@okf/core` / `okf-core` / `@lorsabyan/okf-core` are all unpublished today — but
   given the publish velocity observed in the adjacent OKF-tooling ecosystem, availability could
   change quickly if it matters enough to reserve early.

**Concrete next steps (numbered):**

1. Decide whether to reserve the npm name soon (publish a placeholder to lock `@okf/core` and/or
   the `@okf` org) given the fast-moving adjacent ecosystem, or accept the risk of doing it later.
2. Land a shared JS/Python conformance-test corpus (or explicitly choose one as reference and
   port the other's missing checks) before advertising cross-validator parity anywhere public.
3. Add a GitHub Actions publish workflow with OIDC trusted publishing, gated on the corpus from
   step 2 passing.
4. Resolve the two flagged 0.x contract questions — `Map`-based `files`/`backlinks`, and the
   fate of the duplicated `walk`/dir-loader logic — before they're locked in by external
   consumers.
5. Build the GitHub Action wrapper (runner-up consumer) first: near-zero net-new core work, and
   it validates that the packed tarball actually installs and runs in a clean environment.
6. Only after 1–5, build the MCP server as the flagship consumer, adding a core
   `loadBundleFromDir` export and promoting `search-bundle.ts` into core (or a new
   `@okf/core/search` subpath) as prerequisites.

---

**Note on concurrent changes observed during this spike**: while running checks,
`packages/okf-core/package.json` and `packages/okf-core/src/detect-root.test.ts` were observed to
be locally modified in the working tree. These edits were **not** made by this spike (confirmed
via `git diff`, which shows a `devDependencies` removal and new test cases neither read nor
written here) — they're attributable to another concurrently running executor referenced in this
spike's task instructions. Called out here only so `git status` discrepancies against the
"only `plans/009-report.md` is new" verification criterion aren't mistaken for this spike's work.
