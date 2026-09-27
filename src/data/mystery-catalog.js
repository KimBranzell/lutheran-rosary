/**
 * Mystery catalog — four sets of five mysteries each.
 * Weekday mapping follows the traditional Dominican schedule.
 * Scripture references use USX book codes; the extractor maps them
 * to Swedish display names via metadata.xml.
 */

import { weekdayOf } from './weekdays.js';

export const mysterySets = [
  {
    id: 'gladjefylld',
    name: 'Glädjefylld',
    weekdays: [1, 6], // Monday, Saturday (0=Sunday)
    mysteries: [
      { title: 'Ängels budskap till Maria', ref: 'LUK 1:26-38' },
      { title: 'Maria och Elisabet', ref: 'LUK 1:39-45' },
      { title: 'Jesu Födelse', ref: 'LUK 2:1-20' },
      { title: 'Jesus bärs fram i templet', ref: 'LUK 2:22-38' },
      { title: 'Jesus som tolvåring i templet', ref: 'LUK 2:41-50' },
    ],
  },
  {
    id: 'lysande',
    name: 'Lysande',
    weekdays: [4], // Thursday
    mysteries: [
      { title: 'Vår Herres dop i floden Jordan', ref: 'MAT 3:13-16' },
      { title: 'Bröllopet i Kana', ref: 'JHN 2:1-11' },
      { title: 'Guds rikes förkunnelse', ref: 'MRK 1:14-15' },
      { title: 'Vår Herres förvandling', ref: 'MAT 17:1-8' },
      { title: 'Den sista måltiden', ref: 'LUK 22:14-20' },
    ],
  },
  {
    id: 'sorgfull',
    name: 'Sorgfull',
    weekdays: [2, 5], // Tuesday, Friday
    mysteries: [
      { title: 'Vår Herres ångest i lustgården', ref: 'LUK 22:39-46' },
      { title: 'Vår Herre gisslas vid pelaren', ref: 'MAT 27:26' },
      { title: 'Vår Herre kröns med törnen', ref: 'MAT 27:27-31' },
      { title: 'Vår Herre bär korset till Golgata', ref: 'MAT 27:32' },
      { title: 'Vår Herres korsfästelse', ref: 'JHN 19:25-30' },
    ],
  },
  {
    id: 'harrlig',
    name: 'Härlig',
    weekdays: [0, 3], // Sunday, Wednesday
    mysteries: [
      { title: 'Vår Herres härliga uppståndelse', ref: 'MRK 16:1-7' },
      { title: 'Vår Herres himmelsfärd', ref: 'LUK 24:45-53' },
      { title: 'Den Helige Andes nedstigning vid pingst', ref: 'ACT 2:1-7' },
      { title: 'De heligas gemenskap', ref: '1CO 12:23-27' },
      { title: 'Himmelska Jerusalem', ref: 'REV 21:1-4' },
    ],
  },
];

/**
 * Stable passage id for a mystery reference. Must match the keys produced by
 * `scripts/extract-scriptures.mjs` and `src/data/scripture-references.js`.
 * e.g. "LUK 1:26-38" -> "LUK_1_26-38"
 *
 * @param {string} ref
 * @returns {string}
 */
export function passageId(ref) {
  return String(ref).replace(/\s+/g, '_').replace(/:/g, '_');
}

/**
 * Get the mystery set for a given weekday (0=Sunday, 6=Saturday).
 */
export function getMysterySetForDay(dayOfWeek) {
  return mysterySets.find(set => set.weekdays.includes(dayOfWeek)) || mysterySets[0];
}

/**
 * Is this id one of the four known mystery sets?
 * @param {string} id
 * @returns {boolean}
 */
export function isKnownSetId(id) {
  return mysterySets.some(set => set.id === id);
}

/**
 * Resolve which mystery set should be preselected.
 *
 * A stored choice is honoured only when it was made on the same calendar day;
 * otherwise the current weekday's set is preselected. This keeps "today's
 * mystery" preselected while still allowing a manual override for that day.
 *
 * @param {string} storedId
 * @param {string} storedDate ISO date (YYYY-MM-DD) the choice was made on
 * @param {string} today ISO date (YYYY-MM-DD)
 * @returns {string} a known set id
 */
export function resolvePreselectedSetId(storedId, storedDate, today) {
  if (storedDate === today && isKnownSetId(storedId)) {
    return storedId;
  }
  return getMysterySetForDay(weekdayOf(today)).id;
}
