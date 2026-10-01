import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveProgress, loadProgress, clearProgress } from '../../src/prayer/session-progress.js';

const KEY = 'luthers-rosenkrans-session';

const VALID = {
  index: 12,
  prayerChoice: 'aveMaria',
  mysterySetId: 'lysande',
  date: '2026-10-01',
};

/** Minimal in-memory Storage stub. */
function makeStorage({ throwOnSet = false, throwOnGet = false } = {}) {
  const map = new Map();
  return {
    getItem(k) {
      if (throwOnGet) throw new Error('SecurityError');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
    raw: (k) => map.get(k),
    has: (k) => map.has(k),
  };
}

// `= undefined` (not delete) so the `typeof` guard in the module reads it as
// absent regardless of whether this Node build ships a global localStorage.
afterEach(() => { globalThis.localStorage = undefined; });

test('round-trips a valid session and returns a fresh, shaped object', () => {
  const store = makeStorage();
  globalThis.localStorage = store;

  assert.equal(saveProgress(VALID), true);
  assert.equal(store.has(KEY), true, 'payload is written');

  const loaded = loadProgress();
  assert.deepEqual(loaded, VALID);
  assert.notEqual(loaded, VALID, 'returns a copy, not the same reference');
});

test('returns null when nothing is stored', () => {
  globalThis.localStorage = makeStorage();
  assert.equal(loadProgress(), null);
});

test('saveProgress rejects malformed payloads without writing', () => {
  const store = makeStorage();
  globalThis.localStorage = store;

  const bad = [
    null,
    undefined,
    'string',
    42,
    [],                                        // array, not object
    { ...VALID, index: 1.5 },                  // non-integer
    { ...VALID, index: -1 },                   // negative
    { ...VALID, index: '3' },                  // wrong type
    { ...VALID, prayerChoice: 'hailMary' },    // unknown choice
    { ...VALID, mysterySetId: 'not-a-set' },   // unknown set
    { ...VALID, date: '01-10-2026' },          // wrong date format
    { ...VALID, date: '2026-10-01T00:00:00Z' },// not a bare ISO date
    { ...VALID, date: 20261001 },              // wrong type
    { index: 1, prayerChoice: 'aveMaria' },    // partial
  ];

  for (const payload of bad) {
    assert.equal(saveProgress(payload), false, `should reject: ${JSON.stringify(payload)}`);
  }
  assert.equal(store.has(KEY), false, 'nothing may be written');
  assert.equal(loadProgress(), null);
});

test('hostile stored JSON is cleared, not trusted', () => {
  const cases = [
    '{not json',
    '"a string"',
    'null',
    '[1,2,3]',
    '{"index":1}',                                     // partial
    JSON.stringify({ ...VALID, mysterySetId: 'evil' }), // unknown set id
    JSON.stringify({ ...VALID, index: -5 }),
    JSON.stringify({ ...VALID, prayerChoice: 'x' }),
    JSON.stringify({ ...VALID, date: 'nope' }),
  ];

  for (const stored of cases) {
    const store = makeStorage();
    store.setItem(KEY, stored);
    globalThis.localStorage = store;

    assert.equal(loadProgress(), null, `should reject stored value: ${stored}`);
    assert.equal(store.has(KEY), false, 'invalid entry must be cleared');
  }
});

test('extra stored keys are not passed through', () => {
  const store = makeStorage();
  store.setItem(KEY, JSON.stringify({ ...VALID, injected: '<img onerror=alert(1)>' }));
  globalThis.localStorage = store;

  const loaded = loadProgress();
  assert.deepEqual(Object.keys(loaded).sort(), ['date', 'index', 'mysterySetId', 'prayerChoice']);
  assert.equal('injected' in loaded, false);
});

test('clearProgress removes the entry and is safe to call twice', () => {
  const store = makeStorage();
  globalThis.localStorage = store;
  saveProgress(VALID);
  clearProgress();
  assert.equal(store.has(KEY), false);
  clearProgress(); // idempotent
  assert.equal(loadProgress(), null);
});

test('never throws when storage itself throws', () => {
  globalThis.localStorage = makeStorage({ throwOnSet: true });
  assert.equal(saveProgress(VALID), false);
  assert.equal(loadProgress(), null);

  globalThis.localStorage = makeStorage({ throwOnGet: true });
  assert.equal(loadProgress(), null);
  assert.doesNotThrow(() => clearProgress());
});

test('degrades silently when no storage exists (Node / hardened browser)', () => {
  globalThis.localStorage = undefined;
  assert.equal(saveProgress(VALID), false);
  assert.equal(loadProgress(), null);
  assert.doesNotThrow(() => clearProgress());
});
