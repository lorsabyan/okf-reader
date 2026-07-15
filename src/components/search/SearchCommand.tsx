'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface Hit {
  href: string;
  title: string;
  excerptHtml: string;
}

export interface SearchCommandProps {
  /** Look up hits for a query. Reject/throw to show `unavailableMessage` instead of results. */
  provider: (query: string) => Promise<Hit[]>;
  /** Called (dialog already closed) when a hit is chosen. Defaults to `window.location.href = hit.href`. */
  onSelect?: (hit: Hit) => void;
  /** Shown in place of results when `provider` rejects (e.g. a search index that isn't built yet). */
  unavailableMessage?: string;
  placeholder?: string;
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  /**
   * Custom trigger UI, called with a function that opens the dialog. Return `null` to render no
   * trigger at all (useful when another element elsewhere drives `open`/`onOpenChange`).
   * Defaults to the header-style button (search icon, label, ⌘K hint).
   */
  renderTrigger?: (openDialog: () => void) => ReactNode;
  /** Controlled open state, for driving the dialog from a trigger rendered elsewhere. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DEFAULT_UNAVAILABLE = 'Search is unavailable.';

function defaultOnSelect(hit: Hit) {
  window.location.href = hit.href;
}

export default function SearchCommand({
  provider,
  onSelect,
  unavailableMessage = DEFAULT_UNAVAILABLE,
  placeholder = 'Search concepts…',
  triggerLabel = 'Search',
  dialogTitle = 'Search',
  dialogDescription = 'Search this bundle',
  renderTrigger,
  open: controlledOpen,
  onOpenChange,
}: SearchCommandProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) {
      // Fresh palette on every open: discard this session's query, results,
      // and unavailable flag, and invalidate any in-flight request.
      requestIdRef.current++;
      setQuery('');
      setHits([]);
      setSelected('');
      setUnavailable(false);
    }
  };

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  // cmdk doesn't auto-select when items arrive asynchronously — track selection
  // ourselves and point it at the top hit so Enter always works.
  const [selected, setSelected] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const openDialog = () => setOpen(true);

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openDialog)
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">⌘K</kbd>
        </button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title={dialogTitle} description={dialogDescription}>
        <Command shouldFilter={false} value={selected} onValueChange={setSelected}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {unavailable && <CommandEmpty>{unavailableMessage}</CommandEmpty>}
            {!unavailable && hits.length === 0 && (
              <CommandEmpty>{query.trim() ? 'No results.' : 'Type to search…'}</CommandEmpty>
            )}
            {hits.length > 0 && (
              <CommandGroup heading="Results">
                {hits.map((hit) => (
                  <CommandItem
                    key={hit.href}
                    value={hit.href}
                    onSelect={() => {
                      setOpen(false);
                      (onSelect ?? defaultOnSelect)(hit);
                    }}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{hit.title}</span>
                      <span
                        className="truncate text-xs text-muted-foreground [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: hit.excerptHtml }}
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
