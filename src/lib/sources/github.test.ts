import { afterEach, describe, expect, test } from 'bun:test';
import { fetchGithubBundle, formatGithubRef, parseGithubUrl, type GithubRef } from './github';

describe('parseGithubUrl', () => {
  test('owner/repo shorthand', () => {
    expect(parseGithubUrl('lorsabyan/okf-skill')).toEqual({
      owner: 'lorsabyan',
      repo: 'okf-skill',
      branch: undefined,
      subdir: '',
    });
  });

  test('full URL with branch and subdir', () => {
    expect(parseGithubUrl('https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/ga4')).toEqual({
      owner: 'GoogleCloudPlatform',
      repo: 'knowledge-catalog',
      branch: 'main',
      subdir: 'okf/bundles/ga4',
    });
  });

  test('tolerates trailing slash, .git suffix, and www', () => {
    expect(parseGithubUrl('https://www.github.com/foo/bar.git/')).toMatchObject({ owner: 'foo', repo: 'bar' });
  });

  test('rejects garbage', () => {
    expect(parseGithubUrl('not a url at all !!!')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchGithubBundle — every test below stubs globalThis.fetch. No test may
// ever perform a real network call (CI would flake on GitHub rate limits).
// ---------------------------------------------------------------------------

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Route = { match: (url: string) => boolean; respond: () => Response };

/** Builds a stub for globalThis.fetch that dispatches by URL substring/predicate. */
function stubFetch(routes: Route[]) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    const route = routes.find((r) => r.match(url));
    if (!route) throw new Error(`Unstubbed fetch call in test: ${url}`);
    return route.respond();
  }) as typeof fetch;
  return { fn, calls };
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const rawFileRoute = (respond: () => Response = () => new Response('content', { status: 200 })): Route => ({
  match: (u) => u.startsWith('https://raw.githubusercontent.com/'),
  respond,
});

describe('fetchGithubBundle', () => {
  test('1. resolves the default branch when ref.branch is absent', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', subdir: '' };
    const { fn, calls } = stubFetch([
      {
        match: (u) => u === 'https://api.github.com/repos/o/r',
        respond: () => jsonResponse({ default_branch: 'main' }),
      },
      {
        match: (u) => u.includes('/git/trees/main'),
        respond: () => jsonResponse({ tree: [{ path: 'a.md', type: 'blob' }] }),
      },
      rawFileRoute(),
    ]);
    globalThis.fetch = fn;

    const result = await fetchGithubBundle(ref);

    expect(result.branch).toBe('main');
    expect(calls[0]).toBe('https://api.github.com/repos/o/r');
    expect(calls[1]).toContain('/git/trees/main');
  });

  test('2. rejects when the repo-info lookup fails (repo not found / private)', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', subdir: '' };
    const { fn } = stubFetch([
      {
        match: (u) => u === 'https://api.github.com/repos/o/r',
        respond: () => new Response('', { status: 404 }),
      },
    ]);
    globalThis.fetch = fn;

    await expect(fetchGithubBundle(ref)).rejects.toThrow('Repo not found or not public (404)');
  });

  test('3. maps a 403 tree response to a rate-limit error', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: '' };
    const { fn } = stubFetch([
      { match: (u) => u.includes('/git/trees/'), respond: () => new Response('', { status: 403 }) },
    ]);
    globalThis.fetch = fn;

    await expect(fetchGithubBundle(ref)).rejects.toThrow('GitHub API rate limit reached — try again later.');
  });

  test('4. maps other tree-fetch failures to a generic error', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: '' };
    const { fn } = stubFetch([
      { match: (u) => u.includes('/git/trees/'), respond: () => new Response('', { status: 422 }) },
    ]);
    globalThis.fetch = fn;

    await expect(fetchGithubBundle(ref)).rejects.toThrow('Could not list files (422) — check the URL and branch.');
  });

  test('5. filters to markdown blobs under the subdir and strips the prefix from keys', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: 'docs' };
    const tree = [
      { path: 'docs/a.md', type: 'blob' },
      { path: 'docs/sub/b.md', type: 'blob' },
      { path: 'docs/.hidden/c.md', type: 'blob' },
      { path: 'docs/readme.txt', type: 'blob' },
      { path: 'other/d.md', type: 'blob' },
      { path: 'docs/sub', type: 'tree' },
    ];
    const { fn } = stubFetch([
      { match: (u) => u.includes('/git/trees/'), respond: () => jsonResponse({ tree }) },
      rawFileRoute(),
    ]);
    globalThis.fetch = fn;

    const result = await fetchGithubBundle(ref);

    expect([...result.files.keys()].sort()).toEqual(['a.md', 'sub/b.md']);
    expect(result.name).toBe('docs');
  });

  test('6. rejects when no markdown files match', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: '' };
    const { fn } = stubFetch([
      {
        match: (u) => u.includes('/git/trees/'),
        respond: () => jsonResponse({ tree: [{ path: 'a.txt', type: 'blob' }, { path: 'dir', type: 'tree' }] }),
      },
    ]);
    globalThis.fetch = fn;

    await expect(fetchGithubBundle(ref)).rejects.toThrow('No markdown files found at that location.');
  });

  test('7. skips files whose raw fetch fails, keeping the rest (documents current silent-skip behavior)', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: '' };
    const { fn } = stubFetch([
      {
        match: (u) => u.includes('/git/trees/'),
        respond: () =>
          jsonResponse({
            tree: [
              { path: 'a.md', type: 'blob' },
              { path: 'b.md', type: 'blob' },
            ],
          }),
      },
      { match: (u) => u.endsWith('/a.md'), respond: () => new Response('', { status: 500 }) },
      { match: (u) => u.endsWith('/b.md'), respond: () => new Response('bbb', { status: 200 }) },
    ]);
    globalThis.fetch = fn;

    const result = await fetchGithubBundle(ref);

    expect(result.files.has('a.md')).toBe(false);
    expect(result.files.get('b.md')).toBe('bbb');
  });

  test('8. reports progress once per file, with a constant total and monotonically increasing done', async () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', branch: 'main', subdir: '' };
    const paths = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'];
    const { fn } = stubFetch([
      {
        match: (u) => u.includes('/git/trees/'),
        respond: () => jsonResponse({ tree: paths.map((p) => ({ path: p, type: 'blob' })) }),
      },
      rawFileRoute(),
    ]);
    globalThis.fetch = fn;

    const progressCalls: Array<[number, number]> = [];
    await fetchGithubBundle(ref, (done, total) => progressCalls.push([done, total]));

    expect(progressCalls).toHaveLength(paths.length);
    expect(progressCalls.every(([, total]) => total === paths.length)).toBe(true);
    expect(progressCalls.map(([done]) => done).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('formatGithubRef', () => {
  test('9a. round-trips through parseGithubUrl when a branch is present', () => {
    const refs: GithubRef[] = [
      { owner: 'o', repo: 'r', branch: 'main', subdir: '' },
      { owner: 'o', repo: 'r', branch: 'main', subdir: 'docs/sub' },
    ];
    for (const ref of refs) {
      expect(parseGithubUrl(formatGithubRef(ref))).toEqual(ref);
    }
  });

  test('9b. omits the subdir when branch is absent, by design', () => {
    const ref: GithubRef = { owner: 'o', repo: 'r', subdir: 'docs' };

    const formatted = formatGithubRef(ref);

    expect(formatted).toBe('o/r');
    expect(parseGithubUrl(formatted)).toEqual({ owner: 'o', repo: 'r', branch: undefined, subdir: '' });
  });
});
