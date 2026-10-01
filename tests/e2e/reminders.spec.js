import { test, expect } from '@playwright/test';

const KEY = 'luthers-rosenkrans-settings';

/**
 * Step 5: every reminder mutation must persist AND immediately rebuild the
 * scheduler's timers (scheduleReminders()). A throw here would surface as an
 * uncaught error, which is what these tests watch for.
 *
 * `errors` is captured before navigation so bootstrap-time failures are caught too.
 *
 * No `addInitScript` storage clearing: Playwright gives each test a fresh
 * browser context (empty localStorage), and an init script would re-run on
 * reload() and wipe state the reload test just wrote.
 *
 * `KEY` is passed into evaluate() as an argument — module scope is not visible
 * inside the page.
 */
const readSettings = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

test.describe('reminder settings', () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    await page.goto('/');
    await page.click('#nav-settings');
    await expect(page.locator('.settings-view')).toBeVisible();
  });

  test('the shipped defaults are an evening reminder at 19:30', async ({ page }) => {
    await expect(page.locator('#reminder-evening')).toBeChecked();
    await expect(page.locator('#time-evening')).toHaveValue('19:30');
    await expect(page.locator('#reminder-morning')).not.toBeChecked();
    // A disabled slot's time input is disabled too.
    await expect(page.locator('#time-morning')).toBeDisabled();

    // Defaults are computed by getDefaultSettings(), not written to storage —
    // loadSettings() never persists, only user interaction does.
    const stored = await readSettings(page);
    expect(stored).toBeNull();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('enabling a slot persists and reschedules without throwing', async ({ page }) => {
    await page.locator('label.switch:has(#reminder-morning)').click();
    await expect(page.locator('#reminder-morning')).toBeChecked();
    // Enabling an empty slot falls back to 19:30 rather than firing at midnight.
    await expect(page.locator('#time-morning')).toHaveValue('19:30');
    await expect(page.locator('#time-morning')).toBeEnabled();

    const stored = await readSettings(page);
    expect(stored.reminders.morning.enabled).toBe(true);
    expect(stored.reminders.morning.time).toBe('19:30');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('disabling a slot persists', async ({ page }) => {
    await page.locator('label.switch:has(#reminder-evening)').click();
    await expect(page.locator('#reminder-evening')).not.toBeChecked();

    const stored = await readSettings(page);
    expect(stored.reminders.evening.enabled).toBe(false);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('changing a time persists and reschedules without throwing', async ({ page }) => {
    await page.locator('label.switch:has(#reminder-morning)').click();
    await page.locator('#time-morning').fill('07:15');
    // `change` fires on commit; the native time input needs a real change event.
    await page.locator('#time-morning').dispatchEvent('change');

    const stored = await readSettings(page);
    expect(stored.reminders.morning.time).toBe('07:15');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('settings survive a reload (the scheduler re-reads them at boot)', async ({ page }) => {
    await page.locator('label.switch:has(#reminder-morning)').click();
    await page.locator('#time-morning').fill('06:45');
    await page.locator('#time-morning').dispatchEvent('change');

    await page.reload();
    await page.click('#nav-settings');
    await expect(page.locator('.settings-view')).toBeVisible();
    await expect(page.locator('#reminder-morning')).toBeChecked();
    await expect(page.locator('#time-morning')).toHaveValue('06:45');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
