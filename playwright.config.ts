import { defineConfig, devices } from '@playwright/test';

// e2e/basepath.e2e.ts sets this (and builds+serves under it) to reproduce
// GitHub Pages' sub-path hosting; every other spec runs with '' (origin root).
const BASE_PATH = process.env.E2E_BASE_PATH ?? '';

/**
 * Smoke suite runs against the static `out/` build (run `bun run build`
 * first) — not `next dev`. The webServer starts scripts/serve-out.ts, a
 * tiny dependency-free static file server (see that file for why).
 */
export default defineConfig({
  testDir: './e2e',
  // Bun's own test runner auto-discovers `*.test.*`/`*.spec.*` files
  // anywhere in the repo, which would otherwise pick up (and fail to run)
  // Playwright specs too. Use a distinct `*.e2e.ts` suffix so `bun test`
  // and `playwright test` each only see their own files.
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    // Trailing slash matters: relative goto()s (e.g. 'c/tours/x/') resolve
    // against this like a browser resolves an <a href>, so without it the
    // last path segment (here, the base path itself) would be dropped.
    baseURL: `http://localhost:4173${BASE_PATH}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun scripts/serve-out.ts',
    url: `http://localhost:4173${BASE_PATH}/`,
    reuseExistingServer: !process.env.CI,
  },
});
