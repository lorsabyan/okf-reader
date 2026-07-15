# 003 — Runtime viewer: error boundary, live regions, shared index + render cache

- **Status**: DONE
- **Commit**: 8e223b8 (depends on plan 001 being applied first — imports `buildBundleIndex`, `BundleIndex`, `cachedCompute`)
- **Severity**: HIGH (error boundary, live regions) with MEDIUM companions
- **Category**: Bugs & correctness + Performance + Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 2 files: new src/components/open/ViewerErrorBoundary.tsx (~45 lines), src/components/open/OpenViewer.tsx (~80 changed lines)

**File ownership note:** you own OpenViewer.tsx exclusively. Do NOT touch src/lib/* or any other component — plan 001 already added the APIs you consume; if `buildBundleIndex`/`cachedCompute` are missing from src/lib, STOP and report instead of creating them.

## Problem

### A. No error boundary — a malformed bundle white-screens the SPA (HIGH, bug)

The viewer renders arbitrary GitHub/local markdown (auto-loaded from `?src=` deep links). A throw inside the synchronous `renderMarkdown` (or any view) unmounts the entire component tree: loaded bundle, recents, route — all gone. No `error.tsx` or boundary exists anywhere in the repo. The switch to protect is `BundleShell`'s `<main>` (OpenViewer.tsx:551-561):

    // src/components/open/OpenViewer.tsx:551 — current
    <main ref={mainRef} tabIndex={-1} className="min-w-0 px-6 py-8 outline-none md:px-12">
      {route === HEALTH_ROUTE ? (
        <HealthView bundle={bundle} />
      ) : concept ? (
        <ConceptView bundle={bundle} concept={concept} />
      ) : route ? (
        <p className="text-muted-foreground">No concept “{route}” in this bundle.</p>
      ) : (
        <HomeView bundle={bundle} />
      )}
    </main>

### B. Load status/errors are silent for assistive tech (HIGH, a11y — WCAG 4.1.3)

    // src/components/open/OpenViewer.tsx:890-895 — current
    {busy && (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {busy}
      </p>
    )}
    {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

### C. Nav/search re-lowercase the corpus; nav map duplicated across two mounts (HIGH, perf)

`BundleNavContent` (OpenViewer.tsx:355-369) builds a per-instance lowercased-bodies Map and re-lowercases meta fields per keystroke; it is mounted twice (desktop nav :542, mobile drawer :526). `searchProvider` (:479-487) calls `searchBundle(bundle, query)` which re-lowercases everything per keystroke. Plan 001 added `buildBundleIndex`/`BundleIndex` to src/lib/search-bundle.ts exactly for this.

    // src/components/open/OpenViewer.tsx:355 — current (inside BundleNavContent)
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const bodies = useMemo(
      () => new Map(bundle.concepts.map((c) => [c.id, c.body.toLowerCase()])),
      [bundle],
    );
    const matchesMeta = (c: Concept) =>
      !needle ||
      c.title.toLowerCase().includes(needle) ||
      c.id.toLowerCase().includes(needle) ||
      c.type.toLowerCase().includes(needle) ||
      c.tags.some((t) => t.toLowerCase().includes(needle));
    const matchesBody = (c: Concept) => !!needle && (bodies.get(c.id) ?? '').includes(needle);
    const match = (c: Concept) => matchesMeta(c) || matchesBody(c);

### D. Markdown fully re-parses on every navigation (MEDIUM, perf)

`Markdown` (:109-115) and `ConceptView` (:117-122) wrap `renderMarkdown` in `useMemo` — which caches only the latest value, so concept→home→concept re-parses everything. Plan 001 added `cachedCompute` to src/lib/render-cache.ts.

    // src/components/open/OpenViewer.tsx:110 — current
    const { html } = useMemo(
      () => renderMarkdown(body, fromId, (id) => bundle.byId.has(id), hashHref),
      [bundle, body, fromId],
    );
    // :119 — current
    const rendered = useMemo(
      () => renderMarkdown(concept.body, concept.id, (id) => bundle.byId.has(id), hashHref, concept.description),
      [bundle, concept],
    );

### E. Small a11y/correctness companions (MEDIUM/LOW)

- `:419-431` — active nav `<a>` is color-only, no `aria-current` (`route === c.id && 'bg-accent …'`).
- `:877-883` — the GitHub repo `<Input>` has only a placeholder, no accessible label.
- `:282-303` — ShareButton's Share/Copied/Copy-failed label swap is not announced.
- `:717-738` — on a failed GitHub load (`load()` returns `false`), `setGithubRef(resolvedRef)` and `setShareParam(src)` still run, leaving a `?src=` URL that advertises a bundle that isn't loaded:

      const ok = load(files, name, opts);
      setGithubRef(resolvedRef);
      const src = formatGithubRef(resolvedRef);
      setShareParam(src);
      if (ok) recordGithubRecent(src, name);

## Target

### A. New file src/components/open/ViewerErrorBoundary.tsx

    'use client';

    import { Component, type ReactNode } from 'react';
    import { Button } from '@/components/ui/button';

    /**
     * Contains render-time crashes from untrusted bundle content (the viewer
     * renders arbitrary GitHub/local markdown): without this, one throw in
     * ConceptView/renderMarkdown unmounts the whole SPA and discards the
     * loaded bundle. Remounted per-route via `key` so navigating away from a
     * crashing concept recovers automatically.
     */
    export default class ViewerErrorBoundary extends Component<
      { children: ReactNode },
      { error: Error | null }
    > {
      state: { error: Error | null } = { error: null };

      static getDerivedStateFromError(error: Error) {
        return { error };
      }

      render() {
        if (this.state.error) {
          return (
            <div role="alert" className="mx-auto max-w-lg py-12">
              <h2 className="text-lg font-semibold">This page failed to render</h2>
              <p className="mt-2 break-words text-sm text-muted-foreground">
                {String(this.state.error.message || this.state.error)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The rest of the bundle is still loaded — pick another concept from the
                sidebar, or try again.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
            </div>
          );
        }
        return this.props.children;
      }
    }

Wrap the `<main>` switch in `BundleShell`, keyed by route so navigation resets a tripped boundary:

    <main ref={mainRef} tabIndex={-1} id="main-content" className="min-w-0 px-6 py-8 outline-none md:px-12">
      <ViewerErrorBoundary key={route}>
        {route === HEALTH_ROUTE ? ( ...unchanged switch... )}
      </ViewerErrorBoundary>
    </main>

(`id="main-content"` also makes the root layout's skip link — plan 002 — work in the runtime viewer.)

### B. Live regions

    {busy && (
      <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {busy}
      </p>
    )}
    {error && (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {error}
      </p>
    )}

### C. One shared BundleIndex

In `BundleShell` (where `groups` is already memoized, :476):

    import { buildBundleIndex, searchBundle, type BundleIndex } from '@/lib/search-bundle';
    ...
    const index = useMemo(() => buildBundleIndex(bundle), [bundle]);

Pass `index` as a new prop into both `BundleNavContent` mounts (:526 and :542). Inside `BundleNavContent`, delete the `bodies` memo and rewrite the matchers against the entry:

    function BundleNavContent({ bundle, index, groups, route, shareable, onClose, onNavigate, onOpenSearch }: {
      ...existing props...
      index: BundleIndex;
    }) {
      const [q, setQ] = useState('');
      const needle = q.trim().toLowerCase();
      const matchesMeta = (c: Concept) => {
        if (!needle) return true;
        const e = index.get(c.id);
        return !!e && (e.title.includes(needle) || e.id.includes(needle) || e.type.includes(needle) || e.tags.some((t) => t.includes(needle)));
      };
      const matchesBody = (c: Concept) => !!needle && !!index.get(c.id)?.body.includes(needle);
      const match = (c: Concept) => matchesMeta(c) || matchesBody(c);
      ...rest unchanged (the "(body match)" label logic keeps calling matchesMeta/matchesBody)...

And thread the index into search (:479):

    const searchProvider = useMemo(() => {
      return async (query: string): Promise<Hit[]> =>
        searchBundle(bundle, query, 8, index).map((hit) => ({ ... unchanged ... }));
    }, [bundle, index]);

### D. Cached markdown renders

    import { cachedCompute } from '@/lib/render-cache';
    // Markdown component:
    const { html } = useMemo(
      () => cachedCompute(bundle, `md:${fromId}`, () => renderMarkdown(body, fromId, (id) => bundle.byId.has(id), hashHref)),
      [bundle, body, fromId],
    );
    // ConceptView:
    const rendered = useMemo(
      () => cachedCompute(bundle, `c:${concept.id}`, () =>
        renderMarkdown(concept.body, concept.id, (id) => bundle.byId.has(id), hashHref, concept.description)),
      [bundle, concept],
    );

(Keep the `useMemo` wrappers — they avoid even the cache lookup on unrelated re-renders; the WeakMap keyed on `bundle` makes stale caches impossible because a re-rooted/reloaded bundle is a new object.)

### E. Companions

- Nav link: `aria-current={route === c.id ? 'page' : undefined}` on the `<a>` at :420.
- GitHub input: `aria-label="GitHub repository (owner/repo or URL)"` on the `<Input>` at :877.
- ShareButton label: wrap the text in a polite live span —

      <Button variant="outline" size="sm" onClick={share}>
        {status === 'copied' ? <Check className="size-3.5" /> : <LinkIcon className="size-3.5" />}
        <span aria-live="polite">
          {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Share'}
        </span>
      </Button>

- Failed-load share param — gate on `ok`:

      const ok = load(files, name, opts);
      if (ok) {
        setGithubRef(resolvedRef);
        const src = formatGithubRef(resolvedRef);
        setShareParam(src);
        recordGithubRecent(src, name);
      }

  Check the surrounding function: if a previous bundle's `?src=` should be cleared on a failed load, leave existing behavior for that case untouched — only stop *setting* the new ref/param when `ok` is false.

## Repo conventions to follow

- OpenViewer.tsx keeps all its local components in-file (do not split the file in this plan).
- Comments explain constraints (see the existing SearchCommand-instance comment at :498-504) — keep that one intact.
- `cn()` for conditional classes; lucide icons `aria-hidden` when decorative.

## Steps

1. Create ViewerErrorBoundary.tsx (target A) and wrap the `<main>` switch, adding `id="main-content"`.
2. Apply target B (live regions).
3. Apply target C (shared index: BundleShell memo → prop → both mounts → matchers → searchProvider).
4. Apply target D (cachedCompute in Markdown + ConceptView).
5. Apply target E (aria-current, input label, ShareButton live span, ok-gating).
6. `bun run typecheck` + full diff re-read; remove unrelated churn.

## Boundaries

- Only OpenViewer.tsx and the new ViewerErrorBoundary.tsx. Do NOT edit src/lib/*.
- Do not change hash-routing, load/re-root logic beyond the `ok`-gating, or any visual styling.
- No dependencies. Nothing committed.
- STOP and report if plan-001 exports are absent or any quoted code has drifted.

## Verification

- **Mechanical**: `bun run typecheck`, `bun test`, `bun run build && bun run e2e` all pass (the smoke suite covers the runtime viewer's search flow). `npx react-doctor@latest` score not lower than 46.
- **Behavior check**: open the example bundle at `/open` (e2e does this); filter the nav — "(body match)" labels still appear; navigate concept → home → same concept and confirm via React DevTools Profiler that the second visit skips the markdown parse (cachedCompute hit); error boundary: temporarily throw inside ConceptView in dev to see the fallback render with the sidebar still alive, then remove the throw.
- **Done when**: all checks pass; navigating to a crashing concept shows the in-place fallback instead of a white screen.
