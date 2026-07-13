import { describe, expect, test } from 'bun:test';
import { buildBundle, parseFrontmatter } from './core';
import { parseGithubUrl } from './sources/github';

describe('parseFrontmatter', () => {
  test('parses YAML block and returns body', () => {
    const { data, body } = parseFrontmatter('---\ntype: Metric\ntags: [a, b]\n---\nBody here.\n');
    expect(data.type).toBe('Metric');
    expect(data.tags).toEqual(['a', 'b']);
    expect(body.trim()).toBe('Body here.');
  });

  test('handles CRLF line endings', () => {
    const { data, body } = parseFrontmatter('---\r\ntype: Table\r\n---\r\nBody.');
    expect(data.type).toBe('Table');
    expect(body.trim()).toBe('Body.');
  });

  test('returns empty data when frontmatter is absent or invalid', () => {
    expect(parseFrontmatter('no frontmatter').data).toEqual({});
    expect(parseFrontmatter('---\n: [unclosed\n---\nbody').data).toEqual({});
  });
});

describe('buildBundle', () => {
  const files = new Map([
    ['index.md', '# Root\n\n* [Orders](tables/orders.md) - orders'],
    ['tables/orders.md', '---\ntype: Table\ndescription: Orders.\n---\nFK to [customers](/tables/customers.md).'],
    ['tables/customers.md', '---\ntype: Table\n---\nSee [orders](./orders.md).'],
    ['.github/hidden.md', '---\ntype: Nope\n---\n'],
    ['notes.txt', 'not markdown'],
  ]);
  const bundle = buildBundle(files, 'test');

  test('skips reserved files, hidden dirs, and non-markdown', () => {
    expect(bundle.concepts.map((c) => c.id)).toEqual(['tables/customers', 'tables/orders']);
  });

  test('derives title from filename when missing', () => {
    expect(bundle.byId.get('tables/orders')!.title).toBe('orders');
  });

  test('computes out-links and backlinks both ways', () => {
    expect(bundle.byId.get('tables/orders')!.outLinks).toEqual(['tables/customers']);
    expect(bundle.backlinks.get('tables/orders')).toEqual(['tables/customers']);
  });

  test('keeps reserved files accessible in files map', () => {
    expect(bundle.files.get('index.md')).toContain('# Root');
  });
});

describe('parseGithubUrl', () => {
  test('owner/repo shorthand', () => {
    expect(parseGithubUrl('lorsabyan/okf-skill')).toEqual({
      owner: 'lorsabyan',
      repo: 'okf-skill',
      branch: undefined,
      subdir: '',
    });
  });

  test('full URL with branch and subdir', () => {
    expect(parseGithubUrl('https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/ga4')).toEqual({
      owner: 'GoogleCloudPlatform',
      repo: 'knowledge-catalog',
      branch: 'main',
      subdir: 'okf/bundles/ga4',
    });
  });

  test('tolerates trailing slash, .git suffix, and www', () => {
    expect(parseGithubUrl('https://www.github.com/foo/bar.git/')).toMatchObject({ owner: 'foo', repo: 'bar' });
  });

  test('rejects garbage', () => {
    expect(parseGithubUrl('not a url at all !!!')).toBeNull();
  });
});
