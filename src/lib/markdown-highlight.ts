import rehypeShiki from '@shikijs/rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { buildProcessor, sanitizeSchemaWithStyle, type Heading, type RenderResult } from './markdown';
import { conceptHref } from './paths';

/**
 * Async render entry point that adds shiki syntax highlighting (dual
 * github-light/github-dark themes). Deliberately kept in its own module,
 * separate from `markdown.ts`, so that shiki's grammar/theme data is only
 * ever reachable from server components (concept page, home index, tour
 * intro) — never from the client runtime viewer, which imports
 * `renderMarkdown` from `markdown.ts` and never touches this file.
 */
export async function renderMarkdownWithHighlight(
  body: string,
  fromId: string,
  exists: (id: string) => boolean,
  hrefFor: (id: string) => string = conceptHref,
  dedupeDescription?: string,
): Promise<RenderResult> {
  const headings: Heading[] = [];
  const file = await buildProcessor(fromId, exists, hrefFor, headings, dedupeDescription)
    .use(rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } })
    .use(rehypeSanitize, sanitizeSchemaWithStyle)
    .use(rehypeStringify)
    .process(body);
  return { html: String(file), headings };
}

export type { Heading, RenderResult };
