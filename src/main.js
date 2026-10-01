/**
 * Luthers Rosenkrans — main entry point.
 * Registers the service worker and bootstraps the application router.
 */

import './styles/main.scss';
// Fonts are loaded by the @font-face rules in `styles/_base.scss`, which emit
// the same webpack asset modules — importing them here as well was redundant.
import { renderHomeView, loadSettings } from './ui/home-view.js';
import { renderPrayerView } from './ui/prayer-view.js';
import { renderSettingsView } from './ui/settings-view.js';
import { getAttributionHtml } from './data/licensing.js';
import { initReminders, initSnoozeListener } from './notifications/reminder-scheduler.js';
import { getCurrentObservance } from './calendar/liturgical-calendar.js';
import { routeFromLocation, hashForView, onRouteChange } from './router.js';
import { loadProgress } from './prayer/session-progress.js';
import { initWakeLockReacquire } from './prayer/wake-lock.js';
import { applyTextScale } from './ui/text-scale.js';

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

// Apply the text size before anything renders, while the parser is still ahead
// of the first paint, so there is no visible jump from 100% to the saved scale.
applyTextScale(settings.textScale);

/**
 * Teardown for the view currently on screen.
 *
 * `container` (`<main id="app">`) is never replaced, so a renderer that attaches
 * listeners directly to it must detach them itself. Renderers that return nothing
 * (or return a handle without `destroy`) are simply skipped.
 * @type {null | (() => void)}
 */
let currentDestroy = null;

/**
 * True while the current history entry is a `#prayer` entry this app pushed, so
 * "Avsluta" can pop it (Back) instead of pushing a duplicate home entry.
 * Reset whenever a non-prayer route renders.
 */
let pushedPrayer = false;

/**
 * Step index for the next session.
 *
 * `null` means "auto" — resume whatever is saved, which is what a reload or
 * Back into `#prayer` should do. Only `startPrayer()` sets it explicitly
 * (0 = "Börja om från början"), and the prayer view consumes it back to null.
 */
let pendingStartIndex = null;

/** Extract a renderer's `destroy()` if it returned one. */
function asDestroy(result) {
  return typeof result?.destroy === 'function' ? result.destroy : null;
}

/**
 * Handle for the home view currently on screen, or null when another view is up.
 * Kept separately from `currentDestroy` because the home view exposes `refresh`
 * rather than `destroy`.
 * @type {null | { refresh?: (data: object) => void }}
 */
let homeHandle = null;

/**
 * Upgrade the home preview once scripture data has loaded, without re-rendering.
 * Safe to call at any time: it is a no-op unless the home view is on screen and
 * data actually arrived.
 */
function refreshHomeIfVisible() {
  if (currentView !== 'home' || !scriptureData) return;
  if (typeof homeHandle?.refresh === 'function') homeHandle.refresh(scriptureData);
}

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
  // Single call site: covers bootstrap, the error-view retry, and any future caller.
  refreshHomeIfVisible();
}

const VIEW_TITLES = {
  home: 'Luthers Rosenkrans',
  prayer: 'Rosenkransen — Luthers Rosenkrans',
  settings: 'Inställningar — Luthers Rosenkrans',
  sources: 'Källor och licenser — Luthers Rosenkrans',
  // Rendered in place of the prayer view when the scripture asset is missing.
  // Deliberately has no NAV_FOR_VIEW entry, so no nav item claims aria-current.
  'scripture-error': 'Bibeltexten saknas — Luthers Rosenkrans',
};

/**
 * Shown instead of the prayer view when `scripture-passages.json` could not be
 * loaded. Without this the router changed `document.title` and moved focus while
 * rendering nothing — an invisible failure with a misleading title.
 */
function renderScriptureError(container, onRetry, onBack) {
  container.innerHTML = `
    <section class="scripture-error" aria-labelledby="scripture-error-heading">
      <h2 id="scripture-error-heading">Bibeltexten saknas</h2>
      <p>De utvalda versavsnitten kunde inte laddas. Kontrollera anslutningen och försök igen.</p>
      <div class="stack">
        <button id="btn-retry-scripture" class="btn btn--primary btn--block" type="button">Försök igen</button>
        <button id="btn-scripture-back" class="btn btn--ghost btn--block" type="button">Tillbaka</button>
      </div>
    </section>
  `;
  container.querySelector('#btn-retry-scripture').addEventListener('click', onRetry);
  container.querySelector('#btn-scripture-back').addEventListener('click', onBack);
}

/** Reload the scripture asset and re-enter the prayer view (re-renders the
 *  error view if it fails again). */
async function retryScripture() {
  await loadScriptureData();
  navigate('prayer');
}

// Router
/**
 * Navigate to a view.
 *
 * When `updateHash` is set and the target hash differs, the hash is written and
 * this returns immediately: the `hashchange` listener re-enters with
 * `updateHash: false` and performs the render. That gives Back/Forward and
 * in-app navigation exactly one render path (WCAG 2.4.3 focus handling then runs
 * identically for both).
 *
 * @param {string} view
 * @param {{ manageFocus?: boolean, updateHash?: boolean }} [options]
 */
function navigate(view, { manageFocus = true, updateHash = true } = {}) {
  if (updateHash) {
    const target = hashForView(view);
    if (target !== null && target !== window.location.hash) {
      window.location.hash = target;
      return;
    }
  }

  currentView = view;
  const app = document.getElementById('app');

  // Leaving the prayer route invalidates the "we pushed #prayer" flag, so a
  // stale flag can never fire a spurious history.back() later.
  if (view !== 'prayer') pushedPrayer = false;

  // Detach the outgoing view's container-level listeners before replacing its
  // markup, so no stale handler can run against detached nodes.
  if (typeof currentDestroy === 'function') currentDestroy();
  currentDestroy = null;
  homeHandle = null;

  // Resolved per branch below: `prayer` may render an error variant instead, and
  // the document title must describe what is actually on screen (WCAG 2.4.2).
  let title = VIEW_TITLES[view] || VIEW_TITLES.home;

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
      homeHandle = renderHomeView(
        app,
        settings,
        startPrayer,
        () => navigate('settings'),
        scriptureData,
      );
      currentDestroy = asDestroy(homeHandle);
      break;
    case 'prayer':
      if (scriptureData) {
        // An explicit start (0 = "Börja om") wins; otherwise resume the saved
        // position, which is what a reload or Back into `#prayer` should do.
        const startIndex = pendingStartIndex ?? loadProgress()?.index ?? 0;
        pendingStartIndex = null;
        currentDestroy = asDestroy(
          renderPrayerView(app, settings, scriptureData, exitPrayer, { startIndex }),
        );
      } else {
        // Never a silent no-op: show an actionable error instead.
        title = VIEW_TITLES['scripture-error'];
        renderScriptureError(app, retryScripture, () => navigate('home'));
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

  document.title = title;

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

/** Enter a session from the home view, pushing a `#prayer` history entry. */
function startPrayer(settings, startIndex = 0) {
  pushedPrayer = true;
  pendingStartIndex = Number.isInteger(startIndex) ? startIndex : 0;
  navigate('prayer');
}

/**
 * Leave the session.
 *
 * If we pushed `#prayer` ourselves, pop it with history.back() so Back from the
 * home view does not return to a screen the user just deliberately left. When the
 * user deep-linked straight into `#prayer` there is no entry of ours to pop, so
 * navigate home instead (never history.back() out of the site).
 */
function exitPrayer() {
  if (pushedPrayer && window.history.length > 1) {
    window.history.back();
  } else {
    navigate('home');
  }
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
  updateTheme();

  // Initialize reminder system
  initReminders();

  // Service worker may post a "Påminn senare" request from a notification.
  initSnoozeListener();

  // Re-acquire the screen wake lock when the app returns to the foreground,
  // while a prayer session still wants it.
  initWakeLockReacquire();

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

  // Back/Forward and any external hash edit re-enter navigate() without
  // re-writing the hash; focus then moves to the new view's heading (WCAG 2.4.3).
  onRouteChange((view) => navigate(view, { updateHash: false, manageFocus: true }));

  const initialRoute = routeFromLocation();

  // A deep link straight into a session needs the scripture first — otherwise a
  // cold start would land on the error view instead of the prayer.
  if (initialRoute === 'prayer') {
    await loadScriptureData();
  }

  // Render immediately — first paint must not wait on a network fetch. On any
  // other route the home preview falls back to raw reference codes and is
  // upgraded in place by refreshHomeIfVisible() once the asset resolves.
  navigate(initialRoute, { manageFocus: false, updateHash: false });

  if (initialRoute !== 'prayer') {
    await loadScriptureData();
  }
});
