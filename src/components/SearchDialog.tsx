'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

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
    pagefindPromise = new Function('u', 'return import(u)')(`${base}/pagefind/pagefind.js`) as Promise<PagefindApi>;
  }
  return pagefindPromise;
}

interface Hit {
  url: string;
  title: string;
  excerpt: string;
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  // cmdk doesn't auto-select when items arrive asynchronously — track selection
  // ourselves and point it at the top hit so Enter always works.
  const [selected, setSelected] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) {
      setHits([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const pagefind = await loadPagefind();
        const { results } = await pagefind.search(query);
        const top = await Promise.all(results.slice(0, 8).map((r) => r.data()));
        setUnavailable(false);
        const mapped = top.map((d) => ({ url: d.url, title: d.meta.title ?? d.url, excerpt: d.excerpt }));
        setHits(mapped);
        setSelected(mapped[0]?.url ?? '');
      } catch {
        setUnavailable(true);
        setHits([]);
      }
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5" />
          Search…
        </span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search this bundle">
        <Command shouldFilter={false} value={selected} onValueChange={setSelected}>
          <CommandInput placeholder="Search concepts…" value={query} onValueChange={setQuery} />
          <CommandList>
            {unavailable && (
              <CommandEmpty>Search index is built at build time — run bun run build</CommandEmpty>
            )}
            {!unavailable && hits.length === 0 && (
              <CommandEmpty>{query.trim() ? 'No results.' : 'Type to search…'}</CommandEmpty>
            )}
            {hits.length > 0 && (
              <CommandGroup heading="Results">
                {hits.map((hit) => (
                  <CommandItem
                    key={hit.url}
                    value={hit.url}
                    onSelect={() => {
                      setOpen(false);
                      window.location.href = hit.url;
                    }}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{hit.title}</span>
                      <span
                        className="truncate text-xs text-muted-foreground [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
