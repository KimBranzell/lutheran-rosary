import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
});

test('home screen has no detectable accessibility violations', async ({ page }) => {
  await expect(page.locator('.home-view')).toBeVisible();
  await expectNoViolations(page);
});

test('prayer screen has no detectable accessibility violations', async ({ page }) => {
  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expectNoViolations(page);
});

test('settings screen has no detectable accessibility violations', async ({ page }) => {
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await expectNoViolations(page);
});

test('dark colour scheme has no detectable accessibility violations', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('.home-view')).toBeVisible();
  await expectNoViolations(page);
});
