import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEaster,
  computeChurchYear,
  getCurrentObservance,
  utcDate,
} from '../../src/calendar/liturgical-calendar.js';

test('Gregorian Easter matches known dates 2025-2030', () => {
  const expected = {
    2025: '04-20',
    2026: '04-05',
    2027: '03-28',
    2028: '04-16',
    2029: '04-01',
    2030: '04-21',
  };
  for (const [year, md] of Object.entries(expected)) {
    const easter = computeEaster(Number(year));
    const actual = `${String(easter.month).padStart(2, '0')}-${String(easter.day).padStart(2, '0')}`;
    assert.equal(actual, md, `Easter ${year}`);
  }
});

function namesOn(year, month, day) {
  const target = utcDate(year, month, day).getTime();
  return computeChurchYear(year)
    .filter((o) => o.date.getTime() === target)
    .map((o) => o.name);
}

test('known 2027 Swedish Church year transfers', () => {
  // Annunciation moves to 14 March because Palm Sunday is 21 March
  assert.ok(namesOn(2027, 3, 14).includes('Jungfru Marie bebådelsedag'));
  assert.ok(namesOn(2027, 3, 21).includes('Palmsöndagen'));
  // Candlemas coincides with Fastlagssöndagen → transferred to 31 January
  assert.ok(namesOn(2027, 1, 31).includes('Kyndelsmässodagen'));
});

test('getCurrentObservance names the specific church-year day', () => {
  assert.equal(getCurrentObservance(utcDate(2026, 9, 27)).name, '17:e söndagen efter trefaldighet');
  assert.equal(getCurrentObservance(utcDate(2027, 3, 14)).name, 'Jungfru Marie bebådelsedag');
  assert.equal(getCurrentObservance(utcDate(2027, 7, 4)).name, 'Johannes Döparens dag');
  assert.equal(getCurrentObservance(utcDate(2026, 12, 25)).name, 'Juldagen');
});

test('a weekday reports the Sunday of the week it falls in', () => {
  // Monday 28 September 2026 follows the 17th Sunday after Trinity
  assert.equal(getCurrentObservance(utcDate(2026, 9, 28)).name, '17:e söndagen efter trefaldighet');
});

test('getCurrentObservance always returns a name, season and valid colour', () => {
  const today = getCurrentObservance();
  assert.ok(today.name.length > 0);
  assert.ok(today.season.length > 0);
  assert.ok(['vit', 'röd', 'grön', 'violett', 'svart'].includes(today.color));
});
