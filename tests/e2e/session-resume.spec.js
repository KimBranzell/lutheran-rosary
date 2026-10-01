import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY = 'luthers-rosenkrans-session';

async function advanceTo(page, step) {
  // step is 1-based; start from step 1.
  const clicks = step - 1;
  for (let i = 0; i < clicks; i++) {
    await page.click('#btn-next');
  }
  await expect(page.locator('#step-current')).toHaveText(String(step));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-view')).toBeVisible();
});

test('a fresh install offers no resume, and offers it after an interrupted session', async ({ page }) => {
  await expect(page.locator('#btn-resume')).toHaveCount(0);
  await expect(page.locator('#btn-start')).toHaveText('Börja rosenkransen');

  await page.click('#btn-start');
  await advanceTo(page, 6);
  await page.click('#btn-exit');

  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page.locator('#btn-resume')).toHaveText('Fortsätt på steg 6');
  // The primary action becomes the resume; starting over is now the ghost.
  await expect(page.locator('#btn-start')).toHaveText('Börja om från början');

  await page.click('#btn-resume');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page.locator('#step-current')).toHaveText('6');
});

test('reload mid-session resumes in place rather than restarting', async ({ page }) => {
  await page.click('#btn-start');
  await advanceTo(page, 9);

  // With hash routing the reload lands back on #prayer, so it must resume —
  // restarting at step 1 here would also wipe the saved progress.
  await page.reload();
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page.locator('#step-current')).toHaveText('9');

  // …and the saved position is still intact for the home offer.
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(stored.index).toBe(8);
  expect(stored.prayerChoice).toBe('aveMaria');
  expect(stored.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('returning home mid-session offers the saved position', async ({ page }) => {
  await page.click('#btn-start');
  await advanceTo(page, 4);
  await page.click('#nav-home');

  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page.locator('#btn-resume')).toHaveText('Fortsätt på steg 4');
});

test('finishing the session clears the saved position', async ({ page }) => {
  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();

  await page.evaluate(() => {
    const total = document.querySelector('#step-total').textContent;
    while (document.querySelector('#step-current').textContent !== total) {
      document.querySelector('#btn-next').click();
    }
    document.querySelector('#btn-next').click(); // "Avsluta" on the last step
  });
  await expect(page.locator('.home-view')).toBeVisible();

  await expect(page.locator('#btn-resume')).toHaveCount(0);
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(stored).toBeNull();
});

test('starting over begins at step 1 and discards the saved session', async ({ page }) => {
  await page.click('#btn-start');
  await advanceTo(page, 7);
  await page.click('#btn-exit');
  await expect(page.locator('#btn-resume')).toHaveText('Fortsätt på steg 7');

  await page.click('#btn-start'); // "Börja om från början"
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page.locator('#step-current')).toHaveText('1');

  // Stepping off step 1 immediately drops the stale offer.
  await page.click('#btn-exit');
  await expect(page.locator('#btn-resume')).toHaveCount(0);
});

test('a corrupt saved session is ignored and offers no resume', async ({ page }) => {
  await page.addInitScript((k) => {
    try { localStorage.setItem(k, '{not json'); } catch { /* ignore */ }
  }, KEY);
  await page.goto('/');

  await expect(page.locator('.home-view')).toBeVisible();
  await expect(page.locator('#btn-resume')).toHaveCount(0);
  await expect(page.locator('#btn-start')).toBeVisible();

  // The app is still fully usable.
  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
  await expect(page.locator('#step-current')).toHaveText('1');
});

test('the resume state of the home view has no accessibility violations', async ({ page }) => {
  // The standing a11y suite clears localStorage, so it never scans the home view
  // WITH a resume button. This covers that variant (WCAG 2.2 AA).
  await page.click('#btn-start');
  await advanceTo(page, 6);
  await page.click('#btn-exit');
  await expect(page.locator('#btn-resume')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  // Focus order: resume first, then start-over, then reminders.
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.stack button')].map((b) => b.id),
  );
  expect(order).toEqual(['btn-resume', 'btn-start', 'btn-settings']);
});
