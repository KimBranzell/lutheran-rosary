import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
});

test('a deep link opens the settings view with the right title', async ({ page }) => {
  await page.goto('/#settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await expect(page).toHaveTitle('Inställningar — Luthers Rosenkrans');
  await expect(page.locator('#nav-settings')).toHaveAttribute('aria-current', 'page');
});

test('a deep link into a session renders the prayer view', async ({ page }) => {
  await page.goto('/#prayer');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page).toHaveTitle('Rosenkransen — Luthers Rosenkrans');
});

test('an unknown hash falls back to home, never a blank screen', async ({ page }) => {
  await page.goto('/#bogus');
  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page).toHaveTitle('Luthers Rosenkrans');
});

test('Back from a nav destination returns home, restores aria-current and focus', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await expect(page.locator('#settings-heading')).toBeFocused();

  await page.goBack();
  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page.locator('#nav-home')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#nav-settings')).not.toHaveAttribute('aria-current', 'page');
  // WCAG 2.4.3: focus lands on the view we came back to, not the old heading.
  await expect(page.locator('#home-heading')).toBeFocused();
});

test('Back exits the prayer view instead of leaving the app', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page).toHaveURL(/#prayer$/);

  await page.goBack();
  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page).not.toHaveURL(/#prayer/);
  await expect(page.locator('#home-heading')).toBeFocused();
});

test('Avsluta pops the prayer entry rather than pushing home on top of it', async ({ page }) => {
  await page.goto('/');
  // Give the history stack a real entry behind the session, so Back is
  // meaningful after the exit.
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.click('#nav-home');
  await expect(page.locator('.home-view')).toBeVisible();

  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page).toHaveURL(/#prayer$/);

  await page.click('#btn-exit');
  await expect(page.locator('.home-view')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('');

  // The #prayer entry is gone, so Back must never land on the prayer view again.
  await page.goBack();
  await expect(page.locator('.prayer-view')).toHaveCount(0);
  await expect(page).not.toHaveURL(/#prayer/);
});

test('every view sets a title that describes what is on screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page).toHaveTitle('Luthers Rosenkrans');

  await page.click('#nav-sources');
  await expect(page.locator('.sources-view')).toBeVisible();
  await expect(page).toHaveTitle('Källor och licenser — Luthers Rosenkrans');

  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  await expect(page).toHaveTitle('Inställningar — Luthers Rosenkrans');

  await page.click('#nav-home');
  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page).toHaveTitle('Luthers Rosenkrans');
});

test('repeated navigation does not stack duplicate history entries for one view', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav-settings');
  await expect(page.locator('.settings-view')).toBeVisible();
  // Clicking the current destination again must not push a second entry.
  await page.click('#nav-settings');
  await page.waitForTimeout(200);
  await expect(page.locator('.settings-view')).toBeVisible();

  await page.goBack();
  await expect(page.locator('.home-view')).toBeVisible();
});
