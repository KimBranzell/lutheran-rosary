import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'luthers-rosenkrans-settings';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Horizontal overflow is the classic failure mode of a text-size setting. */
async function expectNoHorizontalOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth);
}

test('the settings view is retitled and offers a text size group', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();

  await expect(page.locator('#settings-heading')).toHaveText('Inställningar');

  // Two labelled sections, in a valid h2 → h3 outline.
  await expect(page.locator('.settings-subheading')).toHaveText('Påminnelser');
  await expect(page.locator('.choice__legend', { hasText: 'Textstorlek' })).toHaveCount(1);

  const options = page.locator('input[name="text-scale"]');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toBeChecked(); // Normal by default
  await expect(page.locator('input[name="text-scale"][value="1.25"]')).not.toBeChecked();
});

test('choosing a larger size applies immediately and persists', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();

  await page.locator('label.segmented__option:has(input[value="1.5"])').click();

  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.fontSize))
    .toBe('150%');

  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(stored.textScale).toBe(1.5);

  // Survives a reload (applied again on boot).
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('150%');
});

test('no view scrolls horizontally at the largest text size', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.locator('label.segmented__option:has(input[value="1.5"])').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.fontSize))
    .toBe('150%');

  await expectNoHorizontalOverflow(page);

  await page.click('#nav-home');
  await expect(page.locator('.home-view')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.click('#btn-exit');
  await expect(page.locator('.home-view')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('44px minimum targets still hold at the largest text size', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.locator('label.segmented__option:has(input[value="1.5"])').click();
  await page.click('#nav-home');
  await expect(page.locator('.home-view')).toBeVisible();

  // `--min-target` is deliberately declared in px so it never shrinks.
  const minTarget = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--min-target').trim(),
  );
  expect(minTarget).toBe('44px');
});

test('the settings view has no accessibility violations at the largest size', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.locator('label.segmented__option:has(input[value="1.5"])').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.fontSize))
    .toBe('150%');

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('the prayer view has no accessibility violations at the largest size', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.locator('label.segmented__option:has(input[value="1.5"])').click();
  await page.click('#nav-home');
  await expect(page.locator('.home-view')).toBeVisible();

  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
