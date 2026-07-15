# 011 — Introduce one accent hue + warning token; wire health severity and badge distinction

- **Status**: DONE
- **Commit**: b24f7eb (all excerpts verified against the tree)
- **Severity**: HIGH (root cause behind several sub-symptoms; design decision, not a bug)
- **Category**: Design (UI/UX review, Fable + advisor cross-check)
- **Estimated scope**: 4 files.

## Problem

Verified in `src/app/globals.css`: every semantic color token — `--primary`, `--accent`,
`--secondary`, `--muted`, `--ring`, and even the `--chart-1..5` data-viz ramp — is
`oklch(<L> 0 0)` in BOTH the `:root` (light) and `.dark` blocks. Zero chroma means pure grayscale;
only `--destructive` (a red/orange, hue ~22-27°) carries real hue anywhere in the theme. This is
the stock, unmodified shadcn "neutral" starter palette (`components.json` confirms
`"baseColor": "neutral"`), not a deliberate design choice — confirmed by one telling detail:
`.dark`'s `--sidebar-primary: oklch(0.488 0.243 264.376)` IS a real indigo hue, but grep confirms
it is never referenced by any component — a dead leftover from the stock theme that nobody wired
in or removed.

Consequences observed in a live browser pass:
- The concept-page type badge (`<Badge>{concept.type}</Badge>`, solid `default` variant) and tag
  badges (`variant="outline"`) are only distinguished by fill-vs-border, both rendered in the same
  gray — subtle to the point of being easy to miss.
- `/health/` (and its runtime-viewer duplicate) shows 6 check categories; only "Broken links"
  turns visually distinct (`destructive`, real red) when non-zero. The other 5 — Missing
  descriptions, Untyped, Stale, Undated, Orphans — only ever escalate to grayscale `secondary`.
  Worse: each section's own heading-level count badge (the `Section` component, reused by all 6
  including Broken Links) ALSO only ever uses `secondary`/`outline` regardless of category — so
  even "Broken links" itself shows a plain gray count next to its own `<h2>`, while the *summary
  row* above correctly reds it out. Two badges for the same fact, inconsistently colored.
- The connection-graph's "you are here" node (`Neighborhood.tsx`: `fill-primary/10 stroke-primary`
  on the center box) is barely visible with a grayscale `--primary`.

Recommendation (mine, cross-checked by a second-opinion review): keep prose/chrome grayscale —
that's legitimate for a reading tool — but wire real hue into exactly the semantic seams above.
Concretely: change `--primary`/`--primary-foreground`/`--ring` to a blue-indigo hue (notably the
SAME hue family the dead `--sidebar-primary` already reaches for — this finishes what the stock
theme gestured at rather than inventing something foreign), and add new `--warning` /
`--warning-foreground` tokens for the health page's non-critical categories. Everything else
(`--background`, `--foreground`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent`,
`--destructive`, `--border`, `--input`, `--chart-*`, `--sidebar-*`) stays exactly as-is — this is a
targeted change, not a re-theme.

## Target

### A. `src/app/globals.css` — token changes

In `:root` (light), change these three lines and add two new ones (insert the new lines right
after `--ring`, before `--chart-1`):

    // current, :root
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    ...
    --ring: oklch(0.708 0 0);

    // target, :root
    --primary: oklch(0.51 0.19 260);
    --primary-foreground: oklch(0.985 0 0);
    ...
    --ring: oklch(0.51 0.19 260 / 0.5);
    --warning: oklch(0.795 0.145 85);
    --warning-foreground: oklch(0.28 0.06 85);

In `.dark`, change these three and add the same two new tokens (insert after `--ring`, before
`--chart-1`), using lighter/less-saturated values appropriate for a dark background (same hue
family, tuned for dark-mode contrast — this mirrors how `--destructive` already has separate
light/dark values a few lines above it):

    // current, .dark
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    ...
    --ring: oklch(0.556 0 0);

    // target, .dark
    --primary: oklch(0.65 0.18 260);
    --primary-foreground: oklch(0.145 0 0);
    ...
    --ring: oklch(0.65 0.18 260 / 0.5);
    --warning: oklch(0.75 0.16 85);
    --warning-foreground: oklch(0.145 0.03 85);

Do not change `--primary-foreground`'s VALUE beyond what's shown (it must stay a near-white in
light mode and near-black in dark mode for contrast against the new colored `--primary` — verify
contrast in the behavior check below, since text-on-solid-badge contrast is exactly what the
advisor flagged as a risk).

Then register the two new tokens in the `@theme inline` block near the top of the file so Tailwind
generates utilities for them (find the existing block that maps `--color-ring: var(--ring);`,
`--color-destructive: var(--destructive);` etc., and add two matching lines directly below the
`--color-destructive`/`--color-accent` lines — do not reorder existing lines):

    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);

### B. `src/components/ui/badge.tsx` — add a `warning` variant

Add one entry to the `variants.variant` object in `badgeVariants` (cva), following the exact
pattern of the existing `destructive` variant (same structural shape — background at low opacity,
solid text color, dark-mode-specific alpha bump, hover state):

    // current
    destructive:
      "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
    outline:
      "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",

    // target — insert a new `warning` entry between `destructive` and `outline`
    destructive:
      "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
    warning:
      "bg-warning/15 text-warning-foreground focus-visible:ring-warning/20 dark:bg-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20",
    outline:
      "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",

Do not touch any other variant. Do not change `defaultVariants`.

### C. `src/components/open/HealthView.tsx` AND `src/app/(reader)/health/page.tsx` — wire severity

Both files independently define an identical private `Section` component (this duplication is a
known, separately-tracked follow-up — do NOT merge/dedupe the two files in this plan, just apply
the same targeted edit to both, keeping them symmetric).

In BOTH files, give `Section` an optional `severity` prop (default `'warning'`) and use it instead
of the hardcoded `'secondary'`:

    // current (identical in both files)
    function Section({
      title,
      count,
      children,
    }: {
      title: string;
      count: number;
      children?: React.ReactNode;
    }) {
      return (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <Badge variant={count > 0 ? 'secondary' : 'outline'}>{count}</Badge>
          </div>
          ...

    // target (identical change in both files)
    function Section({
      title,
      count,
      severity = 'warning',
      children,
    }: {
      title: string;
      count: number;
      severity?: 'destructive' | 'warning';
      children?: React.ReactNode;
    }) {
      return (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <Badge variant={count > 0 ? severity : 'outline'}>{count}</Badge>
          </div>
          ...

Then, in BOTH files, update the five `<Section>` call sites for Missing descriptions / Untyped /
Stale / Undated / Orphans to explicitly pass nothing (they get the new `warning` default — no
change needed at those call sites), and update ONLY the `<Section title="Broken links" ...>` call
site to pass `severity="destructive"`:

    // current (both files)
    <Section title="Broken links" count={report.brokenLinks.length}>

    // target (both files)
    <Section title="Broken links" count={report.brokenLinks.length} severity="destructive">

Finally, in BOTH files, change the five summary-row badges that currently hardcode `'secondary'`
to `'warning'` (leave the `Broken links` summary badge's existing `report.brokenLinks.length ?
'destructive' : 'outline'` untouched — it's already correct):

    // current (both files), 5 of the 6 summary badges
    <Badge variant={report.missingDescriptions.length ? 'secondary' : 'outline'}>
    <Badge variant={report.untyped.length ? 'secondary' : 'outline'}>
    <Badge variant={report.stale.length ? 'secondary' : 'outline'}>
    <Badge variant={report.undated.length ? 'secondary' : 'outline'}>
    <Badge variant={report.orphans.length ? 'secondary' : 'outline'}>

    // target (both files) — same 5, 'secondary' -> 'warning'
    <Badge variant={report.missingDescriptions.length ? 'warning' : 'outline'}>
    <Badge variant={report.untyped.length ? 'warning' : 'outline'}>
    <Badge variant={report.stale.length ? 'warning' : 'outline'}>
    <Badge variant={report.undated.length ? 'warning' : 'outline'}>
    <Badge variant={report.orphans.length ? 'warning' : 'outline'}>

## Repo conventions to follow

`oklch()` values matching the existing file's precision/format (3 decimal-ish, no trailing zeros
beyond what's needed). Keep the `HealthView.tsx` / `health/page.tsx` files byte-for-byte symmetric
after your edit (same as they are today) — a future dedup pass depends on them staying identical
in structure.

## Steps

1. Read `globals.css`, `badge.tsx`, `HealthView.tsx`, `health/page.tsx` fresh; if any differs from
   the excerpts above, STOP and report drift.
2. Apply the `globals.css` token changes (A) — both `:root` and `.dark`, plus the `@theme inline`
   registration for the two new tokens.
3. Apply the `badge.tsx` `warning` variant (B).
4. Apply the `Section`-prop and call-site changes to `HealthView.tsx` (C).
5. Apply the IDENTICAL changes to `health/page.tsx` (C) — diff the two files against each other
   afterward to confirm they're still structurally symmetric (only the `ConceptLink`
   `<a href>`-vs-`<Link href>` difference between them should remain, as today).
6. Re-read the full diff; remove unrelated churn.

## Boundaries

- ONLY these four files. Do NOT touch `Neighborhood.tsx` (it inherits the new `--primary` hue
  automatically via Tailwind's `fill-primary`/`stroke-primary` utilities — no code change needed
  or wanted there), `Sidebar.tsx`, `TourBar.tsx`, or any other component.
- Do NOT change `--background`, `--foreground`, `--card`, `--popover`, `--secondary`, `--muted`,
  `--accent`, `--destructive`, `--border`, `--input`, `--chart-*`, or any `--sidebar-*` token.
- Do NOT add a `--success` token or a `success` badge variant — nothing in this codebase currently
  needs it (the "none 🎉" zero-count case already communicates success via text), and adding an
  unused variant is exactly the kind of premature abstraction this repo's conventions avoid.
- Do NOT attempt to dedupe `HealthView.tsx` and `health/page.tsx` into one shared component — that
  is a separate, already-tracked follow-up in `plans/README.md`. Keep both files edited in lockstep.
- No new dependencies.

## Verification

- **Mechanical**: `bun run typecheck` clean; `bun test` green (no test currently asserts badge
  variant colors — do not add one for this cosmetic change).
- **Behavior check (required)**: start `bun run dev`.
  - Visit a concept page in both light and dark mode: the type badge (e.g. "Reference") should now
    render in the new indigo accent, visually distinct from the gray-outlined tag badges.
  - Visit `/health/`: with the baked `example-bundle` (which has 2 orphans, 0 everything else),
    confirm the "Orphans" summary badge and its section heading badge both render in the new amber
    warning color, while the other 5 (all zero) stay `outline`. Then check
    `src/components/open/OpenViewer.tsx`'s embedded health view (`/open` → load `example-bundle`
    locally → health route) renders identically.
  - Check text-on-badge contrast is legible in both themes for the new `warning` badge and the
    re-colored `default`/type badge — this is the risk the review flagged; if either is hard to
    read, adjust `--warning-foreground` (or `--primary-foreground`) rather than reverting the hue.
  - Confirm the connection-graph "you are here" node on a concept page with links (e.g.
    `/c/references/metrics/event_count/`) now has a visibly colored border/fill, not a barely-there
    gray one — with NO changes to `Neighborhood.tsx` itself.
- **Done when**: all checks pass, both health-page copies remain structurally symmetric, and the
  diff is limited to the four files.
