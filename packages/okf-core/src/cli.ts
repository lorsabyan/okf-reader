import fs from 'node:fs';
import { validateBundle } from './validate.ts';

/**
 * `okf-validate` CLI entry point. Thin wrapper around `validateBundle`
 * (./validate.ts): argv parsing, printing, and the process exit code only —
 * the fs-walking/validation logic lives there so it can be imported (and
 * tested) without triggering this module's `process.exit`.
 *
 * Exit codes: 0 clean, 1 errors (or warnings with --strict), 2 usage/IO error.
 */

const USAGE = 'usage: okf-validate <bundle-dir> [--strict]';

interface ParsedArgs {
  target: string;
  strict: boolean;
}

/** Strict argv parser: exactly one positional (the bundle dir) plus an optional `--strict`. */
function parseArgs(argv: string[]): ParsedArgs | null {
  let target: string | undefined;
  let strict = false;
  for (const arg of argv) {
    if (arg === '--strict') {
      if (strict) return null; // duplicate flag
      strict = true;
    } else if (arg.startsWith('-')) {
      return null; // unknown flag
    } else if (target === undefined) {
      target = arg;
    } else {
      return null; // extra positional argument
    }
  }
  if (target === undefined) return null;
  return { target, strict };
}

function main(argv: string[]): number {
  const parsed = parseArgs(argv.slice(2));
  if (!parsed) {
    console.error(USAGE);
    return 2;
  }
  const { target, strict } = parsed;

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`error: ${target} is not a directory`);
    return 2;
  }

  const { bundle, errors, warnings } = validateBundle(target);
  for (const msg of errors) console.log(`ERROR   ${msg}`);
  for (const msg of warnings) console.log(`warning ${msg}`);
  console.log(`\n${target}: ${bundle.concepts.length} concept doc(s), ${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length || (strict && warnings.length)) return 1;
  console.log('Bundle is conformant with OKF v0.1.');
  return 0;
}

// Always run: this module is CLI-only (never imported by the library entry
// or by app code), and is loaded both directly (`bun src/cli.ts`) and via
// the `bin/okf-validate.js` shim, where `import.meta.main` would be false.
process.exit(main(process.argv));
