# 010 — Fix the global header's total lack of responsive behavior

- **Status**: DONE
- **Commit**: b24f7eb (all excerpts verified against the tree)
- **Severity**: HIGH (visibly broken, cheap, contained)
- **Category**: Bug (UI/UX review, Fable + advisor cross-check)
- **Estimated scope**: 2 files, small edits.

## Problem

Confirmed live in a browser at 375px width (mobile) and via source read. The global header
(`src/app/layout.tsx`) has zero breakpoint classes, and its nav links
(`src/components/HeaderNav.tsx`) have no responsive label-hiding or `whitespace-nowrap`. Under
horizontal squeeze the flex children shrink to min-content and wrap:

- "OKF Reader" (the wordmark) wraps to two lines.
- "Open bundle" splits into "Open" / "bundle" on separate lines.
- The bundle-name `<span>` (already `truncate`) doesn't actually truncate because its flex
  ancestors have no `min-w-0`, so it competes for space instead of shrinking first.
- The fixed `h-14` header grows past its intended height to fit the wrapped text.

Current code, verbatim:

    // src/app/layout.tsx — current
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-5 backdrop-blur">
      <Link href="/" className="font-bold tracking-tight">
        OKF Reader
      </Link>
      <HeaderNav bundleName={bundle.name} />
    </header>

    // src/components/HeaderNav.tsx — current
    const navLinkClass =
      'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground';

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

Note: on reader routes (not `/open`), this broken header sits *above* a second, separate mobile
hamburger bar (`src/app/(reader)/layout.tsx`, `md:hidden`) — so at narrow widths you currently get
two nav rows stacked, one of them visibly broken. This plan only touches the global header; do not
touch `(reader)/layout.tsx` or its hamburger row.

## Target

1. **`src/app/layout.tsx`**: give the wordmark link `whitespace-nowrap shrink-0` so it never wraps
   and never gives up its space first:

       <Link href="/" className="shrink-0 whitespace-nowrap font-bold tracking-tight">
         OKF Reader
       </Link>

   Also add `min-w-0` to the `<header>` itself (needed for any `truncate` child further down the
   flex chain to actually truncate instead of forcing the row to overflow):

       <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-3 border-b bg-background/80 px-5 backdrop-blur">

2. **`src/components/HeaderNav.tsx`**:
   - Wrap the returned fragment's root in nothing new, but give the bundle-name `<span>` `min-w-0`
     alongside its existing `truncate` so it can actually shrink/ellipsize instead of forcing
     wrap elsewhere:

         {!isOpenRoute && <span className="min-w-0 truncate text-sm text-muted-foreground">{bundleName}</span>}

   - Add `shrink-0` to the `ml-auto` nav-items container so it never gives up space to the (now
     shrinkable) bundle name:

         <div className="ml-auto flex shrink-0 items-center gap-1">

   - On `navLinkClass`, add `whitespace-nowrap` (prevents any residual wrap) — this alone does not
     fix narrow widths, it just stops mid-word wrapping; the real fix is hiding the label text
     below `sm:`. Wrap each link's visible text in a `<span>` that's hidden below `sm:`, keeping
     the icon always visible and the link's accessible name intact via the icon's sibling text
     (screen readers still read the `<span>` even when visually hidden — do NOT use `hidden`,
     which removes it from the accessibility tree; use `sr-only sm:not-sr-only sm:inline` so the
     label stays in the accessible name below `sm:` and is visually hidden only above `sm:`... wait,
     invert: it must be visually hidden BELOW `sm:` and shown AT/ABOVE `sm:`. Use:
     `className="sr-only sm:not-sr-only sm:inline"` on a `<span>` wrapping the text — this keeps
     the text in the DOM/accessibility tree at all times (so the link's accessible name is always
     "Health" / "Open bundle", satisfying screen readers and satisfying `no-vague-button-label`
     concerns) while visually showing it only at `sm:` and above):

         const navLinkClass =
           'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground';

         // each Link becomes, e.g.:
         <Link href="/health/" className={navLinkClass}>
           <Activity className="size-4" />
           <span className="sr-only sm:not-sr-only sm:inline">Health</span>
         </Link>

     Apply the same `<span className="sr-only sm:not-sr-only sm:inline">…</span>` wrapping to the
     "Open bundle" label. Do NOT wrap `ThemeToggle` or `SearchDialog`'s own internal button — those
     already have their own icon+label handling; leave them untouched unless typecheck fails.

## Repo conventions to follow

Tailwind utility classes inline, no new CSS. Match the existing icon+label pattern already used in
both links (`<Icon className="size-4" /> {Label}`) — you're only wrapping the label text in a
responsive-visibility span, not restructuring the component.

## Steps

1. Read both files fresh; if either differs from the excerpts above, STOP and report drift.
2. Apply the `layout.tsx` changes (wordmark `shrink-0 whitespace-nowrap`, header `min-w-0`).
3. Apply the `HeaderNav.tsx` changes (bundle-name `min-w-0`, nav container `shrink-0`,
   `navLinkClass` `whitespace-nowrap`, both labels wrapped in the responsive `sr-only` span).
4. Re-read the diff; remove any unrelated churn.

## Boundaries

- ONLY these two files. Do NOT touch `src/app/(reader)/layout.tsx`, `MobileNav.tsx`, `ThemeToggle.tsx`,
  or `SearchDialog.tsx`.
- No new dependencies. No visual redesign — this is a responsive-behavior fix, not a restyle.
- Do not change desktop (≥ `sm`) appearance at all — every class added must be a no-op at `sm:` and
  above (verify: `shrink-0`/`whitespace-nowrap`/`min-w-0` don't change layout when there's room;
  `sr-only sm:not-sr-only sm:inline` renders identically to today's plain text at `sm:` and up).

## Verification

- **Mechanical**: `bun run typecheck` clean; `bun test` unaffected (no test currently covers this
  markup — do not add one; this is layout-only and covered by the behavioral check below).
- **Behavior check (required — this is a UI fix)**: start `bun run dev`, open the app in a browser:
  - At a desktop width (≥1024px): header must look pixel-identical to before (wordmark, bundle
    name, Search/Health/Open bundle labels with icons, theme toggle — all on one line, no wrap).
  - At 375px width: header must stay on ONE row at its normal `h-14` height. Confirm via
    `read_page`/accessibility tree that "Health" and "Open bundle" links still have their full
    text as their accessible name (not icon-only), even though the text is visually hidden.
    Confirm the bundle name truncates with an ellipsis (or is squeezed) rather than causing wrap.
  - Toggle to the `/open` route at 375px and confirm it still looks correct (fewer nav items:
    just "Open bundle" + theme toggle, since Search/Health are hidden on that route already).
- **Done when**: both checks pass and the diff is limited to the two files.
