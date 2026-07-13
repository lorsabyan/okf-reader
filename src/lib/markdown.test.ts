import { describe, expect, test } from 'bun:test';
import { renderMarkdown } from './markdown';

const exists = (id: string) => id === 'tables/customers' || id === 'tables/orders';

describe('renderMarkdown', () => {
  test('rewires existing bundle-absolute links to reader routes', () => {
    const { html } = renderMarkdown('See [customers](/tables/customers.md).', 'datasets/sales', exists);
    expect(html).toContain('href="/c/tables/customers/"');
  });

  test('rewires relative links against the current concept', () => {
    const { html } = renderMarkdown('See [orders](./orders.md).', 'tables/customers', exists);
    expect(html).toContain('href="/c/tables/orders/"');
  });

  test('marks links to missing concepts as broken, not navigable', () => {
    const { html } = renderMarkdown('See [ghost](/tables/ghost.md).', 'tables/orders', exists);
    expect(html).toContain('link-broken');
    expect(html).toContain('Not yet written: tables/ghost');
    expect(html).not.toContain('href="/c/tables/ghost/"');
  });

  test('de-links reserved index/log targets to plain text', () => {
    const { html } = renderMarkdown('[datasets](datasets/index.md) and [log](/log.md)', '', exists);
    const matches = html.match(/link-plain/g) ?? [];
    expect(matches.length).toBe(2);
  });

  test('leaves external URLs untouched', () => {
    const url = 'https://example.com/spec.md';
    const { html } = renderMarkdown(`[spec](${url})`, 'tables/orders', exists);
    expect(html).toContain(`href="${url}"`);
  });

  test('assigns a slug id to headings', () => {
    const { html, headings } = renderMarkdown('## Getting Started\n\nBody.', 'tables/orders', exists);
    expect(html).toContain('id="getting-started"');
    expect(headings).toEqual([{ depth: 2, id: 'getting-started', text: 'Getting Started' }]);
  });

  test('strips a <script> tag from the body', () => {
    const { html } = renderMarkdown('Hi <script>alert(1)</script> there.', 'tables/orders', exists);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });
});
