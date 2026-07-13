/**
 * Browser adapter for opening a public GitHub repo (or a subdirectory of
 * one) as an OKF bundle, via the CORS-enabled Git Trees API + raw fetch.
 */

export interface GithubRef {
  owner: string;
  repo: string;
  branch?: string;
  subdir: string; // '' = repo root
}

/**
 * Accepts: "owner/repo", "github.com/owner/repo",
 * "https://github.com/owner/repo/tree/<branch>[/sub/dir]".
 * After /tree/, the first segment is taken as the branch.
 */
export function parseGithubUrl(input: string): GithubRef | null {
  const trimmed = input.trim().replace(/^https?:\/\//, '').replace(/^(www\.)?github\.com\//, '');
  const m = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*?))?)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], branch: m[3], subdir: m[4] ?? '' };
}

/** Inverse of parseGithubUrl: "<owner>/<repo>[/tree/<branch>[/<subdir>]]" — used for shareable URLs. */
export function formatGithubRef(ref: GithubRef): string {
  let s = `${ref.owner}/${ref.repo}`;
  if (ref.branch) {
    s += `/tree/${ref.branch}`;
    if (ref.subdir) s += `/${ref.subdir}`;
  }
  return s;
}

interface TreeEntry {
  path: string;
  type: string;
}

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
