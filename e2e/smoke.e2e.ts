import { expect, test } from '@playwright/test';

test('home renders bundle name, sidebar concepts, and tours', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'example-bundle' })).toBeVisible();

  const sidebar = page.locator('nav');
  await expect(sidebar.getByRole('link').first()).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Event Count' })).toBeVisible();

  await expect(page.getByRole('heading', { level: 2, name: 'Tours' })).toBeVisible();
  await expect(page.getByText('GA4 essentials').first()).toBeVisible();
});

test('sidebar navigation shows the type badge, and a known concept has a "Cited by" backlink', async ({ page }) => {
  await page.goto('/');

  await page.locator('nav').getByRole('link', { name: 'Event Count' }).click();
  await expect(page).toHaveURL(/\/c\/references\/metrics\/event_count\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Event Count' })).toBeVisible();
  await expect(page.locator('[data-slot="badge"]', { hasText: 'Reference' }).first()).toBeVisible();

  // Concrete backlink case: the events table cites Event Count, so Event
  // Count's page should list it under "Cited by".
  await expect(page.getByRole('heading', { name: 'Cited by' })).toBeVisible();
  // Scope to the list: the connection-graph SVG node link carries the same
  // accessible name (aria-label), so an article-wide role query matches both.
  await expect(
    page
      .getByRole('article')
      .getByRole('list')
      .getByRole('link', { name: /Events table \(Google Analytics BigQuery Export\)/ }),
  ).toBeVisible();
});

test('tour flow: start tour, then step forward via the sticky bar', async ({ page }) => {
  await page.goto('/c/tours/ga4-essentials/');
  await expect(page.getByRole('heading', { level: 1, name: 'GA4 essentials' })).toBeVisible();

  await page.getByRole('link', { name: 'Start tour' }).click();

  const stickyBar = page.getByText(/^Step \d+ of \d+$/);
  await expect(stickyBar).toHaveText('Step 1 of 5');

  await page.getByRole('link', { name: 'Next' }).click();
  await expect(stickyBar).toHaveText('Step 2 of 5');
});

test('health page renders all six category headings', async ({ page }) => {
  await page.goto('/health/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bundle health' })).toBeVisible();

  for (const heading of [
    'Broken links',
    'Missing descriptions',
    'Untyped concepts',
    'Stale concepts (older than a year)',
    'Undated concepts',
    'Orphans (no inbound or outbound links)',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }
});

test('search finds and navigates to a concept via the pagefind index', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.getByPlaceholder('Search concepts…').fill('pageviews');

  // Other results' excerpts can also mention the phrase — pick the hit whose
  // target URL is the Average Pageviews concept itself.
  const result = page.locator('[data-slot="command-item"][data-value="/c/references/metrics/avg_pageviews/"]');
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/\/c\/references\/metrics\/avg_pageviews\/$/);
});

test('runtime viewer: search an opened bundle and navigate to a concept via ⌘K', async ({ page }) => {
  await page.goto('/open/');

  await page.setInputFiles('input[type="file"]', 'example-bundle');
  await expect(page.getByRole('heading', { level: 1, name: 'example-bundle' })).toBeVisible();

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.getByPlaceholder('Search this bundle…').fill('pageviews');

  // Other results' excerpts can also mention the phrase (e.g. a citing concept's
  // body) — pick the hit whose target href is the Average Pageviews concept itself.
  const result = page.locator('[data-slot="command-item"][data-value="#/references/metrics/avg_pageviews"]');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Average Pageviews');
  await result.click();

  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/references/metrics/avg_pageviews');
});
