/**
 * Frontmatter `resource:` is free-text YAML from the bundle author, not a
 * validated URL — rendering it straight into an `<a href>` lets a
 * malicious bundle inject a `javascript:`/`data:` URL that executes on
 * click (React only dev-warns on `javascript:` hrefs; production is
 * silent). Only render it as a link when it's an absolute http(s) URL;
 * otherwise render the raw text with no anchor.
 */
const SAFE_RESOURCE_RE = /^https?:\/\//i;

export function isSafeResourceUrl(url: string): boolean {
  return SAFE_RESOURCE_RE.test(url);
}
