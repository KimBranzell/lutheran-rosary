import { test, expect } from '@playwright/test';

// Weekday (0 = Sunday) -> mystery set id, per the worksheet mapping.
const SET_BY_WEEKDAY = [
  'harrlig', // Sunday
  'gladjefylld', // Monday
  'sorgfull', // Tuesday
  'harrlig', // Wednesday
  'lysande', // Thursday
  'sorgfull', // Friday
  'gladjefylld', // Saturday
];

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

test('each mystery in the preview lists its Scripture reference', async ({ page }) => {
  const refs = page.locator('#preview-list .mystery-preview__ref');
  await expect(refs).toHaveCount(5);

  const texts = await refs.allTextContents();
  for (const text of texts) {
    // Swedish book name plus chapter:verse, not the raw USX code.
    expect(text).toMatch(/^[A-ZÅÄÖ].*\d+:\d+/);
    expect(text).not.toMatch(/^(LUK|MAT|MRK|JHN|ACT|1CO|REV) /);
  }

  // Switching set refreshes the references.
  await page.locator('label.mystery-option:has(input[value="sorgfull"])').click();
  const after = await page.locator('#preview-list .mystery-preview__ref').allTextContents();
  expect(after).not.toEqual(texts);
  expect(after.join(' ')).toContain('Matteusevangeliet');
});

test('preselects the current weekday set and marks it Idag', async ({ page }) => {
  const checked = page.locator('input[name="mystery-set"]:checked');
  await expect(checked).toHaveCount(1);

  const value = await checked.getAttribute('value');
  const today = new Date();
  expect(value).toBe(SET_BY_WEEKDAY[today.getDay()]);

  const card = checked.locator('xpath=ancestor::label');
  await expect(card.locator('.badge--today')).toHaveCount(1);
});

test('the header names both the season and the specific church-year day', async ({ page }) => {
  const season = page.locator('#season-name');
  const day = page.locator('#observance-name');

  await expect(season).toHaveText(/\S/);
  await expect(day).toHaveText(/\S/);

  const dayName = (await day.textContent()).trim();
  expect(dayName.length).toBeGreaterThan(3);
  // Distinct from the season label.
  expect(dayName).not.toBe((await season.textContent()).trim());
});

test('selecting another set updates the preview and persists for today', async ({ page }) => {
  await page.locator('label.mystery-option:has(input[value="lysande"])').click();

  await expect(page.locator('#preview-title')).toHaveText('Lysande');
  await expect(page.locator('input[name="mystery-set"][value="lysande"]')).toBeChecked();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('luthers-rosenkrans-settings')));
  expect(stored.mysterySetId).toBe('lysande');
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  expect(stored.mysterySetDate).toBe(iso);
});

test('prayer choice is a segmented radio group and persists', async ({ page }) => {
  await expect(page.locator('.segmented__option')).toHaveCount(2);
  await page.locator('label.segmented__option:has(input[value="jesuBoen"])').click();
  await expect(page.locator('input[name="prayer-choice"][value="jesuBoen"]')).toBeChecked();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('luthers-rosenkrans-settings')));
  expect(stored.prayerChoice).toBe('jesuBoen');
});

test('corrupt stored settings fall back safely with a Swedish notice', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('luthers-rosenkrans-settings', '{not valid json');
  });
  await page.goto('/');

  const notice = page.locator('#home-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('inställningar');
  // The app is still usable and a valid set is selected.
  await expect(page.locator('input[name="mystery-set"]:checked')).toHaveCount(1);
});
