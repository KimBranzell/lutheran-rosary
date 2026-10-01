/**
 * Service worker for Luthers Rosenkrans.
 * Uses Workbox InjectManifest for precaching and offline support.
 */

import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';

// Drop precaches left behind by older Workbox versions. Precache *entries* from
// the previous app release are already pruned by PrecacheController.activate on
// activate; this covers a change to the cache name itself.
cleanupOutdatedCaches();

// Precache every asset injected by webpack.
//
// This registers a PrecacheRoute first, and that route already matches '/'
// (via directoryIndex: 'index.html') and every precached font — which is exactly
// why the previous NetworkFirst navigation route and CacheFirst font route were
// unreachable. They were removed rather than left as dead code that implied
// behaviour the app does not have.
precacheAndRoute(self.__WB_MANIFEST);

// Navigations the precache cannot answer (an unknown path) go to the network,
// and fall back to the branded offline page when it is unreachable.
//
// This has to be a registered NavigationRoute, not just a catch handler:
// Workbox's Router returns *without responding* when no route matches at all,
// so `setCatchHandler` alone never fires for an unknown URL. Registered after
// `precacheAndRoute`, so '/' still resolves from the precache first.
registerRoute(
  new NavigationRoute(async ({ request }) => {
    try {
      return await fetch(request);
    } catch {
      return (await matchPrecache('/offline.html')) || Response.error();
    }
  }),
);

// Last resort when a route that *did* match fails to respond (e.g. a
// corrupted precache entry).
setCatchHandler(async ({ request }) => {
  if (request.mode !== 'navigate') return Response.error();
  return (await matchPrecache('/offline.html')) || Response.error();
});

/**
 * Focus an app window if one is open, otherwise open one.
 *
 * @param {string} target path + hash, e.g. '/' or '/#prayer'
 */
async function openOrFocus(target) {
  // Built from a relative target with the URL constructor — never string
  // concatenation — and guarded on origin, so a surprising value cannot produce
  // an off-origin navigation.
  const url = new URL(target, self.location.origin);
  if (url.origin !== self.location.origin) return;

  const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const exact = openClients.find((client) => client.url === url.href);
  const sameOrigin = openClients.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  const chosen = exact || sameOrigin;
  if (chosen) {
    await chosen.focus();
    // An already-open app may be on a different view; walk it to the target.
    if (!exact && typeof chosen.navigate === 'function') {
      try {
        await chosen.navigate(url.href);
      } catch {
        // Focusing alone is an acceptable outcome.
      }
    }
    return;
  }

  if (self.clients.openWindow) {
    await self.clients.openWindow(url.href);
  }
}

/**
 * Ask any open window to repeat this reminder later.
 *
 * Best-effort: a service worker cannot reliably hold a 10-minute timer, so this
 * only does anything while a window is open. Documented in README "Påminnelser".
 *
 * @param {Notification} notification
 */
async function requestSnooze(notification) {
  const data = (notification && notification.data) || {};
  const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const message = {
    type: 'REMINDER_SNOOZE',
    minutes: 10,
    slot: data.slot || 'evening',
  };
  await Promise.all(openClients.map((client) => client.postMessage(message)));
}

self.addEventListener('notificationclick', (event) => {
  // `event.action` is '' when the body itself was clicked, and its value comes
  // from a button the user pressed — branch only on exact literals, never on
  // anything derived from the string.
  const action = event.action;
  const notification = event.notification;
  notification.close();

  if (action === 'later') {
    event.waitUntil(requestSnooze(notification));
    return;
  }

  event.waitUntil(openOrFocus(action === 'open' ? '/#prayer' : '/'));
});

// Skip waiting and claim clients immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
