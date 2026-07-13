import { marked } from 'marked';
import { resolveLink } from './core';
import { conceptHref } from './paths';

/**
 * Render an OKF markdown body to HTML, rewiring cross-links:
 * links to concepts that exist route via hrefFor (reader routes by
 * default, hash routes in the runtime viewer); links to missing
 * concepts (legal per spec — not-yet-written knowledge) become inert
 * but visibly marked. Runs in Node and the browser.
 */
export function renderMarkdown(
  body: string,
  fromId: string,
  exists: (id: string) => boolean,
  hrefFor: (id: string) => string = conceptHref,
): string {
  const html = marked.parse(body, { async: false, gfm: true }) as string;
  return html.replace(/href="([^"]+?\.md)(#[^"]*)?"/g, (whole, target) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return whole; // external URL
    const id = resolveLink(target, fromId);
    if (exists(id)) return `href="${hrefFor(id)}"`;
    // Reserved files (index/log) have no concept page — render as plain text.
    if (id === 'index' || id.endsWith('/index') || id === 'log' || id.endsWith('/log'))
      return `href="#" class="link-plain"`;
    return `href="#" class="link-broken" title="Not yet written: ${id}"`;
  });
}
