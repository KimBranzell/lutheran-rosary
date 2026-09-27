/**
 * Gregorian Easter computus and Swedish Church-year calendar.
 *
 * Uses date-only arithmetic (no time-zone offsets).
 * All internal dates are UTC calendar dates; "today" is obtained
 * from the device's local year/month/day.
 */

// ── Gregorian Easter (Meeus/Jones/Butcher algorithm) ──

/**
 * @param {number} year
 * @returns {{ month: number, day: number }} Easter Sunday (1-indexed month)
 */
export function computeEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Create a UTC date (no time component) from year, month (1-12), day.
 */
export function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Add days to a UTC date.
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Get today's date as a UTC calendar date (using local time components).
 */
export function todayLocal() {
  const now = new Date();
  return utcDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// ── Church-year observances ──

/**
 * Compute all movable and fixed observances for a given Church year.
 * The Church year starts with 1st Advent of the previous calendar year.
 *
 * @param {number} year - The calendar year in which Easter falls.
 * @returns {Array<object>} sorted array of observances
 */
export function computeChurchYear(year) {
  const easter = computeEaster(year);
  const easterDate = utcDate(year, easter.month, easter.day);

  const observances = [];

  // Helper to add an observance
  function add(name, date, color, season) {
    observances.push({ name, date: new Date(date), color, season });
  }

  // ── Fixed dates ──
  add('Juldagen', utcDate(year - 1, 12, 25), 'vit', 'Jultiden');
  add('Annandag jul', utcDate(year - 1, 12, 26), 'röd', 'Jultiden');
  add('Nyårsdagen', utcDate(year, 1, 1), 'vit', 'Jultiden');
  add('Trettondedag jul', utcDate(year, 1, 6), 'vit', 'Trettondedagstiden');

  // Kyndelsmässodagen: Sunday 2-8 February, or Sunday before Fastlagssöndagen if they coincide
  const kyndelsmassFixed = utcDate(year, 2, 2);
  const kyndelsmassSunday = nextSundayOnOrAfter(kyndelsmassFixed);
  // Fastlagssöndagen is 7 weeks before Easter
  const fastlag = addDays(easterDate, -49);
  // If Kyndelsmäss falls on Fastlagssöndagen, move to previous Sunday
  let kyndelsmassDate = kyndelsmassSunday;
  if (sameDay(kyndelsmassSunday, fastlag)) {
    kyndelsmassDate = addDays(kyndelsmassSunday, -7);
  }
  add('Kyndelsmässodagen', kyndelsmassDate, 'vit', 'Trettondedagstiden');

  // ── Pre-Lent ──
  add('Septuagesima', addDays(easterDate, -63), 'violett', 'Förfastan');
  add('Sexagesima', addDays(easterDate, -56), 'violett', 'Förfastan');
  add('Fastlagssöndagen', addDays(easterDate, -49), 'violett', 'Förfastan');
  add('Askonsdagen', addDays(easterDate, -46), 'violett', 'Fastan');

  // ── Lent ──
  for (let i = 1; i <= 5; i++) {
    add(`${i}:a söndagen i fastan`, addDays(easterDate, -42 + (i - 1) * 7), 'violett', 'Fastan');
  }

  // Jungfru Marie bebådelsedag: Sunday nearest 25 March, or Sunday before Palm Sunday if early Easter
  const annunciationFixed = utcDate(year, 3, 25);
  const palmSunday = addDays(easterDate, -7);
  const annunciationSunday = nearestSunday(annunciationFixed);
  let annunciationDate = annunciationSunday;
  // If it would fall on or after Palm Sunday, move to previous Sunday
  if (annunciationSunday >= palmSunday) {
    annunciationDate = addDays(palmSunday, -7);
  }
  add('Jungfru Marie bebådelsedag', annunciationDate, 'vit', 'Fastan');

  // ── Holy Week ──
  add('Palmsöndagen', addDays(easterDate, -7), 'violett', 'Stilla veckan');
  add('Skärtorsdagen', addDays(easterDate, -3), 'vit', 'Stilla veckan');
  add('Långfredagen', addDays(easterDate, -2), 'svart', 'Stilla veckan');
  add('Påskdagen', easterDate, 'vit', 'Påsktiden');
  add('Annandag påsk', addDays(easterDate, 1), 'vit', 'Påsktiden');

  // ── Easter season ──
  for (let i = 1; i <= 6; i++) {
    add(`${i}:a söndagen i påsktiden`, addDays(easterDate, i * 7), 'vit', 'Påsktiden');
  }
  add('Kristi himmelsfärds dag', addDays(easterDate, 39), 'vit', 'Påsktiden');
  add('Pingstdagen', addDays(easterDate, 49), 'röd', 'Pingst');
  add('Annandag pingst', addDays(easterDate, 50), 'röd', 'Pingst');
  add('Heliga Trefaldighets dag', addDays(easterDate, 56), 'vit', 'Trefaldighetstiden');

  // ── Trinity season ──
  // Sundays after Trinity (green, with exceptions)
  const trinity = addDays(easterDate, 56);
  for (let i = 1; i <= 25; i++) {
    const date = addDays(trinity, i * 7);
    // Stop if we reach Advent
    const advent1 = firstAdvent(year);
    if (date >= advent1) break;
    add(`${i}:e söndagen efter trefaldighet`, date, 'grön', 'Trefaldighetstiden');
  }

  // Midsommardagen: Saturday 20-26 June
  const midsummerFixed = utcDate(year, 6, 20);
  const midsummerDate = nextSaturdayOnOrAfter(midsummerFixed);
  add('Midsommardagen', midsummerDate, 'grön', 'Trefaldighetstiden');

  // Johannes Döparens dag: Sunday after Midsommardagen
  add('Johannes Döparens dag', nextSundayAfter(midsummerDate), 'vit', 'Trefaldighetstiden');

  // Apostladagen: 35 days after Trinity Sunday, unless it coincides with Johannes Döparens dag
  const apostlaDate = addDays(trinity, 35);
  const johannesDate = nextSundayAfter(midsummerDate);
  if (!sameDay(apostlaDate, johannesDate)) {
    add('Apostladagen', apostlaDate, 'röd', 'Trefaldighetstiden');
  }

  // Kristi förklarings dag: 7th Sunday after Trinity
  add('Kristi förklarings dag', addDays(trinity, 49), 'vit', 'Trefaldighetstiden');

  // Den helige Mikaels dag: Sunday 29 Sep - 5 Oct
  const michaelFixed = utcDate(year, 9, 29);
  const michaelDate = nextSundayOnOrAfter(michaelFixed);
  add('Den helige Mikaels dag', michaelDate, 'vit', 'Trefaldighetstiden');

  // Tacksägelsedagen: 2nd Sunday in October
  const oct1 = utcDate(year, 10, 1);
  const firstOctSunday = nextSundayOnOrAfter(oct1);
  add('Tacksägelsedagen', addDays(firstOctSunday, 7), 'grön', 'Trefaldighetstiden');

  // Alla helgons dag: Saturday 31 Oct - 6 Nov
  const allSaintsFixed = utcDate(year, 10, 31);
  const allSaintsDate = nextSaturdayOnOrAfter(allSaintsFixed);
  add('Alla helgons dag', allSaintsDate, 'vit', 'Trefaldighetstiden');

  // Alla själars dag: Sunday after Alla helgons dag
  add('Alla själars dag', nextSundayAfter(allSaintsDate), 'svart', 'Trefaldighetstiden');

  // Domsöndagen: Sunday before 1st Advent
  const advent1Date = firstAdvent(year);
  add('Domsöndagen', addDays(advent1Date, -7), 'vit', 'Trefaldighetstiden');

  // ── Advent ──
  add('1:a söndagen i advent', advent1Date, 'vit', 'Advent');
  for (let i = 2; i <= 4; i++) {
    add(`${i}:a söndagen i advent`, addDays(advent1Date, (i - 1) * 7), 'violett', 'Advent');
  }

  // Sort by date
  observances.sort((a, b) => a.date - b.date);

  return observances;
}

// ── Helper functions ──

function sameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
         a.getUTCMonth() === b.getUTCMonth() &&
         a.getUTCDate() === b.getUTCDate();
}

function nextSundayOnOrAfter(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (7 - day) % 7;
  return addDays(d, diff);
}

function nextSundayAfter(date) {
  return addDays(nextSundayOnOrAfter(date), 7);
}

function nextSaturdayOnOrAfter(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (6 - day + 7) % 7;
  return addDays(d, diff);
}

function nearestSunday(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  if (day === 0) return d;
  const diff = day <= 3 ? -day : 7 - day;
  return addDays(d, diff);
}

function firstAdvent(year) {
  // 1st Advent is the 4th Sunday before Christmas Day (Dec 25)
  const christmas = utcDate(year, 12, 25);
  const christmasDay = christmas.getUTCDay();
  // Days until previous Sunday
  const daysToSunday = christmasDay === 0 ? 7 : christmasDay;
  const sundayBeforeChristmas = addDays(christmas, -daysToSunday);
  // 1st Advent is 3 weeks before that Sunday (4th Sunday before Christmas)
  return addDays(sundayBeforeChristmas, -21);
}

/**
 * Get the liturgical color for a given date.
 * @param {Date} date - UTC calendar date
 * @param {number} year - Easter year (the year containing Easter Sunday)
 * @returns {string} color name: 'vit', 'röd', 'grön', 'violett', 'svart'
 */
export function getLiturgicalColor(date, year) {
  const observances = computeChurchYear(year);
  for (const obs of observances) {
    if (sameDay(obs.date, date)) {
      return obs.color;
    }
  }
  // Days without a named observance use the ordinary-time colour.
  return 'grön';
}

/**
 * Get the current liturgical color for today.
 */
export function getCurrentColor() {
  const today = todayLocal();
  const year = today.getUTCFullYear();
  // The Church year spans two calendar years; check both
  const colorThisYear = getLiturgicalColor(today, year);
  const colorPrevYear = getLiturgicalColor(today, year - 1);
  // Use the one that has observances covering today
  const obsThisYear = computeChurchYear(year);
  const obsPrevYear = computeChurchYear(year - 1);
  const hasThisYear = obsThisYear.some(o => sameDay(o.date, today));
  const hasPrevYear = obsPrevYear.some(o => sameDay(o.date, today));
  if (hasPrevYear) return colorPrevYear;
  return colorThisYear;
}

/**
 * Get the observance for a given date (or the most recent preceding one) so the
 * season and the specific church-year day can be named in text as well as
 * coloured.
 *
 * @param {Date} [referenceDate] UTC calendar date; defaults to today (local).
 * @returns {{ name: string, season: string, color: string }}
 */
export function getCurrentObservance(referenceDate) {
  const day = referenceDate instanceof Date ? referenceDate : todayLocal();
  const year = day.getUTCFullYear();

  const candidates = [
    ...computeChurchYear(year - 1),
    ...computeChurchYear(year),
    ...computeChurchYear(year + 1),
  ].sort((a, b) => a.date - b.date);

  let match = null;
  for (const obs of candidates) {
    if (obs.date.getTime() <= day.getTime()) {
      match = obs;
    } else {
      break;
    }
  }

  if (match) {
    return { name: match.name, season: match.season, color: match.color };
  }
  return { name: 'Kyrkoåret', season: 'Trefaldighetstiden', color: 'grön' };
}
