# 001 — Fix search-palette state defects and build a shared lowercase index

- **Status**: DONE
- **Commit**: 8e223b8
- **Severity**: HIGH
- **Category**: Bugs & correctness + Performance
- **Rule**: Beyond the scan (plus react-doctor/async-await-in-loop, deslop/unused-dependency)
- **Estimated scope**: 7 files (~200 changed lines): src/components/search/SearchCommand.tsx, src/components/SearchDialog.tsx, src/lib/search-bundle.ts (+test), new src/lib/render-cache.ts (+test), src/lib/sources/local.ts, src/lib/markdown.ts (+test), package.json

**File ownership note:** another executor works on other files concurrently. Only touch the files listed above. Do NOT touch src/components/open/OpenViewer.tsx — a later plan (003) consumes the APIs you create here; keep the exported signatures exactly as specified.

## Problem

### A. Stale-response race + state never reset in the search palette (HIGH, bug)

`src/components/search/SearchCommand.tsx:88-106` — the debounced search effect awaits `provider(query)` with no sequence guard; the cleanup clears only the timer, never an in-flight promise. The static-site provider (`SearchDialog.tsx:31-36`) does a real network `r.data()` fetch per hit, so an older query's response can resolve *after* a newer one and clobber `hits` with results for the wrong query.

    // src/components/search/SearchCommand.tsx:88 — current
    useEffect(() => {
      if (!open || !query.trim()) {
        setHits([]);
        return;
      }
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await provider(query);
          setUnavailable(false);
          setHits(results);
          setSelected(results[0]?.href ?? '');
        } catch {
          setUnavailable(true);
          setHits([]);
        }
      }, 150);
      return () => clearTimeout(debounceRef.current);
    }, [query, open, provider]);

Additionally `query`, `selected`, and `unavailable` are never reset when the dialog closes (only `hits` is cleared via the `!open` branch), so reopening the palette (⌘K) shows the previous query pre-filled and can flash the stale "unavailable" message.

### B. A rejected Pagefind import is memoized forever (LOW, bug)

`src/components/SearchDialog.tsx:18-29` — `pagefindPromise` is a module-level memo of the dynamic import. If the first import rejects (e.g. `next dev` without a built index, or a transient fetch failure on the deployed site), the rejected promise is returned on every subsequent search and search stays "unavailable" until a full page reload.

    // src/components/SearchDialog.tsx:21 — current
    function loadPagefind(): Promise<PagefindApi> {
      if (!pagefindPromise) {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        // Escape hatch so Turbopack doesn't try to statically resolve/bundle this at build time —
        // the file only exists after `next build` runs pagefind over `out/`.
        pagefindPromise = new Function('u', 'return import(u)')(`${base}/pagefind/pagefind.js`) as Promise<PagefindApi>;
      }
      return pagefindPromise;
    }

Do NOT change the `new Function('u', 'return import(u)')` mechanism — it is a deliberate Turbopack escape hatch with a constant code string (audited safe); only the memoization of rejection changes.

### C. `searchBundle` re-lowercases the whole corpus per keystroke (HIGH, perf)

`src/lib/search-bundle.ts:91-96` — every call rebuilds every concept's lowercase forms plus a full-body `combined` concatenation. The runtime viewer calls this per debounced keystroke; a GitHub-loaded bundle can be thousands of files. There is no precomputed index. (The nav filter in OpenViewer.tsx separately lowercases the same corpus — plan 003 fixes that by consuming YOUR index; the exported API below is the contract.)

    // src/lib/search-bundle.ts:91 — current (inside the per-concept loop)
    const title = concept.title.toLowerCase();
    const description = concept.description.toLowerCase();
    const tagsAndType = [...concept.tags, concept.type].join(' ').toLowerCase();
    const body = concept.body.toLowerCase();
    const combined = `${title} ${description} ${tagsAndType} ${body}`;

### D. Markdown render results are not cacheable across navigations (MEDIUM, perf — infrastructure half)

`src/lib/markdown.ts:248-260` `renderMarkdown` runs the full unified pipeline synchronously (`processSync`). The runtime viewer memoizes only the *current* concept, so every navigation re-parses. This plan creates the cache helper; plan 003 wires it into the viewer.

### E. Local folder reads are fully sequential (LOW, perf — rule react-doctor/async-await-in-loop)

`src/lib/sources/local.ts:44-52` (`readHandle`) and `:79-86` (`readFileList`) await one `file.text()` at a time. Canonical recipe from `react-doctor rules explain async-await-in-loop`: "Collect the items, then use `await Promise.all(items.map(...))` so independent work runs at the same time."

### F. Bare `shiki` dependency is never imported (LOW — rule deslop/unused-dependency)

`package.json:41` `"shiki": "4.3.1"` — no source file imports bare `shiki`; the only usage is `@shikijs/rehype`, which depends on `shiki` transitively (same pinned version). Recipe from the diagnostic: remove it from package.json if genuinely unused.

### G. "Not yet written" info is hover-only (LOW, a11y)

`src/lib/markdown.ts:109-113` — broken cross-links are demoted to `<span class="link-broken" title="Not yet written: …">`; the explanation lives only in the mouse-only `title` attribute. Screen-reader and keyboard users get an undecorated dead string.

    // src/lib/markdown.ts:109 — current
    addClassName(properties, 'link-broken');
    node.tagName = 'span';
    delete properties.href;
    properties.title = `Not yet written: ${id}`;

## Target

### A. SearchCommand — sequence guard + reset-on-close

    const requestIdRef = useRef(0);

    useEffect(() => {
      if (!open || !query.trim()) {
        setHits([]);
        return;
      }
      clearTimeout(debounceRef.current);
      const requestId = ++requestIdRef.current;
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await provider(query);
          if (requestId !== requestIdRef.current) return; // stale response — a newer query is in charge
          setUnavailable(false);
          setHits(results);
          setSelected(results[0]?.href ?? '');
        } catch {
          if (requestId !== requestIdRef.current) return;
          setUnavailable(true);
          setHits([]);
        }
      }, 150);
      return () => clearTimeout(debounceRef.current);
    }, [query, open, provider]);

    // Fresh palette on every open: discard the previous session's query,
    // results, and unavailable flag, and invalidate any in-flight request.
    useEffect(() => {
      if (open) return;
      requestIdRef.current++;
      setQuery('');
      setHits([]);
      setSelected('');
      setUnavailable(false);
    }, [open]);

### B. SearchDialog — allow retry after a rejected import

    function loadPagefind(): Promise<PagefindApi> {
      if (!pagefindPromise) {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        // Escape hatch so Turbopack doesn't try to statically resolve/bundle this at build time —
        // the file only exists after `next build` runs pagefind over `out/`.
        const loading = new Function('u', 'return import(u)')(`${base}/pagefind/pagefind.js`) as Promise<PagefindApi>;
        // A rejected import (dev server without a built index, transient fetch
        // failure) must not be memoized forever — let the next search retry.
        loading.catch(() => {
          if (pagefindPromise === loading) pagefindPromise = null;
        });
        pagefindPromise = loading;
      }
      return pagefindPromise;
    }

### C. search-bundle.ts — exported index + index-aware search (exact API contract; plan 003 imports these names)

    export interface ConceptIndexEntry {
      title: string;
      id: string;
      type: string;
      description: string;
      tags: string[];
      tagsAndType: string;
      body: string;
      combined: string;
    }

    /** Lowercased search/filter fields per concept, keyed by the concept's original id. */
    export type BundleIndex = Map<string, ConceptIndexEntry>;

    /** Build once per bundle (the caller memoizes); every field is pre-lowercased. */
    export function buildBundleIndex(bundle: Pick<CoreBundle, 'concepts'>): BundleIndex {
      const index: BundleIndex = new Map();
      for (const c of bundle.concepts) {
        const title = c.title.toLowerCase();
        const id = c.id.toLowerCase();
        const type = c.type.toLowerCase();
        const description = c.description.toLowerCase();
        const tags = c.tags.map((t) => t.toLowerCase());
        const tagsAndType = [...tags, type].join(' ');
        const body = c.body.toLowerCase();
        index.set(c.id, {
          title, id, type, description, tags, tagsAndType, body,
          combined: `${title} ${description} ${tagsAndType} ${body}`,
        });
      }
      return index;
    }

`searchBundle` gains an optional trailing `index` parameter (backward compatible — existing callers/tests keep working) and reads all lowercase forms from the entry instead of recomputing, including the `bodyLower` in the excerpt-source selection at current line 117:

    export function searchBundle(
      bundle: Pick<CoreBundle, 'concepts'>,
      query: string,
      limit = 8,
      index?: BundleIndex,
    ): BundleHit[] {
      const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [];
      const idx = index ?? buildBundleIndex(bundle);
      // per-concept loop: const entry = idx.get(concept.id)!; score against
      // entry.title/entry.description/entry.tagsAndType/entry.body/entry.combined;
      // excerpt-source check uses entry.body instead of concept.body.toLowerCase().
      ...
    }

Scoring weights (10/5/3/1), AND-across-words semantics, stable sort, and `buildExcerpt` are unchanged.

### D. New src/lib/render-cache.ts (exact API contract; plan 003 imports this name)

    /**
     * Per-scope memo for expensive pure computations (markdown renders).
     * Keyed by an owning object (e.g. the loaded bundle) via WeakMap so a
     * replaced bundle's cache is garbage-collected wholesale; within a scope,
     * insertion-order FIFO eviction beyond MAX_ENTRIES.
     */
    const caches = new WeakMap<object, Map<string, unknown>>();
    const MAX_ENTRIES = 100;

    export function cachedCompute<T>(scope: object, key: string, compute: () => T): T {
      let cache = caches.get(scope);
      if (!cache) {
        cache = new Map();
        caches.set(scope, cache);
      }
      if (cache.has(key)) return cache.get(key) as T;
      const value = compute();
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
      cache.set(key, value);
      return value;
    }

### E. local.ts — parallel reads, deterministic insertion order

Nav order derives from file-map insertion order (`navGroups` sorts groups, not items), so reads run in parallel but insertion stays deterministic: collect entries in iteration order, `Promise.all` the text reads, then `set` in the collected order. For `readHandle`, read each directory's files in parallel, recurse into subdirectories in parallel *into per-subdir maps*, then merge those maps in iteration order:

    export async function readHandle(dir: DirHandle, prefix: string, acc: Map<string, string>) {
      const subdirs: [string, DirHandle][] = [];
      const files: [string, Promise<string>][] = [];
      for await (const [name, entry] of dir.entries()) {
        if (name.startsWith('.')) continue;
        const path = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === 'directory') subdirs.push([path, entry]);
        else if (name.endsWith('.md')) files.push([path, entry.getFile().then((f) => f.text())]);
      }
      const texts = await Promise.all(files.map(([, p]) => p));
      files.forEach(([path], i) => acc.set(path, texts[i]));
      const subMaps = await Promise.all(
        subdirs.map(async ([path, entry]) => {
          const sub = new Map<string, string>();
          await readHandle(entry, path, sub);
          return sub;
        }),
      );
      for (const sub of subMaps) for (const [p, t] of sub) acc.set(p, t);
    }

`readFileList` analogously: filter the kept entries in list order first, then `const texts = await Promise.all(kept.map((f) => f.text()))` and `set` in list order (the `name` derivation loop stays as-is).

### F. package.json — delete the `"shiki": "4.3.1",` line. Run `bun install` so the lockfile updates.

### G. markdown.ts — screen-reader-visible "not yet written"

Append a visually-hidden suffix child to the broken-link span (keep the `title` for mouse users; `sr-only` is Tailwind's built-in class and `span.className` is already allowed by the sanitize schema). hast child node shape:

    addClassName(properties, 'link-broken');
    node.tagName = 'span';
    delete properties.href;
    properties.title = `Not yet written: ${id}`;
    node.children = [
      ...(node.children ?? []),
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['sr-only'] },
        children: [{ type: 'text', value: ' (not yet written)' }],
      },
    ];

If `HastNode`'s type doesn't allow this literal, extend the local type minimally — do not add dependencies.

## Repo conventions to follow

- bun:test, colocated `*.test.ts` next to sources; imitate `src/lib/search-bundle.test.ts` and `src/lib/markdown.test.ts` style.
- Doc comments explain constraints, not mechanics (see existing headers in search-bundle.ts / markdown.ts).
- No new dependencies. Named exports from lib files.

## Steps

1. Apply target A to SearchCommand.tsx (add `requestIdRef`, guard both resolution paths, add the reset-on-close effect).
2. Apply target B to SearchDialog.tsx.
3. Apply target C to search-bundle.ts; update `searchBundle` internals to read from the entry. Add tests: `buildBundleIndex` lowercases every field; `searchBundle(bundle, q, 8, index)` returns identical results to `searchBundle(bundle, q)`; existing tests unchanged and passing.
4. Create src/lib/render-cache.ts per target D with src/lib/render-cache.test.ts: same scope+key → identical (`toBe`) result and `compute` called once; different scope → separate entries; eviction beyond 100 entries re-computes the evicted key.
5. Apply target E to local.ts (both functions).
6. Apply target F (package.json + `bun install`).
7. Apply target G to markdown.ts; update/extend markdown.test.ts: broken-link output contains `(not yet written)` inside an `sr-only` span, survives sanitization.
8. Re-read your full diff; remove unrelated churn.

## Boundaries

- Only the seven files listed (plus their tests and bun.lock). NEVER touch OpenViewer.tsx or anything under src/app/.
- Do not rename existing exports; `searchBundle(bundle, query)` and `searchBundle(bundle, query, limit)` call forms must keep working.
- Do not change scoring weights, excerpt shape, debounce timing (150ms), or the `new Function` import mechanism.
- No new dependencies. Nothing committed.
- STOP and report if any quoted "current" code no longer matches (drift from commit 8e223b8).

## Verification

- **Mechanical**: `bun test src/lib src/components` and `bun run typecheck` pass. `npx react-doctor@latest` — the `async-await-in-loop` (local.ts) and `unused-dependency` (shiki) diagnostics are gone; overall score not lower than 46.
- **Behavior check**: `bun run build && bun run e2e` passes (the smoke suite exercises ⌘K search end-to-end against the static build). Confirm reopening the palette after a search shows an empty input.
- **Done when**: all above pass and the diff contains only the described changes.
