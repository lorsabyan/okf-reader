import type { Metadata } from 'next';
import Link from 'next/link';
import { loadBundle, navGroups } from '@/lib/bundle';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'OKF Reader',
  description: 'Read, navigate, and explore Open Knowledge Format bundles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bundle = loadBundle();
  const groups = navGroups(bundle).map(({ group, items }) => ({
    group,
    items: items.map(({ id, title, type, tags }) => ({ id, title, type, tags })),
  }));

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            OKF Reader
          </Link>
          <span className="bundle-name">{bundle.name}</span>
        </header>
        <div className="shell">
          <Sidebar groups={groups} />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
