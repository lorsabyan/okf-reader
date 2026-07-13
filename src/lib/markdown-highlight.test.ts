import { describe, expect, test } from 'bun:test';
import { renderMarkdownWithHighlight } from './markdown-highlight';

const exists = (id: string) => id === 'tables/customers' || id === 'tables/orders';

describe('renderMarkdownWithHighlight', () => {
  test('assigns a slug id to headings', async () => {
    const { html, headings } = await renderMarkdownWithHighlight('## Getting Started\n\nBody.', 'tables/orders', exists);
    expect(html).toContain('id="getting-started"');
    expect(headings).toEqual([{ depth: 2, id: 'getting-started', text: 'Getting Started' }]);
  });

  test('strips a <script> tag from the body', async () => {
    const { html } = await renderMarkdownWithHighlight('Hi <script>alert(1)</script> there.', 'tables/orders', exists);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  test('highlights fenced code blocks with shiki (inline per-token colors survive sanitize)', async () => {
    const { html } = await renderMarkdownWithHighlight('```js\nconst x = 1;\n```', 'tables/orders', exists);
    expect(html).toContain('<pre');
    expect(html).toContain('style="');
    expect(html).toContain('--shiki-dark');
    expect(html).toContain('<span style=');
  });

  test('still rewires cross-links like the sync entry point', async () => {
    const { html } = await renderMarkdownWithHighlight('See [orders](/tables/orders.md).', '', exists);
    expect(html).toContain('href="/c/tables/orders/"');
  });
});
