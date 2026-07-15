# 006 — Unit-test fetchGithubBundle (mocked fetch — never the live API)

- **Status**: DONE
- **Commit**: 8e223b8 (+ uncommitted improve batch)
- **Severity**: HIGH
- **Category**: Test Coverage
- **Rule**: audit [TEST-01]
- **Estimated scope**: 1 file — `src/lib/sources/github.test.ts` (extend; currently 4 tests covering only `parseGithubUrl`).

## Problem

`src/lib/sources/github.ts:40-84` (`fetchGithubBundle`) is one of the two primary bundle-open paths and the only shareable one, and has ZERO coverage: default-branch lookup, 403→rate-limit mapping, tree listing + filtering, subdir prefix stripping, the 8-way worker pool, truncation warning, and progress callbacks. `formatGithubRef` (`:26-33`) is also untested. Current source (verbatim, for drift check):

    export async function fetchGithubBundle(
      ref: GithubRef,
      onProgress?: (done: number, total: number) => void,
    ): Promise<{ files: Map<string, string>; name: string; branch: string }> {
      const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
      let branch = ref.branch;
      if (!branch) {
        const res = await fetch(api);
        if (!res.ok) throw new Error(`Repo not found or not public (${res.status})`);
        branch = (await res.json()).default_branch as string;
      }

      const treeRes = await fetch(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      if (!treeRes.ok) {
        if (treeRes.status === 403) throw new Error('GitHub API rate limit reached — try again later.');
        throw new Error(`Could not list files (${treeRes.status}) — check the URL and branch.`);
      }
      const tree = (await treeRes.json()) as { tree: TreeEntry[]; truncated?: boolean };

      const prefix = ref.subdir ? `${ref.subdir}/` : '';
      const paths = tree.tree
        .filter((e) => e.type === 'blob' && e.path.endsWith('.md') && e.path.startsWith(prefix))
        .map((e) => e.path)
        .filter((p) => !p.slice(prefix.length).split('/').some((part) => part.startsWith('.')));

      if (!paths.length) throw new Error('No markdown files found at that location.');
      if (tree.truncated) console.warn('GitHub tree listing was truncated; the bundle may be incomplete.');

      const files = new Map<string, string>();
      let done = 0;
      const queue = [...paths];
      async function worker() {
        for (let p = queue.shift(); p; p = queue.shift()) {
          const res = await fetch(
            `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${p}`,
          );
          if (res.ok) files.set(p.slice(prefix.length), await res.text());
          onProgress?.(++done, paths.length);
        }
      }
      await Promise.all(Array.from({ length: Math.min(8, paths.length) }, worker));

      const name = ref.subdir ? ref.subdir.split('/').pop()! : ref.repo;
      return { files, name, branch };
    }

## Target

Extend `src/lib/sources/github.test.ts` with a `describe('fetchGithubBundle', …)` block driven by a **stubbed `globalThis.fetch`**. HARD REQUIREMENT: no test may ever perform a real network call — CI would flake on rate limits. Use bun:test's `beforeEach`/`afterEach` to save/restore the original `fetch`:

    const realFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = realFetch; });

Build a helper that maps URL substrings → canned `Response` objects (`new Response(JSON.stringify(...), { status })` works in bun). Cases to cover:

1. **Default-branch resolution**: ref without `branch` → first fetch to `api.github.com/repos/o/r` returns `{ default_branch: 'main' }` → subsequent tree fetch uses `/git/trees/main` (assert via recorded URLs) and result `branch === 'main'`.
2. **Repo-not-found**: repo-info fetch `status: 404` → rejects with `Repo not found or not public (404)`.
3. **Rate limit**: tree fetch `status: 403` → rejects with the rate-limit message.
4. **Tree error**: tree fetch `status: 422` → rejects with `Could not list files (422)`.
5. **Filtering + subdir stripping**: tree containing blobs `docs/a.md`, `docs/sub/b.md`, `docs/.hidden/c.md`, `docs/readme.txt`, `other/d.md`, a `type: 'tree'` entry — with `subdir: 'docs'`, resulting files keys are exactly `a.md` and `sub/b.md` (prefix stripped, dotdir and non-md and out-of-prefix excluded); `name === 'docs'`.
6. **Empty result**: tree with no matching blobs → rejects with `No markdown files found at that location.`
7. **Failed raw fetch skips the file**: one raw URL returns 500 → that file absent from the map, others present (documents current silent-skip behavior).
8. **Progress**: `onProgress` called once per path with monotonically increasing `done` and constant `total`.
9. **formatGithubRef round-trips**: for refs with/without branch/subdir, `parseGithubUrl(formatGithubRef(ref))` equals the original (branch-present cases only — `formatGithubRef` omits subdir when branch is absent by design; assert that too).

## Repo conventions to follow

bun:test (`import { describe, expect, test } from 'bun:test'`), colocated `*.test.ts`. Imitate the existing style in `src/lib/sources/github.test.ts` and the fixture style of `src/lib/search-bundle.test.ts`.

## Steps

1. Read the current `github.ts` and `github.test.ts`; if `fetchGithubBundle` differs from the excerpt above, STOP and report drift.
2. Write the fetch-stub helper + the 9 cases.
3. `bun test src/lib/sources` until green; then `bun run typecheck`.

## Boundaries

- ONLY modify `src/lib/sources/github.test.ts`. Do NOT modify `github.ts` itself — if a test reveals a genuine bug, report it in your final message instead of fixing the source.
- No new dependencies. No real network. Do not run build/e2e.

## Verification

- **Mechanical**: `bun test src/lib/sources` green; `bun run typecheck` clean; grep your new test block for `api.github.com` — every occurrence must be inside the stub, none reachable as a live call.
- **Done when**: all 9 cases pass with the stubbed fetch and the diff touches only the test file.

## Escape hatches

- If restoring `globalThis.fetch` proves flaky under bun's parallel test files, isolate with `describe.serial` or module-scoped save/restore — but never skip the restore.
