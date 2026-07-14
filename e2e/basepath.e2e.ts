import { expect, test } from '@playwright/test';

/**
 * Regression test for the base-path bug: src/lib/paths.ts used to read
 * `process.env.NEXT_BASE_PATH`, which Next.js never inlines into client
 * bundles (only `NEXT_PUBLIC_*` vars get that treatment). SSR HTML had
 * correctly prefixed hrefs, but React patched them away to `''`-prefixed
 * (i.e. unprefixed) hrefs the moment client components (TourView, TourBar)
 * hydrated — a hydration mismatch that also 404s on GitHub Pages.
 *
 * Requires a build made with `NEXT_BASE_PATH=$E2E_BASE_PATH`, served via
 * `scripts/serve-out.ts` (which only serves requests under that prefix,
 * see playwright.config.ts). Skipped otherwise, since there's nothing to
 * serve the base-path-prefixed build from in the default dev/CI run.
 */
test.skip(!process.env.E2E_BASE_PATH, 'set E2E_BASE_PATH and build+serve under it to run this spec');

const basePath = process.env.E2E_BASE_PATH ?? '';
// basePath is a literal path segment like "/okf-reader" — no regex metachars.
const hrefPrefix = new RegExp(`^${basePath}/c/`);

test('tour Start/Next links keep the base-path prefix after hydration', async ({ page }) => {
  await page.goto('c/tours/ga4-essentials/');
  await expect(page.getByRole('heading', { level: 1, name: 'GA4 essentials' })).toBeVisible();

  // TourView is a client component; by the time `goto` resolves (waits for
  // `load`), it has hydrated. Assert the href directly — this is the exact
  // attribute the pre-fix bug patches to lose its prefix.
  const startLink = page.getByRole('link', { name: 'Start tour' });
  await expect(startLink).toBeVisible();
  await expect(startLink).toHaveAttribute('href', hrefPrefix);

  await startLink.click();

  // Pre-fix, the click above follows the un-prefixed href, which
  // scripts/serve-out.ts (serving under E2E_BASE_PATH) 404s. TourBar only
  // renders once mounted, so this also confirms hydration completed here.
  const stickyBar = page.getByText(/^Step \d+ of \d+$/);
  await expect(stickyBar).toHaveText('Step 1 of 5');

  const nextLink = page.getByRole('link', { name: 'Next' });
  await expect(nextLink).toHaveAttribute('href', hrefPrefix);

  await nextLink.click();
  await expect(stickyBar).toHaveText('Step 2 of 5');
});
