/**
 * Shared Tailwind Typography class list for every rendered-markdown body
 * (SSG concept page, SSG home index, tour intro, runtime viewer). Bundle
 * authors write their own `# Heading` / `## Heading` inside a concept
 * body, which — with the typography plugin's defaults — renders nearly
 * as large as the page's own `<h1>` title. These `prose-h*` modifiers cap
 * body headings well below the page chrome so document structure always
 * reads as *inside* the page, not competing with it.
 */
export const PROSE_CLASS =
  'prose prose-neutral mt-8 max-w-none dark:prose-invert ' +
  'prose-h1:mt-8 prose-h1:text-2xl prose-h2:mt-6 prose-h2:text-xl prose-h3:mt-5 prose-h3:text-lg';
