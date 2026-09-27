#!/usr/bin/env node
/**
 * Generate the PWA app icons from an inline SVG (no image dependencies).
 *
 * Renders the cross pattée mark used by the app on the liturgical green
 * background, at the sizes the Web App Manifest requires, and writes them to
 * public/icons/. The maskable variant keeps the mark inside the 80 % safe zone.
 *
 * Usage: npm run icons
 */

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/icons');

const BACKGROUND = '#2D6246'; // liturgical green (ordinary time)
const FOREGROUND = '#FBF8EF'; // warm cream (app background token)
const CROSS_PATH =
  'M7.5 1 H16.5 L13.5 10.5 L23 7.5 V16.5 L13.5 13.5 L16.5 23 H7.5 L10.5 13.5 L1 16.5 V7.5 L10.5 10.5 Z';

const svg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-12 -12)">
    <path d="${CROSS_PATH}" fill="${FOREGROUND}"/>
  </g>
</svg>`;

const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 15.5 },
  { file: 'icon-512.png', size: 512, scale: 15.5 },
  { file: 'icon-maskable-512.png', size: 512, scale: 13.2 },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const target of TARGETS) {
  await page.setViewportSize({ width: target.size, height: target.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg(target.scale)}</body></html>`,
    { waitUntil: 'load' },
  );
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(resolve(OUT_DIR, target.file), png);
  console.log(`${target.file} -> ${target.size}x${target.size} (${png.length} bytes)`);
}

await browser.close();
console.log('Icons written to public/icons/.');
