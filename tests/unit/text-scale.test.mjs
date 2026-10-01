import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_SCALES, isValidTextScale, applyTextScale } from '../../src/ui/text-scale.js';
import { loadSettings, getStorageNotice } from '../../src/ui/home-view.js';

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

afterEach(() => {
  setGlobal('document', undefined);
  setGlobal('localStorage', undefined);
});

// ── text-scale ──

test('only the three supported scales are valid', () => {
  assert.deepEqual(TEXT_SCALES, [1, 1.25, 1.5]);
  for (const good of [1, 1.25, 1.5]) {
    assert.equal(isValidTextScale(good), true, String(good));
  }
  for (const bad of [0, 0.5, 2, 3, '1', '1.25', null, undefined, NaN, {}, []]) {
    assert.equal(isValidTextScale(bad), false, JSON.stringify(bad));
  }
});

test('applyTextScale writes a whole-number percentage to the root', () => {
  const root = { style: {} };
  setGlobal('document', { documentElement: root });

  applyTextScale(1);
  assert.equal(root.style.fontSize, '100%');
  applyTextScale(1.25);
  assert.equal(root.style.fontSize, '125%');
  applyTextScale(1.5);
  assert.equal(root.style.fontSize, '150%');
});

test('an unsupported scale falls back to 100% rather than breaking the page', () => {
  const root = { style: {} };
  setGlobal('document', { documentElement: root });

  applyTextScale(99);
  assert.equal(root.style.fontSize, '100%');
  applyTextScale(undefined);
  assert.equal(root.style.fontSize, '100%');
});

test('applyTextScale is a no-op without a document', () => {
  setGlobal('document', undefined);
  assert.doesNotThrow(() => applyTextScale(1.5));
});

// ── settings schema ──

function storeSettings(value) {
  const data = value === undefined ? null : JSON.stringify(value);
  setGlobal('localStorage', {
    getItem: () => data,
    setItem: () => {},
    removeItem: () => {},
  });
}

test('a stored v2 blob (no textScale) loads at 100% with no reset notice', () => {
  storeSettings({
    version: 2,
    mysterySetId: 'lysande',
    mysterySetDate: '',
    prayerChoice: 'aveMaria',
    reminders: {
      morning: { enabled: false, time: '' },
      noon: { enabled: false, time: '' },
      evening: { enabled: true, time: '19:30' },
      night: { enabled: false, time: '' },
    },
  });

  const settings = loadSettings();
  assert.equal(settings.textScale, 1, 'missing field falls back to the default');
  assert.equal(settings.version, 3, 'defaults carry the current version');
  assert.equal(
    getStorageNotice(),
    null,
    'an additive field must NOT trigger the "settings were reset" notice',
  );
});

test('a stored valid textScale is honoured', () => {
  storeSettings({ version: 3, prayerChoice: 'jesuBoen', textScale: 1.5 });
  assert.equal(loadSettings().textScale, 1.5);
  assert.equal(getStorageNotice(), null);
});

test('an unsupported stored textScale falls back silently', () => {
  storeSettings({ version: 3, textScale: 3 });
  const settings = loadSettings();
  assert.equal(settings.textScale, 1);
  assert.equal(
    getStorageNotice(),
    null,
    'a bogus scale is not worth telling the user their settings were reset',
  );
});

test('defaults include textScale', () => {
  assert.equal(loadSettingsEmpty().textScale, 1);
});

/** Load with no stored settings at all. */
function loadSettingsEmpty() {
  storeSettings(undefined);
  return loadSettings();
}
