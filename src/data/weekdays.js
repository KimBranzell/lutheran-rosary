/**
 * Swedish weekday labels and date helpers.
 * Weekday numbering follows JavaScript's Date.getDay(): 0 = Sunday, 6 = Saturday.
 * All helpers are pure and time-zone-safe (date-only, UTC-based arithmetic).
 */

export const WEEKDAY_LABELS = {
  0: { full: 'Söndag', short: 'Sön' },
  1: { full: 'Måndag', short: 'Mån' },
  2: { full: 'Tisdag', short: 'Tis' },
  3: { full: 'Onsdag', short: 'Ons' },
  4: { full: 'Torsdag', short: 'Tor' },
  5: { full: 'Fredag', short: 'Fre' },
  6: { full: 'Lördag', short: 'Lör' },
};

/**
 * Format a list of weekday numbers as a Swedish label.
 * @param {number[]} days e.g. [1, 6]
 * @param {'full' | 'short'} [style] default 'full'
 * @returns {string} e.g. 'Måndag & Lördag'
 */
export function formatWeekdays(days, style = 'full') {
  const valid = [...new Set(days)]
    .filter((d) => Number.isInteger(d) && WEEKDAY_LABELS[d])
    .sort((a, b) => a - b);

  const labels = valid.map((d) => WEEKDAY_LABELS[d][style]);

  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

/**
 * Get the weekday (0 = Sunday) for an ISO date string (YYYY-MM-DD).
 * Uses UTC so the result never depends on the host time zone.
 * @param {string} isoDate
 * @returns {number}
 */
export function weekdayOf(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Today's local calendar date as YYYY-MM-DD.
 * @returns {string}
 */
export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
