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

  test('marks links to missing concepts as broken, inert spans (not navigable anchors)', () => {
    const { html } = renderMarkdown('See [ghost](/tables/ghost.md).', 'tables/orders', exists);
    expect(html).toContain('link-broken');
    expect(html).toContain('Not yet written: tables/ghost');
    expect(html).not.toContain('href="/c/tables/ghost/"');
    expect(html).toContain('<span class="link-broken"');
    expect(html).not.toContain('<a');
    expect(html).not.toMatch(/href="#"/);
  });

  test('broken-link "not yet written" info is also exposed to screen readers, not just the hover title', () => {
    const { html } = renderMarkdown('See [ghost](/tables/ghost.md).', 'tables/orders', exists);
    expect(html).toContain('<span class="sr-only"> (not yet written)</span>');
    // Nested inside the broken-link span, so it survives sanitization as part of that element's children.
    const brokenIndex = html.indexOf('link-broken');
    const srOnlyIndex = html.indexOf('sr-only');
    expect(brokenIndex).toBeGreaterThan(-1);
    expect(srOnlyIndex).toBeGreaterThan(brokenIndex);
  });

  test('de-links reserved index/log targets to inert plain-text spans', () => {
    const { html } = renderMarkdown('[datasets](datasets/index.md) and [log](/log.md)', '', exists);
    const matches = html.match(/link-plain/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain('<span class="link-plain">datasets</span>');
    expect(html).not.toContain('<a');
    expect(html).not.toMatch(/href="#"/);
  });

  test('resolves an anchored cross-link to an existing concept, keeping the fragment', () => {
    const { html } = renderMarkdown('See [customers](/tables/customers.md#schema).', 'datasets/sales', exists);
    expect(html).toContain('href="/c/tables/customers/#schema"');
  });

  test('an anchored link to a missing concept is still reported broken (fragment does not mask it)', () => {
    const { html } = renderMarkdown('See [ghost](/tables/ghost.md#section).', 'tables/orders', exists);
    expect(html).toContain('link-broken');
    expect(html).toContain('Not yet written: tables/ghost');
  });

  test('client pipeline strips inline style attributes (not shiki-aware)', () => {
    const { html } = renderMarkdown('Hi <span style="position:fixed;inset:0;background:red">boo</span> there.', 'tables/orders', exists);
    expect(html).not.toContain('style=');
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

describe('sanitization vectors', () => {
  test('strips an onerror handler from an <img> tag', () => {
    const { html } = renderMarkdown('<img src=x onerror=alert(1)>', 'tables/orders', exists);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  test('strips a javascript: href from a link', () => {
    const { html } = renderMarkdown('[click](javascript:alert(1))', 'tables/orders', exists);
    expect(html).not.toContain('javascript:');
  });

  test('strips a data: href from a link', () => {
    const { html } = renderMarkdown('<a href="data:text/html,x">x</a>', 'tables/orders', exists);
    expect(html).not.toContain('data:');
  });

  test('drops <iframe> and <object> tags entirely', () => {
    const { html } = renderMarkdown(
      '<iframe src="https://evil.example"></iframe> and <object data="x"></object>',
      'tables/orders',
      exists,
    );
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<object');
    expect(html).not.toContain('evil.example');
  });

  test('strips a style attribute from a <span>', () => {
    const { html } = renderMarkdown('<span style="position:fixed">x</span>', 'tables/orders', exists);
    expect(html).not.toContain('style=');
  });

  test('strips an onload handler and disarms an inline <svg>', () => {
    const { html } = renderMarkdown('<svg onload=alert(1)>', 'tables/orders', exists);
    expect(html).not.toContain('onload');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('<svg');
  });
});

describe('renderMarkdown dedupeDescription', () => {
  test('strips the first paragraph on an exact match', () => {
    const description = 'A dataset of customer orders.';
    const body = `${description}\n\nMore detail here.`;
    const { html } = renderMarkdown(body, 'tables/orders', exists, undefined, description);
    expect(html).not.toContain('A dataset of customer orders.');
    expect(html).toContain('More detail here.');
  });

  test('strips a near match (trailing period and extra whitespace)', () => {
    const description = 'A dataset of customer orders';
    const body = 'A dataset of customer orders.  \n\nMore detail here.';
    const { html } = renderMarkdown(body, 'tables/orders', exists, undefined, description);
    expect(html).not.toContain('A dataset of customer orders');
    expect(html).toContain('More detail here.');
  });

  test('keeps the first paragraph when it differs from the description', () => {
    const description = 'A dataset of customer orders.';
    const body = 'Something else entirely.\n\nMore detail here.';
    const { html } = renderMarkdown(body, 'tables/orders', exists, undefined, description);
    expect(html).toContain('Something else entirely.');
    expect(html).toContain('More detail here.');
  });

  test('only ever considers the very first node — a matching later paragraph is kept', () => {
    const description = 'A dataset of customer orders.';
    const body = `# Overview\n\n${description}\n\nMore detail here.`;
    const { html } = renderMarkdown(body, 'tables/orders', exists, undefined, description);
    expect(html).toContain('A dataset of customer orders.');
    expect(html).toContain('More detail here.');
  });

  test('does nothing when no description is passed', () => {
    const body = 'A dataset of customer orders.\n\nMore detail here.';
    const { html } = renderMarkdown(body, 'tables/orders', exists);
    expect(html).toContain('A dataset of customer orders.');
  });
});
