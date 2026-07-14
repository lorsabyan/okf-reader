import { describe, expect, test } from 'bun:test';
import { buildBundle, extractLinkTargets, parseFrontmatter, resolveLink } from './core.ts';

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

  test('strips a leading BOM before parsing', () => {
    const { data, body } = parseFrontmatter('﻿---\ntype: Table\n---\nBody.');
    expect(data.type).toBe('Table');
    expect(body.trim()).toBe('Body.');
  });

  test('supports a zero-line (empty) frontmatter block', () => {
    const { data, body } = parseFrontmatter('---\n---\nBody.');
    expect(data).toEqual({});
    expect(body.trim()).toBe('Body.');
  });
});

describe('extractLinkTargets', () => {
  test('extracts a titled link', () => {
    expect(extractLinkTargets('See [b](b.md "my title") for more.')).toEqual(['b.md']);
  });

  test('extracts an angle-bracketed target with a space', () => {
    expect(extractLinkTargets('See [x](<my file.md>).')).toEqual(['my file.md']);
  });

  test('does not extract external .md URLs', () => {
    expect(extractLinkTargets('See the [spec](https://example.com/spec.md).')).toEqual([]);
    expect(extractLinkTargets('See the [spec](//example.com/spec.md).')).toEqual([]);
  });

  test('does not extract image links', () => {
    expect(extractLinkTargets('![diagram](pic.md)')).toEqual([]);
  });

  test('extracts a fragment link and strips the fragment', () => {
    expect(extractLinkTargets('See [section](foo.md#section).')).toEqual(['foo.md']);
  });
});

describe('resolveLink', () => {
  test('resolves a fragment link to the same id as the plain target', () => {
    expect(resolveLink('foo.md#section', 'a/b')).toBe(resolveLink('foo.md', 'a/b'));
  });

  test('does not clamp traversal above the bundle root to a real concept id', () => {
    const id = resolveLink('../../../x.md', 'a/b');
    expect(id.startsWith('..')).toBe(true);
    expect(id).not.toBe('x');
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

describe('buildBundle type handling', () => {
  test('an empty-string type is not treated as explicit', () => {
    const files = new Map([['a.md', '---\ntype: ""\n---\nBody.']]);
    const bundle = buildBundle(files, 'test');
    const concept = bundle.byId.get('a')!;
    expect(concept.typeExplicit).toBe(false);
    expect(concept.type).toBe('Concept');
  });
});

describe('buildBundle link extraction edge cases', () => {
  test('titled, angle-bracket, external, image, and fragment links resolve as expected', () => {
    const files = new Map([
      [
        'a.md',
        [
          '---\ntype: Concept\n---',
          '[b](b.md "my title")',
          '[c](<my file.md>)',
          '[spec](https://example.com/spec.md)',
          '![diagram](pic.md)',
          '[d](d.md#section)',
        ].join('\n'),
      ],
      ['b.md', '---\ntype: Concept\n---\nB.'],
      ['my file.md', '---\ntype: Concept\n---\nSpaced file.'],
      ['d.md', '---\ntype: Concept\n---\nD.'],
      ['pic.md', '---\ntype: Concept\n---\nShould not be linked via the image tag.'],
    ]);
    const bundle = buildBundle(files, 'test');
    const a = bundle.byId.get('a')!;
    expect(a.outLinks).toContain('b');
    expect(a.outLinks).toContain('my file');
    expect(a.outLinks).toContain('d');
    expect(a.outLinks).not.toContain('pic');
    expect(a.outLinks).not.toContain('https:/example.com/spec');
  });
});

describe('buildBundle steps frontmatter', () => {
  const files = new Map([
    [
      'tours/basics.md',
      '---\ntype: Tour\nsteps:\n  - tables/orders\n  - tables/customers\n---\nIntro.',
    ],
    ['tables/orders.md', '---\ntype: Table\n---\nOrders.'],
    ['tables/customers.md', '---\ntype: Table\n---\nCustomers.'],
    ['tables/untouched.md', '---\ntype: Table\n---\nNo steps here.'],
  ]);
  const bundle = buildBundle(files, 'test');

  test('parses a steps array into string ids', () => {
    expect(bundle.byId.get('tours/basics')!.steps).toEqual(['tables/orders', 'tables/customers']);
  });

  test('leaves steps undefined when frontmatter has none', () => {
    expect(bundle.byId.get('tables/untouched')!.steps).toBeUndefined();
  });
});
