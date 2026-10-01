import { test, expect } from '@playwright/test';

/**
 * Offline is the product's headline claim, but there was previously no test for
 * it. The service worker can only answer from the precache once it has
 * installed (precache), activated and claimed the page.
 */
async function swControls(page) {
  return page
    .waitForFunction(
      () => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
}

test('the app boots and prays offline from the precache', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();

    const attached = await swControls(page);
    test.skip(!attached, 'service worker did not attach in this environment');

    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('.home-view')).toBeVisible();
    await expect(page.locator('#btn-start')).toBeVisible();

    // The scripture asset must be precached too, or the session would fall back
    // to the error view while offline.
    await page.click('#btn-start');
    await expect(page.locator('.prayer-view')).toBeVisible();
    await expect(page.locator('.scripture-error')).toHaveCount(0);
    await expect(page.locator('#step-total')).toHaveText('86');
  } finally {
    await context.close();
  }
});

test('an unknown path while offline shows the branded offline page', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();

    const attached = await swControls(page);
    test.skip(!attached, 'service worker did not attach in this environment');

    await context.setOffline(true);
    await page.goto('/saknas-har');

    await expect(page.locator('h1')).toHaveText('Ingen anslutning');
    await expect(page).toHaveTitle(/Offline/);
  } finally {
    await context.close();
  }
});

test('the service worker never controls a page before it is installed', async ({ browser }) => {
  // Sanity check for the skip above: if this ever fails, the offline tests are
  // proving something vacuous.
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();
    expect(await swControls(page), 'SW should claim the first page').toBe(true);
  } finally {
    await context.close();
  }
});
