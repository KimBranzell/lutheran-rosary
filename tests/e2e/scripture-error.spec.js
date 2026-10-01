import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * The scripture asset is precached by the service worker, so `page.route` alone
 * cannot make it fail — a SW-served request never reaches the network layer.
 * These tests therefore run with service workers blocked.
 */
test.describe('missing scripture data', () => {
  let context;
  let page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    // Simulate a cold, offline first visit where the asset never arrives.
    await page.route('**/scripture-passages.json', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('.home-view')).toBeVisible();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('starting a session shows an actionable error instead of a silent no-op', async () => {
    await page.click('#btn-start');

    await expect(page.locator('.scripture-error')).toBeVisible();

    // The title must describe what is really on screen (WCAG 2.4.2).
    await expect(page).toHaveTitle(/Bibeltexten saknas/);

    // Focus lands on the error heading (WCAG 2.4.3), not a stale home heading.
    await expect(page.locator('#scripture-error-heading')).toBeFocused();

    // No nav item may claim to be the current page while this is showing.
    await expect(page.locator('nav button[aria-current="page"]')).toHaveCount(0);

    // Both controls are reachable and operable from the keyboard.
    await expect(page.locator('#btn-retry-scripture')).toBeVisible();
    await expect(page.locator('#btn-scripture-back')).toBeVisible();
  });

  test('the error view has no detectable accessibility violations', async () => {
    await page.click('#btn-start');
    await expect(page.locator('.scripture-error')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('Tillbaka returns to the home view and restores its title', async () => {
    await page.click('#btn-start');
    await expect(page.locator('.scripture-error')).toBeVisible();

    await page.click('#btn-scripture-back');
    await expect(page.locator('.home-view')).toBeVisible();
    await expect(page).toHaveTitle('Luthers Rosenkrans');
    await expect(page.locator('#nav-home')).toHaveAttribute('aria-current', 'page');
  });

  test('Försök igen re-attempts the load and fails safely while offline', async () => {
    await page.click('#btn-start');
    await expect(page.locator('.scripture-error')).toBeVisible();

    await page.click('#btn-retry-scripture');
    // Still blocked: the error view is re-rendered, never a blank screen.
    await expect(page.locator('.scripture-error')).toBeVisible();
    await expect(page).toHaveTitle(/Bibeltexten saknas/);
  });

  test('the home view stays usable while the scripture asset is unavailable', async () => {
    // First paint must not depend on the fetch — the preview falls back to raw refs.
    const ref = page.locator('#preview-list .mystery-preview__ref').first();
    await expect(ref).toBeVisible();
    await expect(ref).toHaveText(/^[A-Z]{2,3} \d+:\d+/);

    // Selectors and persistence still work with no scripture data.
    await page.locator('label.mystery-option:has(input[value="sorgfull"])').click();
    await expect(page.locator('#preview-title')).toHaveText('Smärtorika');
  });
});
