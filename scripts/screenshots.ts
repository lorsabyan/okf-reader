#!/usr/bin/env bun
// Captures the README screenshots against the built `out/` site. Starts its
// own copy of the static server (see scripts/serve-out.ts) rather than
// requiring one to already be running, so `bun run screenshots` works
// standalone after `bun run build`.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// import.meta.dirname works under both Bun and Node >= 20.11 (import.meta.dir is Bun-only).
const ROOT = join(import.meta.dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');
const PORT = 4174; // distinct from the e2e suite's port, so both can run concurrently
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORT = { width: 1440, height: 900 };

function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`Server at ${url} did not start in time`));
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function main() {
  mkdirSync(DOCS_DIR, { recursive: true });

  const server = spawn('bun', ['scripts/serve-out.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();

    // 1. home-light.png — home page, light theme (the default).
    {
      const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'light' });
      await page.goto(BASE_URL + '/');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(DOCS_DIR, 'home-light.png') });
      await page.close();
    }

    // 2. concept-dark.png — a concept page, dark theme (next-themes reads
    //    localStorage key "theme"; set it before any script runs).
    {
      const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'dark' });
      await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
      await page.goto(BASE_URL + '/c/tables/events_/');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(DOCS_DIR, 'concept-dark.png') });
      await page.close();
    }

    // 3. tour.png — tour page with its step list.
    {
      const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'light' });
      await page.goto(BASE_URL + '/c/tours/ga4-essentials/');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(DOCS_DIR, 'tour.png') });
      await page.close();
    }

    // 4. open.png — the /open/ runtime-viewer landing page.
    {
      const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'light' });
      await page.goto(BASE_URL + '/open/');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(DOCS_DIR, 'open.png') });
      await page.close();
    }

    await browser.close();
    console.log(`Wrote screenshots to ${DOCS_DIR}`);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
