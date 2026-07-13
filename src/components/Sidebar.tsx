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

export default function Sidebar({ groups }: { groups: { group: string; items: NavItem[] }[] }) {
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
    <nav className="border-b bg-muted/30 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:border-b-0 md:border-r">
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
    </nav>
  );
}
