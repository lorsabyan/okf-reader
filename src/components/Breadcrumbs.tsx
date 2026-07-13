/**
 * Home / <dir> / <subdir> / <title> — only "Home" is a link; directory
 * segments are plain text (they have no pages of their own). Dumb by
 * design: the caller decides what "home" links to (`/` in SSG, `#/` in
 * the runtime viewer).
 */
export default function Breadcrumbs({
  id,
  title,
  homeHref,
}: {
  id: string;
  title: string;
  homeHref: string;
}) {
  const dirs = id.includes('/') ? id.split('/').slice(0, -1) : [];
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <a href={homeHref} className="hover:text-foreground hover:underline">
        Home
      </a>
      {dirs.map((segment, i) => (
        <span key={i} className="flex cursor-default items-center gap-1.5">
          <span aria-hidden="true">/</span>
          {segment}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{title}</span>
      </span>
    </nav>
  );
}
