import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun scripts/serve-out.ts',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
