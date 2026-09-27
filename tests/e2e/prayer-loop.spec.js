import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await page.click('#btn-start');
  await expect(page.locator('.prayer-view')).toBeVisible();
});

test('renders a full rosary loop with 62 addressable beads', async ({ page }) => {
  const svg = page.locator('svg.rosary');
  await expect(svg).toHaveCount(1);

  const count = await page.locator('svg.rosary [data-bead]').count();
  expect(count).toBe(62);

  // Decorative: never exposed to assistive technology.
  await expect(page.locator('.rosary-panel')).toHaveAttribute('aria-hidden', 'true');
});

test('the pendant runs Cross -> 1 bead -> 3 beads -> 1 bead -> Emblem', async ({ page }) => {
  const cys = await page.evaluate(() => {
    const svg = document.querySelector('svg.rosary');
    const cy = (id) => parseFloat(svg.querySelector(`[data-bead="${id}"]`).getAttribute('cy'));
    const crossRect = svg.querySelector('[data-bead="crucifix"] rect');
    const cross = parseFloat(crossRect.getAttribute('y')) + parseFloat(crossRect.getAttribute('height')) / 2;
    return {
      cross,
      pater1: cy('pater-1'),
      intro1: cy('intro-1'),
      intro2: cy('intro-2'),
      intro3: cy('intro-3'),
      pater2: cy('pater-2'),
      medal: cy('medal'),
    };
  });

  // Cross is lowest; the medallion is highest. Reading upwards from the cross:
  // 1 large bead, 3 small beads together, then 1 large bead, then the medallion.
  expect(cys.cross).toBeGreaterThan(cys.pater1);
  expect(cys.pater1).toBeGreaterThan(cys.intro1);
  expect(cys.intro1).toBeGreaterThan(cys.intro2);
  expect(cys.intro2).toBeGreaterThan(cys.intro3);
  expect(cys.intro3).toBeGreaterThan(cys.pater2);
  expect(cys.pater2).toBeGreaterThan(cys.medal);
});

test('Scripture readings contain no bracket characters', async ({ page }) => {
  // Step 10 is the first decade's reading (7 opening + announcement + reading).
  for (let i = 0; i < 10; i++) {
    await page.click('#btn-next');
  }
  const body = await page.textContent('#step-body');
  expect(body).not.toMatch(/[\[\]()]/);
  expect(body.length).toBeGreaterThan(40);
});

test('the session has 86 steps and the first opening Fatima appears at step 8', async ({ page }) => {
  await expect(page.locator('#step-total')).toHaveText('86');

  for (let i = 0; i < 7; i++) {
    await page.click('#btn-next');
  }
  await expect(page.locator('#step-current')).toHaveText('8');
  await expect(page.locator('#step-title')).toHaveText('Fatimabönen');
});

test('the Creed and Our Father are rendered as multiple paragraphs', async ({ page }) => {
  await page.click('#btn-next'); // step 2: Trosbekännelsen
  await expect(page.locator('#step-title')).toHaveText('Trosbekännelsen');
  expect(await page.locator('#step-body').evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-line');
  expect((await page.textContent('#step-body')).split('\n\n').length).toBeGreaterThanOrEqual(3);

  await page.click('#btn-next'); // step 3: Fader Vår
  await expect(page.locator('#step-title')).toHaveText('Fader Vår');
  expect((await page.textContent('#step-body')).split('\n\n').length).toBeGreaterThanOrEqual(3);
});

test('the Sign of the Cross shows an inline decorative cross', async ({ page }) => {
  const mark = page.locator('#step-body svg.cross-mark');
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#step-body svg.cross-mark path')).toHaveCount(1);

  // It must sit inline on the first line, not on its own row.
  const layout = await page.evaluate(() => {
    const body = document.querySelector('#step-body');
    const svg = body.querySelector('svg.cross-mark');
    const lineHeight = parseFloat(getComputedStyle(body).lineHeight);
    return {
      offset: svg.getBoundingClientRect().top - body.getBoundingClientRect().top,
      lineHeight,
      text: body.textContent,
    };
  });
  expect(layout.offset).toBeLessThan(layout.lineHeight);
  expect(layout.text).toContain('I Faderns och Sonens och den Helige Andens namn.');

  await page.click('#btn-next');
  await expect(page.locator('#step-body svg.cross-mark')).toHaveCount(0);
});

test('the Jesus Prayer is prayed in full on the intro beads', async ({ page }) => {
  await page.click('#btn-exit');
  await page.locator('label.segmented__option:has(input[value="jesuBoen"])').click();
  await page.click('#btn-start');

  for (let i = 0; i < 3; i++) {
    await page.click('#btn-next');
  }
  await expect(page.locator('#step-current')).toHaveText('4');
  await expect(page.locator('#step-title')).toHaveText('Jesusbönen');
  await expect(page.locator('#step-body')).toHaveText(
    'Herre Jesus Kristus, Guds son, förbarma dig över mig, syndare.',
  );
});

test('the correct bead is highlighted for a decade bead step', async ({ page }) => {
  // index 11 is decade-0-bead-1 (7 opening + announcement + reading + Our Father = 11)
  for (let i = 0; i < 11; i++) {
    await page.click('#btn-next');
  }
  await expect(page.locator('#step-current')).toHaveText('12');

  const active = page.locator('svg.rosary .bead.is-active');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute('data-bead', 'decade-0-bead-1');
});

test('the final step becomes Avsluta, focuses the heading, and exits to home', async ({ page }) => {
  await page.evaluate(() => {
    const total = document.querySelector('#step-total').textContent;
    for (let i = 0; i < 200; i++) {
      if (document.querySelector('#step-current')?.textContent === total) break;
      document.querySelector('#btn-next')?.click();
    }
  });

  await expect(page.locator('#step-current')).toHaveText('86');
  await expect(page.locator('#btn-next')).toHaveText('Avsluta');
  await expect(page.locator('#step-title')).toBeFocused();

  // Only one exit control must be present at the last step.
  await expect(page.locator('#btn-exit')).toBeHidden();

  await page.click('#btn-next');
  await expect(page.locator('.home-view')).toBeVisible();
});

test('no nav item is marked current while praying', async ({ page }) => {
  await expect(page.locator('nav button[aria-current="page"]')).toHaveCount(0);
  await page.click('#nav-home');
  await expect(page.locator('#nav-home')).toHaveAttribute('aria-current', 'page');
});

test('arrow keys navigate without double-activating', async ({ page }) => {
  await expect(page.locator('#step-current')).toHaveText('1');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#step-current')).toHaveText('2');

  await page.locator('#btn-next').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#step-current')).toHaveText('3');
});
