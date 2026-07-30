# @lorsabyan/okf-core

Source-agnostic model and validator for [Open Knowledge Format](https://github.com/lorsabyan/okf-skill) (OKF)
bundles — directories of markdown files with YAML frontmatter that describe datasets, tables, metrics, APIs,
playbooks, and other concepts.

The package has two parts:

- **A browser-safe bundle model** (`@lorsabyan/okf-core`): parses frontmatter, resolves links between concept docs,
  and reports documentation-health issues (broken links, missing descriptions, untyped/stale/undated docs,
  orphans). No `fs`, no `node:path` — safe to import from both build-time scripts and a runtime viewer in
  the browser.
- **A Node-only validator CLI** (`@lorsabyan/okf-core/validate` + the `okf-validate` bin): walks a bundle directory on
  disk and checks it against the OKF **v0.2** spec.

### On the Python validator

An earlier version of this README said the CLI "mirrors" the reference Python validator
(`validate_okf.py` in [`lorsabyan/okf-skill`](https://github.com/lorsabyan/okf-skill)). It does not, and
the two are measured rather than assumed to agree. Against okf-skill's
[benchmark](https://github.com/lorsabyan/okf-skill/tree/main/benchmark) — 19 bundles each carrying one
seeded defect, 10 valid bundles shaped the way naive implementations trip over:

| | Detection (19 defects) | Clean pass (10 valid) |
|---|---|---|
| `okf-validate` (this package) | 9/19 | 10/10 |
| `validate_okf.py` (okf-skill) | 19/19 | 10/10 |

The detection gap is a **scope** decision, not a defect: this package implements the checks a reader needs,
not full lint coverage. It has no `index.md` / `log.md` structure checks and no progressive-disclosure
check; it does have staleness, aging, orphan, and unverified checks the Python validator lacks. Neither is
a superset of the other. Use `validate_okf.py` if you want the stricter authoring gate.

Clean pass is the number that is comparable across tools, and both are at 10/10.

## Install

```sh
npm install @lorsabyan/okf-core
# or: bun add @lorsabyan/okf-core / pnpm add @lorsabyan/okf-core
```

## API usage

```ts
import { buildBundle, analyzeBundle, navGroups } from '@lorsabyan/okf-core';

// `files` is a Map of bundle-relative posix paths to raw markdown contents,
// e.g. collected from disk, a git tree, or fetched over HTTP.
const bundle = buildBundle(files, 'my-bundle');

const health = analyzeBundle(bundle);
console.log(health.brokenLinks, health.orphans, health.stale);

const groups = navGroups(bundle); // for building a sidebar/TOC
```

For the Node-only validator, import the `./validate` subpath (kept separate so the main entry point stays
browser-safe):

```ts
import { validateBundle } from '@lorsabyan/okf-core/validate';

const { errors, warnings } = validateBundle('./my-bundle');
```

## CLI usage

```sh
npx okf-validate <bundle-dir> [--strict]
```

- Exit code `0`: bundle is conformant.
- Exit code `1`: one or more errors were found (or, with `--strict`, one or more warnings).
- Exit code `2`: usage error (bad arguments) or the target isn't a readable directory.

Errors are missing/unparseable frontmatter and a missing or empty `type` field. Warnings cover broken
internal links, missing descriptions, malformed dates, stale/aging/undated docs, deprecated and
unverified concepts, and orphans.

```sh
$ npx okf-validate ./example-bundle
warning datasets/ga4_obfuscated_sample_ecommerce: orphan - no inbound or outbound links
warning tours/ga4-essentials: orphan - no inbound or outbound links
example-bundle: 12 concept doc(s), 0 error(s), 2 warning(s)
Bundle is conformant with OKF v0.2.
```

## Versioning

`0.x` — no compatibility guarantee, per semver's pre-1.0 rule. `0.2.0` already carries breaking changes
from `0.1.0`: `HealthReport.stale` changed shape and meaning, and `Concept` gained non-optional `verified`,
`status`, and `sources`. See the
[CHANGELOG](https://github.com/lorsabyan/okf-reader/blob/main/CHANGELOG.md).

Known rough edges to settle before a `1.0.0`, carried over from the
[publish spike](https://github.com/lorsabyan/okf-reader/blob/main/plans/009-report.md):

- `CoreBundle.files` and `CoreBundle.backlinks` are `Map`s, which are not JSON-serializable — awkward the
  moment a consumer sits behind a JSON-RPC boundary.
- `walk()` is exported from `./validate` as an artifact of internal reuse rather than a considered
  contract; a real `loadBundleFromDir` would be the better export.
- `Concept.resource` is a single optional string, so a concept needing more than one resource link is not
  representable.
- Links inside inline code spans and four-space indented blocks are still counted as links. Fenced blocks
  are excluded; these two are a documented limit, matching the Python validator.
