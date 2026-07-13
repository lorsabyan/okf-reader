import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { Activity, FolderOpen } from 'lucide-react';
import { loadBundle } from '@/lib/bundle';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://lorsabyan.github.io/okf-reader/'),
  title: 'OKF Reader',
  description: 'Read, navigate, and explore Open Knowledge Format bundles.',
  openGraph: {
    title: 'OKF Reader',
    description: 'Read, navigate, and explore Open Knowledge Format bundles.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bundle = loadBundle();

  return (
    <html lang="en" className={cn('font-sans', inter.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-5 backdrop-blur">
            <Link href="/" className="font-bold tracking-tight">
              OKF Reader
            </Link>
            <span className="text-sm text-muted-foreground">{bundle.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/health/"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <Activity className="size-4" />
                Health
              </Link>
              <Link
                href="/open/"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <FolderOpen className="size-4" />
                Open bundle
              </Link>
              <ThemeToggle />
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
