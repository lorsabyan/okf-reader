import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { loadBundle, navGroups } from '@/lib/bundle';
import Sidebar from '@/components/Sidebar';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
    <html lang="en" className={cn('font-sans', inter.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-5 backdrop-blur">
            <Link href="/" className="font-bold tracking-tight">
              OKF Reader
            </Link>
            <span className="text-sm text-muted-foreground">{bundle.name}</span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[300px_1fr]">
            <Sidebar groups={groups} />
            <main className="min-w-0 px-6 py-8 md:px-12">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
