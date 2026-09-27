import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mysterySets,
  getMysterySetForDay,
  isKnownSetId,
  resolvePreselectedSetId,
} from '../../src/data/mystery-catalog.js';
import { formatWeekdays, weekdayOf } from '../../src/data/weekdays.js';

test('there are exactly four sets with five mysteries each', () => {
  assert.equal(mysterySets.length, 4);
  for (const set of mysterySets) {
    assert.equal(set.mysteries.length, 5, `${set.id} should have five mysteries`);
  }
});

test('set id to weekday mapping matches the worksheet', () => {
  const mapping = Object.fromEntries(mysterySets.map(s => [s.id, s.weekdays]));
  assert.deepEqual(mapping, {
    gladjefylld: [1, 6],
    lysande: [4],
    sorgfull: [2, 5],
    harrlig: [0, 3],
  });
});

test('getMysterySetForDay resolves every weekday', () => {
  assert.equal(getMysterySetForDay(0).id, 'harrlig');   // Sunday
  assert.equal(getMysterySetForDay(1).id, 'gladjefylld'); // Monday
  assert.equal(getMysterySetForDay(2).id, 'sorgfull');  // Tuesday
  assert.equal(getMysterySetForDay(3).id, 'harrlig');   // Wednesday
  assert.equal(getMysterySetForDay(4).id, 'lysande');   // Thursday
  assert.equal(getMysterySetForDay(5).id, 'sorgfull');  // Friday
  assert.equal(getMysterySetForDay(6).id, 'gladjefylld'); // Saturday
});

test('formatWeekdays produces Swedish labels', () => {
  assert.equal(formatWeekdays([1, 6]), 'Måndag & Lördag');
  assert.equal(formatWeekdays([4]), 'Torsdag');
  assert.equal(formatWeekdays([2, 5]), 'Tisdag & Fredag');
  assert.equal(formatWeekdays([0, 3]), 'Söndag & Onsdag');
  assert.equal(formatWeekdays([1, 6], 'short'), 'Mån & Lör');
});

test('weekdayOf is time-zone safe for an ISO date', () => {
  assert.equal(weekdayOf('2026-09-27'), 0); // Sunday
  assert.equal(weekdayOf('2026-09-28'), 1); // Monday
  assert.equal(weekdayOf('2026-10-01'), 4); // Thursday
});

test('a fresh day preselects the current weekday set', () => {
  // 2026-09-27 is a Sunday -> Ärorika
  assert.equal(resolvePreselectedSetId('sorgfull', '2026-09-26', '2026-09-27'), 'harrlig');
  // 2026-09-28 is a Monday -> Glädjerika
  assert.equal(resolvePreselectedSetId('lysande', '2026-09-25', '2026-09-28'), 'gladjefylld');
});

test('a same-day manual override is honoured', () => {
  assert.equal(resolvePreselectedSetId('sorgfull', '2026-09-27', '2026-09-27'), 'sorgfull');
});

test('an unknown stored id falls back to the day default', () => {
  assert.equal(resolvePreselectedSetId('nonsense', '2026-09-27', '2026-09-27'), 'harrlig');
  assert.equal(isKnownSetId('nonsense'), false);
  assert.equal(isKnownSetId('harrlig'), true);
});
