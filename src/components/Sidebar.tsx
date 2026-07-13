'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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
    <nav className="sidebar">
      <input
        type="search"
        placeholder="Filter concepts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter concepts"
      />
      {groups.map(({ group, items }) => {
        const visible = items.filter(match);
        if (!visible.length) return null;
        return (
          <div key={group} className="nav-group">
            <h3>{group}</h3>
            <ul>
              {visible.map((c) => {
                const href = `/c/${c.id}/`;
                return (
                  <li key={c.id}>
                    <Link href={href} className={pathname === href ? 'active' : ''}>
                      {c.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
