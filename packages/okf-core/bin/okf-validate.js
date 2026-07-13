#!/usr/bin/env node
// Thin shim so `bin.okf-validate` resolves to a plain .js entry point (npm/bunx
// convention). Runs under Bun (transpiles TS natively) AND Node >= 22.6 (type
// stripping) — which is why every relative import in src/ carries an explicit
// .ts extension: Node's type stripping refuses extensionless specifiers.
import '../src/cli.ts';
