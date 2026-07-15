# 002 — Static reader accessibility: skip link, aria-current, SVG graph, tour status

- **Status**: DONE
- **Commit**: 8e223b8
- **Severity**: HIGH (skip link, per WCAG 2.4.1) with MEDIUM/LOW companions
- **Category**: Accessibility
- **Rule**: Beyond the scan (WCAG 2.4.1, 1.4.1, 4.1.2, 1.3.1)
- **Estimated scope**: 5 files, ~40 changed lines: src/app/layout.tsx, src/app/(reader)/layout.tsx, src/components/Sidebar.tsx, src/components/Neighborhood.tsx, src/components/tour/TourBar.tsx

**File ownership note:** another executor works on other files concurrently. Only touch the five files above. Do NOT touch src/components/open/OpenViewer.tsx (its `<main>` gets `id="main-content"` in a separate plan).

## Problem

### A. No skip-to-content link; no skip target (WCAG 2.4.1, HIGH)

`src/app/layout.tsx:33-39` renders a sticky header before `{children}`, and `src/app/(reader)/layout.tsx:21-23` adds the full sidebar `<nav>` before `<main>` — a keyboard user tabs through every sidebar concept link on every page. No skip link exists, and the reader `<main>` has no `id`/`tabIndex` to target.

    // src/app/(reader)/layout.tsx:22 — current
    <main className="min-w-0 px-6 py-8 md:px-12">{children}</main>

### B. Active sidebar link is color-only (WCAG 1.4.1, MEDIUM)

    // src/components/Sidebar.tsx:67-76 — current
    const active = pathname === href;
    ...
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'block rounded-md px-2 py-1.5 text-sm leading-snug hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent font-medium text-accent-foreground',
      )}
    >

### C. Neighborhood SVG hides its own focusable links (WCAG 4.1.2, MEDIUM)

`src/components/Neighborhood.tsx:77-81` — the `<svg role="img" aria-label={...}>` collapses the subtree into one image node for assistive tech, yet it contains keyboard-focusable `<a href>` node boxes (line 47: `return center ? box : <a href={hrefFor(node.id)}>{box}</a>;`). Focusable controls end up with no announced name or role.

    // src/components/Neighborhood.tsx:77 — current
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`Concepts linked with ${center.title}`}
      className="mt-2 h-auto w-full text-xs"
    >

### D. Tour progress has no status semantics (WCAG 1.3.1, LOW)

    // src/components/tour/TourBar.tsx:98-100 — current
    <span className="ml-2 text-muted-foreground">
      Step {idx + 1} of {total}
    </span>

## Target

### A. Skip link + target

In `src/app/layout.tsx`, as the FIRST child of `<body>` (before `<ThemeProvider>`):

    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
    >
      Skip to content
    </a>

In `src/app/(reader)/layout.tsx`:

    <main id="main-content" tabIndex={-1} className="min-w-0 px-6 py-8 outline-none md:px-12">{children}</main>

(`tabIndex={-1}` + `outline-none` matches the existing programmatic-focus-target pattern in OpenViewer.tsx:551.)

### B. aria-current on the active sidebar link

    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(...unchanged...)}
    >

### C. Neighborhood: group role, named links

Replace `role="img"` with `role="group"` (keep the `aria-label`), and in `NodeBox` give the wrapping link an accessible name:

    return center ? box : (
      <a href={hrefFor(node.id)} aria-label={node.title}>
        {box}
      </a>
    );

### D. TourBar: status semantics on the step counter

    <span role="status" className="ml-2 text-muted-foreground">
      Step {idx + 1} of {total}
    </span>

## Repo conventions to follow

- Tailwind utility classes inline, `cn()` for conditional classes (exemplar: Sidebar.tsx:70).
- Existing aria patterns: `aria-label="Filter concepts"` on Sidebar's input, `aria-hidden` on decorative separators in Breadcrumbs.tsx.

## Steps

1. Add the skip link to src/app/layout.tsx (target A, first child of `<body>`).
2. Update the reader `<main>` in src/app/(reader)/layout.tsx (target A).
3. Add `aria-current` in Sidebar.tsx (target B).
4. Apply target C to Neighborhood.tsx (both the `<svg>` role and the `NodeBox` return).
5. Apply target D to TourBar.tsx.
6. Re-read the diff; remove unrelated churn.

## Boundaries

- Visual appearance must be unchanged except the skip link appearing on keyboard focus.
- Only the five listed files. No dependencies. Nothing committed.
- STOP and report if quoted "current" code doesn't match (drift from 8e223b8).

## Verification

- **Mechanical**: `bun run typecheck` passes; `bun run build && bun run e2e` passes; `npx react-doctor@latest` score not lower than 46.
- **Behavior check**: in the built site, press Tab on a concept page — the first focus stop is the visible "Skip to content" link; activating it moves focus to `<main>`. The active sidebar item exposes `aria-current="page"` (inspect DOM). SVG node boxes still navigate on click and Enter.
- **Done when**: all checks pass and the diff is limited to the described changes.
