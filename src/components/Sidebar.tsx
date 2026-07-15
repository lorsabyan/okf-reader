'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
}

/**
 * Filter input + grouped concept list — the sidebar's actual content,
 * shared between the always-visible desktop `<nav>` and the mobile
 * drawer (a shadcn `Sheet`), so there's exactly one filtering
 * implementation and one navigation list markup.
 */
export function SidebarContent({
  groups,
  onNavigate,
}: {
  groups: { group: string; items: NavItem[] }[];
  onNavigate?: () => void;
}) {
  const [q, setQ] = useState('');
  const pathname = usePathname();
  const needle = q.trim().toLowerCase();
  const match = (c: NavItem) =>
    !needle ||
    c.title.toLowerCase().includes(needle) ||
    c.id.toLowerCase().includes(needle) ||
    c.type.toLowerCase().includes(needle) ||
    c.tags.some((t) => t.toLowerCase().includes(needle));

  return (
    <>
      <div className="p-4 pb-2">
        <Input
          type="search"
          placeholder="Filter concepts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter concepts"
          className="h-9"
        />
      </div>
      <ScrollArea className="px-4 pb-4 md:h-[calc(100%-3.75rem)]">
        {groups.map(({ group, items }) => {
          const visible = items.filter(match);
          if (!visible.length) return null;
          return (
            <div key={group} className="mt-4">
              <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h3>
              <ul className="mt-1 space-y-0.5">
                {visible.map((c) => {
                  const href = `/c/${c.id}/`;
                  const active = pathname === href;
                  return (
                    <li key={c.id}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'block rounded-md px-2 py-1.5 text-sm leading-snug hover:bg-accent hover:text-accent-foreground',
                          active && 'bg-accent font-medium text-accent-foreground',
                        )}
                      >
                        {c.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </ScrollArea>
    </>
  );
}

/** Desktop sidebar — hidden below `md`, where a hamburger + drawer takes over (see ReaderLayout). */
export default function Sidebar({ groups }: { groups: { group: string; items: NavItem[] }[] }) {
  return (
    <nav className="hidden md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:border-r md:bg-muted/30">
      <SidebarContent groups={groups} />
    </nav>
  );
}
