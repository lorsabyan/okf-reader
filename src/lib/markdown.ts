import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { isReservedTarget, resolveLink } from '@okf/core';
import { conceptHref } from './paths';

/**
 * Unified (remark/rehype) markdown pipeline for OKF concept bodies.
 *
 * Shared by both render entry points below and kept free of any shiki
 * import — anything that touches shiki lives in `markdown-highlight.ts`
 * instead, so client bundles that only need `renderMarkdown` never pull
 * shiki's (large, WASM-backed) grammar/theme data in.
 */

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

/** Minimal duck-typed hast node shape — enough to walk the tree without depending on the `hast` package for types. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

/** Minimal duck-typed mdast node shape — same rationale as `HastNode`, but for the pre-rehype tree. */
interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
}

function walk(node: HastNode, visit: (el: HastNode) => void): void {
  if (node.type === 'element') visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, visit);
  }
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(textContent).join('');
  return '';
}

function addClassName(properties: Record<string, unknown>, cls: string): void {
  const existing = properties.className;
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  properties.className = [...list, cls];
}

const EXTERNAL_RE = /^[a-z][a-z0-9+.-]*:/i;
const MD_HREF_RE = /\.md(#.*)?$/;

/**
 * Rehype plugin: rewrite `.md` link targets the same way the old regex
 * pass did — existing concepts route via `hrefFor`; reserved (index/log)
 * targets become inert plain text; missing concepts become inert but
 * visibly "not yet written" markers. External URLs are left untouched.
 */
function rehypeRewriteLinks(fromId: string, exists: (id: string) => boolean, hrefFor: (id: string) => string) {
  return () => (tree: HastNode) => {
    walk(tree, (node) => {
      if (node.tagName !== 'a') return;
      const properties = (node.properties ??= {});
      const href = properties.href;
      if (typeof href !== 'string' || !MD_HREF_RE.test(href) || EXTERNAL_RE.test(href)) return;

      const id = resolveLink(href, fromId);
      if (exists(id)) {
        properties.href = hrefFor(id);
        return;
      }
      if (isReservedTarget(id)) {
        addClassName(properties, 'link-plain');
        properties.href = '#';
        return;
      }
      addClassName(properties, 'link-broken');
      properties.href = '#';
      properties.title = `Not yet written: ${id}`;
    });
  };
}

function mdastText(node: MdastNode): string {
  if (typeof node.value === 'string') return node.value;
  if (Array.isArray(node.children)) return node.children.map(mdastText).join('');
  return '';
}

/** lowercase, collapse whitespace, strip trailing punctuation — so "Foo bar." and "foo  bar" compare equal. */
function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
}

/**
 * Remark plugin: many bundle authors open a concept body with a sentence
 * identical to its frontmatter `description`, which then renders twice —
 * once as the page subtitle, once as the body's first paragraph. If the
 * body's very first top-level node is a paragraph whose normalized text
 * matches the normalized description, drop it. Only ever considers that
 * first node — a heading (or anything else) in that slot means no
 * paragraph further down is touched.
 */
function remarkStripDuplicateDescription(description?: string) {
  return () => (tree: MdastNode) => {
    if (!description) return;
    const target = normalizeForCompare(description);
    if (!target) return;
    const children = tree.children;
    if (!Array.isArray(children) || children.length === 0) return;
    const first = children[0];
    if (first.type !== 'paragraph') return;
    if (normalizeForCompare(mdastText(first)) === target) children.splice(0, 1);
  };
}

/** Rehype plugin: collect h2/h3 headings (after rehype-slug has ids'd them) for the per-page TOC. */
function rehypeCollectHeadings(sink: Heading[]) {
  return () => (tree: HastNode) => {
    walk(tree, (node) => {
      const match = /^h([1-6])$/.exec(node.tagName ?? '');
      if (!match) return;
      const depth = Number(match[1]);
      if (depth < 2 || depth > 3) return;
      const id = node.properties?.id;
      if (typeof id !== 'string' || !id) return;
      sink.push({ depth, id, text: textContent(node).trim() });
    });
  };
}

/**
 * Sanitize schema: GitHub-style default, extended for what this reader's
 * own pipeline output needs — `className` on links (our `link-plain` /
 * `link-broken` markers) and on `code`/`span`/`pre` (shiki's output
 * classes), plus inline `style` on `code`/`span`/`pre` (shiki emits
 * per-token colors as inline styles for its dual light/dark themes —
 * that's the pragmatic call: we only open `style` on the three elements
 * shiki actually touches, nothing else). Heading `id`s (slug anchors) are
 * already permitted by the default schema's `*` rule; we just exempt
 * `id` from DOM-clobber prefixing so anchors match what rehype-slug and
 * the TOC agree on.
 */
function widenClassName(entries: unknown[] | undefined): unknown[] {
  const rest = (entries ?? []).filter((entry) =>
    Array.isArray(entry) ? entry[0] !== 'className' : entry !== 'className',
  );
  return ['className', ...rest];
}

const attributes: Record<string, unknown[]> = {
  ...(defaultSchema.attributes as Record<string, unknown[]>),
  a: widenClassName(defaultSchema.attributes?.a),
  code: [...widenClassName(defaultSchema.attributes?.code), 'style'],
  span: ['className', 'style'],
  pre: ['className', 'style'],
};

export const sanitizeSchema = {
  ...defaultSchema,
  clobber: (defaultSchema.clobber ?? []).filter((name) => name !== 'id'),
  attributes,
} as SanitizeSchema;

/** Build the shared remark→rehype pipeline, stopping short of sanitize/stringify so callers can splice in shiki. */
export function buildProcessor(
  fromId: string,
  exists: (id: string) => boolean,
  hrefFor: (id: string) => string,
  headings: Heading[],
  dedupeDescription?: string,
) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStripDuplicateDescription(dedupeDescription))
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeRewriteLinks(fromId, exists, hrefFor))
    .use(rehypeCollectHeadings(headings));
}

/**
 * Render an OKF markdown body to sanitized HTML, rewiring cross-links,
 * synchronously (no syntax highlighting). Used by the client runtime
 * viewer and anywhere else that can't await a promise.
 *
 * `dedupeDescription`, when passed (typically a concept's frontmatter
 * `description`), strips the body's first paragraph if it just repeats
 * that description — see `remarkStripDuplicateDescription`.
 */
export function renderMarkdown(
  body: string,
  fromId: string,
  exists: (id: string) => boolean,
  hrefFor: (id: string) => string = conceptHref,
  dedupeDescription?: string,
): RenderResult {
  const headings: Heading[] = [];
  const file = buildProcessor(fromId, exists, hrefFor, headings, dedupeDescription)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .processSync(body);
  return { html: String(file), headings };
}
