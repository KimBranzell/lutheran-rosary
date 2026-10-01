import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFromLocation, hashForView, HASH_FOR_VIEW } from '../../src/router.js';

test('every view resolves from its own hash', () => {
  assert.equal(routeFromLocation(''), 'home');
  assert.equal(routeFromLocation('#'), 'home');
  assert.equal(routeFromLocation('#prayer'), 'prayer');
  assert.equal(routeFromLocation('#settings'), 'settings');
  assert.equal(routeFromLocation('#sources'), 'sources');
});

test('unknown hashes collapse to home rather than a blank screen', () => {
  assert.equal(routeFromLocation('#bogus'), 'home');
  assert.equal(routeFromLocation('#Prayer'), 'home', 'route ids are case-sensitive');
  assert.equal(routeFromLocation('/settings'), 'home');
  assert.equal(routeFromLocation('nonsense'), 'home');
  assert.equal(routeFromLocation('#prayer/extra'), 'home');
});

test('hostile fragments cannot resolve to inherited properties', () => {
  // These would be truthy on a plain object lookup — the reason VIEW_FOR_HASH
  // is a Map.
  assert.equal(routeFromLocation('#__proto__'), 'home');
  assert.equal(routeFromLocation('#constructor'), 'home');
  assert.equal(routeFromLocation('#toString'), 'home');
  assert.equal(routeFromLocation('#hasOwnProperty'), 'home');
});

test('hashForView maps only known views', () => {
  assert.equal(hashForView('home'), '');
  assert.equal(hashForView('prayer'), '#prayer');
  assert.equal(hashForView('settings'), '#settings');
  assert.equal(hashForView('sources'), '#sources');
  assert.equal(hashForView('bogus'), null);
  assert.equal(hashForView('__proto__'), null);
  assert.equal(hashForView('constructor'), null);
  assert.equal(hashForView(undefined), null);
});

test('the route table has exactly the four supported views', () => {
  assert.deepEqual(Object.keys(HASH_FOR_VIEW).sort(), [
    'home', 'prayer', 'settings', 'sources',
  ]);
});

test('hashForView and routeFromLocation round-trip', () => {
  for (const view of Object.keys(HASH_FOR_VIEW)) {
    assert.equal(routeFromLocation(hashForView(view)), view);
  }
});
