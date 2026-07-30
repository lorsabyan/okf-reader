# 018 — Settle the `@lorsabyan/okf-core` 0.x surface while it is still free to break

- **Status**: DONE
- **Commit**: 869092f
- **Severity**: MED (nothing is broken; the cost of fixing rises from here)
- **Category**: API / packaging
- **Estimated scope**: `packages/okf-core/src/{core,validate,node,search}.ts`, `src/lib/{bundle,search-bundle}.ts`.
- **Depends on**: —

## Why now

`@lorsabyan/okf-core` went public today and has **0 downloads**. The rough edges
[plan 009](009-report.md) identified as "cheap now, expensive once external
consumers exist" are all still open. This is the last moment they are free.

The spike named four. One is rejected below on evidence; the other three ship as
`0.3.0`.

## A. `files` / `backlinks` are `Map`s — add serialization, do not convert

    // packages/okf-core/src/core.ts — current
    export interface CoreBundle {
      byId: Map<string, Concept>;
      backlinks: Map<string, string[]>;
      files: Map<string, string>;
    }

`Map` is not JSON-serializable, so any consumer behind a JSON-RPC or HTTP
boundary — the MCP server plan 009 proposes as the first external consumer —
must write an adapter for every response.

**Decision: keep the `Map`s, add `toJSON` / `fromJSON`.** The spike framed this
as "plain-object-vs-`Map`, decide before 1.0". Converting is the wrong half of
that choice: `byId.get(id)` is the hot path for every consumer, and `Map` is the
right in-memory shape. The problem is not the representation, it is that there
is no way *out* of it. So:

    export function bundleToJSON(bundle: CoreBundle): SerializedBundle;
    export function bundleFromJSON(data: SerializedBundle): CoreBundle;

Non-breaking, and it solves the actual complaint rather than trading it for a
worse one.

## B. `walk()` is exported by accident — replace it with a real loader

`validate.ts` exports `walk(dir, root, acc)`, a Node fs-walk helper. It is public
API only because tests reached for it, and the *same function* is duplicated
privately in the app:

    packages/okf-core/src/validate.ts   export function walk(...)
    src/lib/bundle.ts                   function walk(...)      // near-identical

Plan 009 flagged that an MCP server would write a **third** copy.

**Target**: a new `./node` subpath exporting `loadBundleFromDir(dir): CoreBundle`.
`validate.ts` and the app's `loadBundle()` both consume it; `walk` stops being
public API. A separate subpath from `./validate` because loading is not
validating, and a consumer that only wants to read a bundle should not import
the validator.

The browser-safe rule is unchanged: `./node` is Node-only and, like `./validate`,
must never be re-exported from `index.ts`.

## C. `searchBundle` lives in the app but belongs in core

`src/lib/search-bundle.ts` is generic, synchronous, bundle-model-only, and has
exactly **one** import — `@lorsabyan/okf-core` itself. It is core code sitting in
the app by accident of where it was first needed. An external consumer wanting
search has to vendor the file.

**Target**: move it to `packages/okf-core/src/search.ts`, re-exported from
`index.ts` (it is browser-safe). The app imports it from the package.

## D. REJECTED — widening `Concept.resource` to an array

Plan 009 suggested `resource` "may need to become an array before 1.0". It should
not, and this is recorded so it is not re-proposed.

Spec §4.1: *"`resource`: A URI that **uniquely identifies** the underlying asset
the concept describes."* Singular is the contract, not an oversight — "uniquely
identifies" is doing the work. Across all four upstream reference bundles there
are **47** `resource:` lines and **0** plural forms.

Widening it would diverge from the spec to serve a need nobody has demonstrated.
A concept that genuinely relates to several artifacts already has `sources`
(§5.1), which *is* a list.

## Verification

- `bun test` — new cases:
  - `bundleToJSON` round-trips through `JSON.parse(JSON.stringify(...))` back to
    an equal bundle via `bundleFromJSON`
  - `loadBundleFromDir` returns the same bundle as the app's old private walk for
    `example-bundle/`
  - `search` behaves identically after the move (its existing tests move with it)
- `walk` is gone from the public surface; `index.ts` still has no `node:` imports
  reachable from it.
- `bun run typecheck && bun test && bun run build && bun run e2e`.
- Publish `0.3.0` through the release workflow, and confirm the attestation and a
  clean-room install as with `0.2.1`.

## Out of scope

- The MCP server itself (plan 009 §4). This makes it buildable without vendoring;
  building it is separate.
- Anything about the reader UI.
