'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, FolderOpen } from 'lucide-react';
import SearchDialog from '@/components/SearchDialog';
import ThemeToggle from '@/components/ThemeToggle';

const navLinkClass =
  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground';

/**
 * Client half of the global header (see `src/app/layout.tsx`): everything
 * that depends on which route is active. The runtime viewer at `/open`
 * browses a bundle the *user* picked at runtime, so the header must not
 * imply the baked-in bundle is what's on screen there — this hides the
 * baked bundle name and the (baked-bundle-specific) Health link, and with
 * it the full-text search trigger (Pagefind only indexes the baked
 * bundle; the runtime viewer has its own filter/health UI).
 *
 * `usePathname` is safe to branch on directly: this is a fully static
 * export (`output: 'export'`), so every route is prerendered as its own
 * HTML file with this pathname already baked into the markup — there's
 * no SSR-vs-client mismatch to cause a flash on the reader routes.
 */
export default function HeaderNav({ bundleName }: { bundleName: string }) {
  const pathname = usePathname();
  const isOpenRoute = pathname?.startsWith('/open') ?? false;

  return (
    <>
      {!isOpenRoute && <span className="truncate text-sm text-muted-foreground">{bundleName}</span>}
      <div className="ml-auto flex items-center gap-1">
        {!isOpenRoute && <SearchDialog />}
        {!isOpenRoute && (
          <Link href="/health/" className={navLinkClass}>
            <Activity className="size-4" />
            Health
          </Link>
        )}
        <Link href="/open/" className={navLinkClass}>
          <FolderOpen className="size-4" />
          Open bundle
        </Link>
        <ThemeToggle />
      </div>
    </>
  );
}
