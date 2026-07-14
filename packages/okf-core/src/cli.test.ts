import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI = path.join(import.meta.dir, 'cli.ts');

function run(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(['bun', CLI, ...args]);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe('okf-validate CLI', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-validate-cli-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function write(rel: string, contents: string): void {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }

  test('exits 0 on a clean bundle', () => {
    write('concept.md', '---\ntype: Concept\ndescription: Something.\ntimestamp: 2026-01-01\n---\nSee [other](./other.md).');
    write('other.md', '---\ntype: Concept\ndescription: Something else.\ntimestamp: 2026-01-01\n---\nSee [concept](./concept.md).');
    const { exitCode, stdout } = run([dir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Bundle is conformant with OKF v0.1.');
  });

  test('exits 1 when there are errors', () => {
    write('concept.md', '---\ntype: ""\n---\nBody.');
    const { exitCode, stdout } = run([dir]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("ERROR   concept.md: frontmatter is missing a non-empty 'type' field");
  });

  test('warnings alone exit 0 without --strict, 1 with --strict', () => {
    // Untyped-but-not-empty is handled by core.ts defaulting; use an orphan/undated
    // concept instead, which is guaranteed warning-only regardless of the
    // concurrently-in-progress typeExplicit fix.
    write('concept.md', '---\ntype: Concept\n---\nNo description, no timestamp, no links.');
    const clean = run([dir]);
    expect(clean.exitCode).toBe(0);
    expect(clean.stdout).toContain('warning');

    const strict = run([dir, '--strict']);
    expect(strict.exitCode).toBe(1);
    expect(strict.stdout).not.toContain('Bundle is conformant with OKF v0.1.');
  });

  test('exits 2 on an unknown flag', () => {
    write('concept.md', '---\ntype: Concept\n---\nBody.');
    const { exitCode, stderr } = run([dir, '--strcit']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('usage: okf-validate');
  });

  test('exits 2 with no arguments', () => {
    const { exitCode, stderr } = run([]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('usage: okf-validate');
  });

  test('exits 2 on an extra positional argument', () => {
    write('concept.md', '---\ntype: Concept\n---\nBody.');
    const { exitCode, stderr } = run([dir, 'extra-arg']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('usage: okf-validate');
  });

  test('exits 2 when the target is not a directory', () => {
    const file = path.join(dir, 'not-a-dir.txt');
    fs.writeFileSync(file, 'x');
    const { exitCode, stderr } = run([file]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('is not a directory');
  });
});
