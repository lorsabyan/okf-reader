import { loadBundle, navGroups } from '@/lib/bundle';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import SearchDialog from '@/components/SearchDialog';

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  const bundle = loadBundle();
  const groups = navGroups(bundle).map(({ group, items }) => ({
    group,
    items: items.map(({ id, title, type, tags }) => ({ id, title, type, tags })),
  }));

  return (
    <>
      <div className="mx-auto grid max-w-screen-2xl items-center gap-2 border-b bg-muted/30 px-4 py-2 md:grid-cols-[300px_1fr] md:border-b-0">
        <div className="flex items-center gap-2">
          <MobileNav groups={groups} bundleName={bundle.name} />
          <div className="min-w-0 flex-1">
            <SearchDialog />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[300px_1fr]">
        <Sidebar groups={groups} />
        <main className="min-w-0 px-6 py-8 md:px-12">{children}</main>
      </div>
    </>
  );
}
