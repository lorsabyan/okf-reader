# @okf/core

Source-agnostic model and validator for [Open Knowledge Format](https://github.com/lorsabyan/okf-skill) (OKF)
bundles — directories of markdown files with YAML frontmatter that describe datasets, tables, metrics, APIs,
playbooks, and other concepts.

The package has two parts:

- **A browser-safe bundle model** (`@okf/core`): parses frontmatter, resolves links between concept docs,
  and reports documentation-health issues (broken links, missing descriptions, untyped/stale/undated docs,
  orphans). No `fs`, no `node:path` — safe to import from both build-time scripts and a runtime viewer in
  the browser.
- **A Node-only validator CLI** (`@okf/core/validate` + the `okf-validate` bin): walks a bundle directory on
  disk and checks it against the OKF v0.1 spec, mirroring the reference Python validator
  (`validate_okf.py` in `lorsabyan/okf-skill`).

## Install

```sh
npm install @okf/core
# or: bun add @okf/core / pnpm add @okf/core
```

## API usage

```ts
import { buildBundle, analyzeBundle, navGroups } from '@okf/core';

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
import { validateBundle } from '@okf/core/validate';

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
internal links, missing descriptions, malformed timestamps, stale/undated docs, and orphan concepts.

```sh
$ npx okf-validate ./example-bundle
warning datasets/ga4_obfuscated_sample_ecommerce: orphan - no inbound or outbound links
warning tours/ga4-essentials: orphan - no inbound or outbound links

example-bundle: 12 concept doc(s), 0 error(s), 2 warning(s)
Bundle is conformant with OKF v0.1.
```
