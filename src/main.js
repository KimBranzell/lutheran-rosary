/**
 * Luthers Rosenkrans — main entry point.
 * Registers the service worker and bootstraps the application router.
 */

import './styles/main.scss';
import './fonts/fraunces-latin-standard-normal.woff2';
import './fonts/fraunces-latin-standard-italic.woff2';
import './fonts/alegreya-sans-latin-400-normal.woff2';
import './fonts/alegreya-sans-latin-500-normal.woff2';
import './fonts/alegreya-sans-latin-700-normal.woff2';
import { renderHomeView, loadSettings } from './ui/home-view.js';
import { renderPrayerView } from './ui/prayer-view.js';
import { renderSettingsView } from './ui/settings-view.js';
import { getAttributionHtml } from './data/licensing.js';
import { initReminders } from './notifications/reminder-scheduler.js';
import { getCurrentObservance } from './calendar/liturgical-calendar.js';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('Service worker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

let currentView = 'home';
let settings = loadSettings();
let scriptureData = null;

async function loadScriptureData() {
  try {
    const resp = await fetch('/scripture-passages.json');
    if (!resp.ok) return;
    const parsed = await resp.json();
    // Guard the views against a malformed cached asset.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      scriptureData = parsed;
    }
  } catch {
    console.warn('Could not load scripture data');
  }
}

const VIEW_TITLES = {
  home: 'Luthers Rosenkrans',
  prayer: 'Rosenkransen — Luthers Rosenkrans',
  settings: 'Inställningar — Luthers Rosenkrans',
  sources: 'Källor och licenser — Luthers Rosenkrans',
};

// Router
function navigate(view, { manageFocus = true } = {}) {
  currentView = view;
  const app = document.getElementById('app');

  document.title = VIEW_TITLES[view] || VIEW_TITLES.home;

  // Update nav aria-current only for real nav destinations (prayer is not one).
  const NAV_FOR_VIEW = { home: 'home', settings: 'settings', sources: 'sources' };
  document.querySelectorAll('nav button').forEach(btn => {
    btn.removeAttribute('aria-current');
  });
  const navId = NAV_FOR_VIEW[view];
  const navBtn = navId ? document.querySelector(`#nav-${navId}`) : null;
  if (navBtn) navBtn.setAttribute('aria-current', 'page');

  switch (view) {
    case 'home':
      renderHomeView(app, settings, startPrayer, () => navigate('settings'), scriptureData);
      break;
    case 'prayer':
      if (scriptureData) {
        renderPrayerView(app, settings, scriptureData, () => navigate('home'));
      }
      break;
    case 'settings':
      renderSettingsView(app, () => navigate('home'));
      break;
    case 'sources':
      app.innerHTML = `
        <section class="sources-view" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Källor och licenser</h2>
          ${getAttributionHtml()}
          <button id="btn-back-sources" class="btn btn--primary" type="button">Tillbaka</button>
        </section>
      `;
      app.querySelector('#btn-back-sources').addEventListener('click', () => navigate('home'));
      break;
  }

  // Move focus to the new view's heading so keyboard/screen-reader users keep
  // their place (WCAG 2.4.3). The bootstrap call opts out.
  if (manageFocus) {
    const heading = app.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }
}

function startPrayer(settings) {
  navigate('prayer');
}

// Update the liturgical theme, the named season and the specific church-year day.
// The day name is always the most recent observance, so on a weekday it names the
// Sunday (or feast) of the week you are in.
function updateTheme() {
  const observance = getCurrentObservance();
  document.body.dataset.liturgicalColor = observance.color;

  const seasonEl = document.getElementById('season-name');
  if (seasonEl) seasonEl.textContent = observance.season;

  const dayEl = document.getElementById('observance-name');
  if (dayEl) dayEl.textContent = observance.name;

  // Let the browser/PWA chrome follow the liturgical colour. In an installed app
  // and a TWA this tints the surrounding UI; the TWA's own bar colours are baked
  // into the APK and cannot change, so the app paints its background instead.
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    const primary = getComputedStyle(document.body).getPropertyValue('--color-primary').trim();
    if (primary) themeColor.setAttribute('content', primary);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  await loadScriptureData();
  updateTheme();

  // Initialize reminder system
  initReminders();

  // Nav buttons
  document.getElementById('nav-home').addEventListener('click', () => navigate('home'));
  document.getElementById('nav-settings').addEventListener('click', () => navigate('settings'));
  document.getElementById('nav-sources').addEventListener('click', () => navigate('sources'));

  // Re-check the theme when the app resumes and when the local date rolls over
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateTheme();
  });
  let lastDay = new Date().toDateString();
  setInterval(() => {
    const today = new Date().toDateString();
    if (today !== lastDay) {
      lastDay = today;
      updateTheme();
    }
  }, 60_000);

  navigate('home', { manageFocus: false });
});
