import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setWakeLockWanted,
  initWakeLockReacquire,
  isWakeLockSupported,
  isWakeLockHeld,
} from '../../src/prayer/wake-lock.js';

/** Replace a global that may be a getter-only accessor in this Node build. */
function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function makeLockStub() {
  const listeners = {};
  return {
    released: false,
    releaseCount: 0,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    async release() {
      this.released = true;
      this.releaseCount += 1;
      (listeners.release || []).forEach((fn) => fn());
    },
  };
}

/** Install a fake navigator.wakeLock and return the request recorder. */
function stubWakeLock({ fail = false } = {}) {
  const calls = [];
  const locks = [];
  setGlobal('navigator', {
    wakeLock: {
      async request(type) {
        calls.push(type);
        if (fail) {
          const err = new Error('Permission denied');
          err.name = 'NotAllowedError';
          throw err;
        }
        const lock = makeLockStub();
        locks.push(lock);
        return lock;
      },
    },
  });
  return { calls, locks };
}

function stubDocument(visibilityState = 'visible') {
  const listeners = {};
  setGlobal('document', {
    visibilityState,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    _fire: (type) => (listeners[type] || []).forEach((fn) => fn()),
  });
  return globalThis.document;
}

afterEach(async () => {
  await setWakeLockWanted(false);
  delete globalThis.navigator;
  delete globalThis.document;
});

test('reports unsupported when the API is absent', () => {
  setGlobal('navigator', {});
  assert.equal(isWakeLockSupported(), false);
});

test('acquires only while wanted, and releases on demand', async () => {
  stubDocument('visible');
  const { calls, locks } = stubWakeLock();
  assert.equal(isWakeLockSupported(), true);

  await setWakeLockWanted(true);
  assert.deepEqual(calls, ['screen'], 'requests exactly once, for "screen"');
  assert.equal(isWakeLockHeld(), true);

  // A second request must not be issued while one is held.
  await setWakeLockWanted(true);
  assert.equal(calls.length, 1);

  await setWakeLockWanted(false);
  assert.equal(isWakeLockHeld(), false);
  assert.equal(locks[0].released, true);
});

test('never acquires when the document is hidden', async () => {
  stubDocument('hidden');
  stubWakeLock();

  await setWakeLockWanted(true);
  assert.equal(isWakeLockHeld(), false);
});

test('degrades silently when the API is absent', async () => {
  stubDocument('visible');
  setGlobal('navigator', {});

  await assert.doesNotReject(() => setWakeLockWanted(true));
  assert.equal(isWakeLockHeld(), false);
});

test('degrades silently when the OS refuses (NotAllowedError)', async () => {
  stubDocument('visible');
  stubWakeLock({ fail: true });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await assert.doesNotReject(() => setWakeLockWanted(true));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(isWakeLockHeld(), false);
});

test('re-acquires after returning to the foreground', async () => {
  const doc = stubDocument('hidden');
  const { calls } = stubWakeLock();
  initWakeLockReacquire();

  // Wants it, but the document is hidden → nothing to acquire.
  await setWakeLockWanted(true);
  assert.equal(calls.length, 0);

  doc.visibilityState = 'visible';
  doc._fire('visibilitychange');
  await new Promise((r) => setImmediate(r)); // let the async acquire settle

  assert.equal(calls.length, 1);
  assert.equal(isWakeLockHeld(), true);
});

test('does not re-acquire when no session wants it', async () => {
  const doc = stubDocument('visible');
  const { calls } = stubWakeLock();
  initWakeLockReacquire();

  doc._fire('visibilitychange');
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.length, 0, 'nothing is wanted, so nothing is requested');
});

test('initWakeLockReacquire is a no-op without a document', () => {
  delete globalThis.document;
  assert.doesNotThrow(() => initWakeLockReacquire());
});
