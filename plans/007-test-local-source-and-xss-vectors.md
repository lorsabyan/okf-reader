# 007 — Unit-test the local folder-open path + widen XSS regression vectors

- **Status**: DONE
- **Commit**: 8e223b8 (+ uncommitted improve batch)
- **Severity**: HIGH
- **Category**: Test Coverage (+ Security regression tests)
- **Rule**: audit [TEST-02] + advisor-found XSS-vector gap
- **Estimated scope**: 1 new file `src/lib/sources/local.test.ts`, 1 extended file `src/lib/markdown.test.ts`.

## Problem

**A.** `src/lib/sources/local.ts` — the second primary bundle-open path — has no tests at all. It was ALSO just refactored (sequential→parallel reads), so it's freshly-touched, untested code. Key behaviors: `readHandle` recursively walks a directory handle, skips dotfiles, reads only `.md`, preserves deterministic path insertion; `readFileList` (the `webkitdirectory` fallback) derives the bundle name from the first path segment of `webkitRelativePath`, re-slices paths (`parts.slice(1).join('/') || parts[0]`), and filters dotdirs/non-md; `reopenDirectory` gates on `queryPermission`/`requestPermission` and returns `'denied'` when not granted.

**B.** The sanitize pipeline's regression test covers exactly one vector (`src/lib/markdown.test.ts:74-78`):

    test('strips a <script> tag from the body', () => {
      const { html } = renderMarkdown('Hi <script>alert(1)</script> there.', 'tables/orders', exists);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert(1)');
    });

Nothing pins the other classic vectors on this just-hardened, security-critical path: event-handler attributes, `javascript:` hrefs, `data:` URLs, iframes/objects, and the style-attribute difference between the client schema (`sanitizeSchema` — style stripped) and the server highlight schema (`sanitizeSchemaWithStyle` — style allowed on code/span/pre only).

## Target

### A. New `src/lib/sources/local.test.ts`

Drive the module with in-memory fakes — no real File System Access API. `readHandle` consumes `dir.entries()` (async iterator of `[name, entry]`), `entry.kind`, `entry.getFile().then(f => f.text())`. Build a fake like:

    function fakeDir(spec: Record<string, string | Record<string, unknown>>): DirHandle { ... }
    // string value = file content; nested object = subdirectory

(Check the actual `DirHandle`/type shapes in `local.ts` first and mirror them minimally; cast via `as unknown as` where the lib types demand full interfaces.) `readFileList` takes a `FileList`-like — an array of objects with `name`, `webkitRelativePath`, `text()` plus `Array.from` compatibility (a plain array cast works if the code uses `Array.from(list)` — it does).

Cases:
1. `readHandle`: nested dirs flatten to `sub/dir/file.md` paths; dotfiles and dot-directories skipped; non-`.md` skipped; content round-trips.
2. `readHandle`: deterministic ordering — files of the parent dir land before subdirectory contents (the refactor's merge-order contract: parallel reads, original iteration order preserved).
3. `readFileList`: `webkitRelativePath` `bundle/tables/a.md` → key `tables/a.md`, `name === 'bundle'`; single-segment path falls back to the file name; dotdir path (`bundle/.git/x.md`) and non-md filtered out.
4. `reopenDirectory`: fake handle with `queryPermission: () => 'prompt'`, `requestPermission: () => 'denied'` → returns `'denied'`; with `'granted'` → proceeds to read (assert via a spy that `entries()` was called / files returned).

### B. Extend `src/lib/markdown.test.ts` — a `describe('sanitization vectors', …)` block

Through the CLIENT pipeline (`renderMarkdown`):
1. `<img src=x onerror=alert(1)>` → output contains no `onerror`.
2. `[click](javascript:alert(1))` → output `<a>` has no `javascript:` href (rehype-sanitize strips the href; the element may remain).
3. `<a href="data:text/html,x">x</a>` → no `data:` href in output.
4. `<iframe src="https://evil.example"></iframe>` and `<object data="x"></object>` → neither tag present.
5. `<span style="position:fixed">x</span>` → no `style` attribute in client output.
6. `<svg onload=alert(1)>` → no `onload`/`svg` script surface in output.

Plus one SERVER-pipeline contrast test in `src/lib/markdown-highlight.test.ts`? — NO: that file is out of scope here; the existing style test there already covers the contrast. Keep to the two files listed.

## Repo conventions to follow

bun:test, colocated. For A, imitate the fake-object style of `packages/okf-core/src/detect-root.test.ts` (Map-based fixtures) and the existing `exists` helper pattern in `markdown.test.ts` (`const exists = (id: string) => id === 'tables/events'` style — read the file for the real helper).

## Steps

1. Read `src/lib/sources/local.ts` fully; if the parallel-read structure differs materially from the description above, STOP and report drift.
2. Write `local.test.ts` (cases A1-A4); `bun test src/lib/sources` green.
3. Add the sanitization-vectors block to `markdown.test.ts` (cases B1-B6); `bun test src/lib/markdown.test.ts` green. If any vector FAILS (i.e. the sanitizer lets something through), do NOT weaken the assertion — STOP and report it as a security finding.
4. `bun run typecheck`.

## Boundaries

- Files in scope: new `src/lib/sources/local.test.ts`, `src/lib/markdown.test.ts` (additive — don't restructure existing tests).
- Do NOT modify `local.ts`, `markdown.ts`, or `markdown-highlight.*`. No new dependencies. No build/e2e.

## Verification

- **Mechanical**: `bun test src/lib` green; `bun run typecheck` clean.
- **Done when**: all cases pass, diff limited to the two files, and any sanitizer gap found is reported rather than papered over.
