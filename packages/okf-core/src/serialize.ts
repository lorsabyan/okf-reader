import { buildBundle, type Concept, type CoreBundle } from './core.ts';

/**
 * JSON serialization for a `CoreBundle`.
 *
 * `CoreBundle` holds `byId`, `backlinks`, and `files` as `Map`s, which
 * `JSON.stringify` silently turns into `{}`. Any consumer behind a JSON-RPC or
 * HTTP boundary — an MCP server, a serving layer — hits this immediately.
 *
 * Plan 009 framed the fix as "plain objects vs `Map`, decide before 1.0".
 * Converting is the wrong half of that choice: `byId.get(id)` is the hot path
 * for every in-memory consumer, and `Map` is the right shape for it. The defect
 * is not the representation, it is that there was no way *out* of it. So the
 * `Map`s stay and this provides the exit.
 *
 * Browser-safe — no `node:*` — so it is re-exported from `index.ts`.
 */

/** A `CoreBundle` in plain JSON. `backlinks` and `files` become objects. */
export interface SerializedBundle {
  name: string;
  concepts: Concept[];
  backlinks: Record<string, string[]>;
  files: Record<string, string>;
}

/**
 * Plain-JSON form of a bundle, safe for `JSON.stringify`.
 *
 * `byId` is deliberately omitted: it is an index over `concepts`, so shipping it
 * would double the payload and let the two disagree. `bundleFromJSON` rebuilds
 * it.
 */
export function bundleToJSON(bundle: CoreBundle): SerializedBundle {
  return {
    name: bundle.name,
    concepts: bundle.concepts,
    backlinks: Object.fromEntries(bundle.backlinks),
    files: Object.fromEntries(bundle.files),
  };
}

/**
 * Rebuild a bundle from `bundleToJSON` output.
 *
 * Reconstructed from `files` via `buildBundle` rather than by rehydrating the
 * `concepts`/`backlinks` fields directly, so a round-trip cannot preserve a
 * stale or hand-edited index: the derived data is always re-derived. `files` is
 * the source of truth, exactly as it is on first load.
 */
export function bundleFromJSON(data: SerializedBundle): CoreBundle {
  return buildBundle(new Map(Object.entries(data.files)), data.name);
}
