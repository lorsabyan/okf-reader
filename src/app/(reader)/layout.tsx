import { loadBundle, navGroups } from '@/lib/bundle';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  const bundle = loadBundle();
  const groups = navGroups(bundle).map(({ group, items }) => ({
    group,
    items: items.map(({ id, title, type, tags }) => ({ id, title, type, tags })),
  }));

  return (
    <>
      {/* Search moved into the global header (HeaderNav); this slim row is
          just a home for the hamburger below `md`, where the sidebar itself
          is hidden in favor of the drawer it opens. */}
      <div className="flex items-center border-b bg-muted/30 px-4 py-2 md:hidden">
        <MobileNav groups={groups} bundleName={bundle.name} />
      </div>
      <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[300px_1fr]">
        <Sidebar groups={groups} />
        <main id="main-content" tabIndex={-1} className="min-w-0 px-6 py-8 outline-none md:px-12">
          {children}
        </main>
      </div>
    </>
  );
}
