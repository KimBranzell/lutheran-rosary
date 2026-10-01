import { test, expect } from '@playwright/test';

/**
 * First paint must not wait on `scripture-passages.json`.
 *
 * The asset is precached by the service worker, so `page.route` cannot gate it —
 * a SW-served request never reaches the network layer. These tests therefore run
 * with service workers blocked so the route handler actually controls timing.
 *
 * The proof of non-blocking render is an *ordering* property, not a stopwatch:
 * the home view becomes visible while the preview still shows the raw USX
 * fallback (i.e. before any data arrived), and only then upgrades to a Swedish
 * book name. If bootstrap still awaited the fetch, the view would never appear
 * while the gate is held and the test would time out instead.
 */
test.describe('non-blocking scripture load', () => {
  let context;
  let page;
  let release;
  let gate;

  test.beforeEach(async ({ browser }) => {
    // Fresh gate per test — the config runs tests fullyParallel across workers.
    gate = new Promise((resolve) => { release = resolve; });
    context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    await page.route('**/scripture-passages.json', async (route) => {
      await gate;
      await route.continue();
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('home renders before the asset arrives, then upgrades in place', async () => {
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();

    const ref = page.locator('#preview-list .mystery-preview__ref').first();
    await expect(ref).toBeVisible();

    // Ordering proof: the view is on screen AND data has not arrived yet.
    await expect(ref).toHaveText(/^[A-Z]{2,3} \d+:\d+/);

    // Focus somewhere a full re-render would destroy, proving the upgrade patches
    // the preview rather than rebuilding the view (WCAG 2.4.3).
    await page.locator('#btn-start').focus();
    await expect(page.locator('#btn-start')).toBeFocused();

    release();
    // Retrying assertions wait for the fetch to land.
    await expect(ref).not.toHaveText(/^[A-Z]{2,3} \d+:\d+/);
    await expect(ref).toHaveText(/[a-zåäö].*\d+:\d+/);

    // Focus untouched by the upgrade.
    await expect(page.locator('#btn-start')).toBeFocused();
    // Still exactly one selection.
    await expect(page.locator('input[name="mystery-set"]:checked')).toHaveCount(1);
  });

  test('a selection made while data was loading survives the upgrade', async () => {
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();

    // Choose a set that is not today's (clicking the checked radio fires no event).
    const preselected = await page.locator('input[name="mystery-set"]:checked').getAttribute('value');
    const target = ['gladjefylld', 'lysande', 'sorgfull', 'harrlig'].find((id) => id !== preselected);
    const nameOf = { gladjefylld: 'Glädjerika', lysande: 'Ljusets', sorgfull: 'Smärtorika', harrlig: 'Ärorika' };

    await page.locator(`label.mystery-option:has(input[value="${target}"])`).click();
    await expect(page.locator('#preview-title')).toHaveText(nameOf[target]);

    // Data is still held at this point.
    await expect(page.locator('#preview-list .mystery-preview__ref').first())
      .toHaveText(/^[A-Z]{2,3} \d+:\d+/);

    release();
    await expect(page.locator('#preview-list .mystery-preview__ref').first()).toHaveText(/[a-zåäö]/);

    // Neither the choice nor its preview heading may be lost to the upgrade.
    await expect(page.locator(`input[name="mystery-set"][value="${target}"]`)).toBeChecked();
    await expect(page.locator('#preview-title')).toHaveText(nameOf[target]);
  });
});
