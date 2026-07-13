'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { SidebarContent, type NavItem } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/** Hamburger button + drawer (shadcn `Sheet`) holding the same sidebar content, for < md screens. */
export default function MobileNav({
  groups,
  bundleName,
}: {
  groups: { group: string; items: NavItem[] }[];
  bundleName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden" aria-label="Open navigation menu">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="truncate text-sm">{bundleName}</SheetTitle>
        </SheetHeader>
        <SidebarContent groups={groups} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
