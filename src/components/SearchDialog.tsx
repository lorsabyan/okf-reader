'use client';

import SearchCommand, { type Hit } from '@/components/search/SearchCommand';

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string; [key: string]: string | undefined };
}
interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}
interface PagefindApi {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

let pagefindPromise: Promise<PagefindApi> | null = null;

/** Lazily load the Pagefind index, built at `bun run build` time (see out/pagefind/). */
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

async function pagefindProvider(query: string): Promise<Hit[]> {
  const pagefind = await loadPagefind();
  const { results } = await pagefind.search(query);
  const top = await Promise.all(results.slice(0, 8).map((r) => r.data()));
  return top.map((d) => ({ href: d.url, title: d.meta.title ?? d.url, excerptHtml: d.excerpt }));
}

export default function SearchDialog() {
  return (
    <SearchCommand
      provider={pagefindProvider}
      unavailableMessage="Search index is built at build time — run bun run build"
    />
  );
}
