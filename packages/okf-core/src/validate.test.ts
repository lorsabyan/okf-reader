import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateBundle } from './validate.ts';

// Repo-root example-bundle used as an end-to-end fixture: src -> okf-core -> packages -> repo root.
const EXAMPLE_BUNDLE = path.join(import.meta.dir, '../../../example-bundle');

describe('validateBundle against the repo example-bundle', () => {
  test('is clean: no errors, and only the two known orphan warnings', () => {
    const { bundle, errors, warnings } = validateBundle(EXAMPLE_BUNDLE);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      'datasets/ga4_obfuscated_sample_ecommerce: orphan - no inbound or outbound links',
      'tours/ga4-essentials: orphan - no inbound or outbound links',
    ]);
    expect(bundle.concepts.length).toBe(12);
  });
});

describe('validateBundle against fixture bundles', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-validate-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function write(rel: string, contents: string): void {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }

  test('an empty `type` is an ERROR, not a warning, and is not double-reported', () => {
    write('concept.md', '---\ntype: ""\ndescription: Something.\ntimestamp: 2026-01-01\n---\nBody.');
    const { errors, warnings } = validateBundle(dir);
    expect(errors).toEqual(["concept.md: frontmatter is missing a non-empty 'type' field"]);
    // Must not also appear as the analyzeBundle "untyped" warning for the same doc.
    expect(warnings.some((w) => w.includes('concept') && w.includes("missing a non-empty 'type' field"))).toBe(false);
  });

  test('a whitespace-only `type` is also an ERROR', () => {
    write('concept.md', '---\ntype: "   "\ndescription: Something.\ntimestamp: 2026-01-01\n---\nBody.');
    const { errors } = validateBundle(dir);
    expect(errors).toEqual(["concept.md: frontmatter is missing a non-empty 'type' field"]);
  });

  test('a missing `type` field is an ERROR', () => {
    write('concept.md', '---\ndescription: Something.\ntimestamp: 2026-01-01\n---\nBody.');
    const { errors } = validateBundle(dir);
    expect(errors).toEqual(["concept.md: frontmatter is missing a non-empty 'type' field"]);
  });

  test('a malformed timestamp is a WARNING mentioning ISO 8601', () => {
    write('concept.md', '---\ntype: Concept\ndescription: Something.\ntimestamp: "not-a-date"\n---\nBody.');
    const { errors, warnings } = validateBundle(dir);
    expect(errors).toEqual([]);
    expect(warnings).toContain(`concept.md: 'timestamp' (not-a-date) does not look like ISO 8601`);
  });

  test('a well-formed ISO-8601 timestamp does not trigger the shape warning', () => {
    write('concept.md', '---\ntype: Concept\ndescription: Something.\ntimestamp: 2026-01-01\n---\nBody.');
    const { warnings } = validateBundle(dir);
    expect(warnings.some((w) => w.includes('does not look like ISO 8601'))).toBe(false);
  });

  test('missing frontmatter is an ERROR', () => {
    write('concept.md', 'Just a body, no frontmatter at all.');
    const { errors } = validateBundle(dir);
    expect(errors).toEqual(['concept.md: missing or unparseable YAML frontmatter block']);
  });

  test('a BOM-prefixed file with valid frontmatter is NOT a frontmatter error', () => {
    // The validator must use the same parser buildBundle does — a file the
    // model reads fine (BOM stripped) must not be reported as malformed.
    write('concept.md', '﻿---\ntype: Concept\ndescription: Something.\ntimestamp: 2026-01-01\n---\nBody.');
    const { errors } = validateBundle(dir);
    expect(errors).toEqual([]);
  });

  test('an empty frontmatter block is a type ERROR, not a frontmatter error', () => {
    write('concept.md', '---\n---\nBody.');
    const { errors } = validateBundle(dir);
    expect(errors).toEqual(["concept.md: frontmatter is missing a non-empty 'type' field"]);
  });
});
