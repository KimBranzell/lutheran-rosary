import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { showNotification } from '../../src/notifications/reminder-scheduler.js';

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

let captured = null;

/** Install browser-ish globals and capture whatever showNotification sends. */
function stub({ permission = 'granted', swReadyRejects = false } = {}) {
  captured = null;
  // In a browser `window` IS the global, so `window.Notification` exists whenever
  // the `Notification` global does — mirror that or the guard always fails.
  const notificationApi = { permission };
  setGlobal('Notification', notificationApi);
  setGlobal('window', { Notification: notificationApi });
  setGlobal('navigator', {
    serviceWorker: {
      ready: swReadyRejects
        ? Promise.reject(new Error('no service worker'))
        : Promise.resolve({
            async showNotification(title, options) {
              captured = { title, options };
            },
          }),
    },
  });
}

afterEach(() => {
  setGlobal('window', undefined);
  setGlobal('Notification', undefined);
  setGlobal('navigator', undefined);
});

test('sends exactly two actions, opening the session by default', async () => {
  stub();
  assert.equal(await showNotification('evening'), true);

  assert.ok(captured, 'a notification was shown');
  assert.equal(captured.title, 'Tid för bön');
  assert.deepEqual(
    captured.options.actions,
    [
      { action: 'open', title: 'Be rosenkransen' },
      { action: 'later', title: 'Påminn senare' },
    ],
    'the plan requires exactly these two actions',
  );
  assert.equal(captured.options.data.slot, 'evening');
  assert.equal(captured.options.tag, 'rosary-reminder');
});

test('the body names the slot that fired', async () => {
  const expected = {
    morning: 'Morgon',
    noon: 'Middag',
    evening: 'Kväll',
    night: 'Natt',
  };

  for (const [slot, label] of Object.entries(expected)) {
    stub();
    await showNotification(slot);
    assert.equal(
      captured.options.body,
      `${label} — ta en stund för rosenkransen.`,
      `slot ${slot}`,
    );
  }
});

test('an unknown slot falls back to the evening label rather than leaking', async () => {
  stub();
  await showNotification('__proto__');
  assert.equal(captured.options.body, 'Kväll — ta en stund för rosenkransen.');
  assert.equal(captured.options.data.slot, 'evening');
});

test('does nothing without notification permission', async () => {
  for (const permission of ['default', 'denied']) {
    stub({ permission });
    assert.equal(await showNotification('evening'), false, permission);
    assert.equal(captured, null, 'nothing may be sent');
  }
});

test('degrades silently when there is no window (SSR / worker context)', async () => {
  setGlobal('window', undefined);
  setGlobal('Notification', { permission: 'granted' });
  setGlobal('navigator', undefined);

  assert.equal(await showNotification('evening'), false);
});

test('returns false instead of throwing when the service worker is unavailable', async () => {
  stub({ swReadyRejects: true });
  assert.equal(await showNotification('evening'), false);
});
