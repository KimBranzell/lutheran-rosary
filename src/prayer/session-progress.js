/**
 * Persists an in-progress prayer session so an accidental refresh, app kill or
 * OS eviction does not lose the user's place in the 86-step sequence.
 *
 * Everything read back is treated as hostile: this key lives in `localStorage`,
 * which any script on the origin — or the user in DevTools — can write. Invalid
 * data is cleared rather than trusted, and every access is best-effort so private
 * mode and quota errors degrade to "no resume offered" instead of throwing.
 *
 * All storage access is guarded with `typeof globalThis.localStorage` so the
 * module also runs under `node --test`, where tests inject their own stub.
 */

import { isKnownSetId } from '../data/mystery-catalog.js';

const STORAGE_KEY = 'luthers-rosenkrans-session';
const PRAYER_CHOICES = ['aveMaria', 'jesuBoen'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {object} SessionProgress
 * @property {number} index 0-based step index
 * @property {'aveMaria'|'jesuBoen'} prayerChoice
 * @property {string} mysterySetId a known id from the mystery catalog
 * @property {string} date YYYY-MM-DD the session was last touched
 */

/** @returns {Storage|null} null when unavailable (Node, or storage disabled) */
function storage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    // Merely touching localStorage can throw in some hardened browsers.
    return null;
  }
}

/** Structural validation shared by save and load. */
function isValidProgress(p) {
  return (
    p !== null &&
    typeof p === 'object' &&
    !Array.isArray(p) &&
    Number.isInteger(p.index) &&
    p.index >= 0 &&
    PRAYER_CHOICES.includes(p.prayerChoice) &&
    isKnownSetId(p.mysterySetId) &&
    typeof p.date === 'string' &&
    ISO_DATE.test(p.date)
  );
}

/**
 * Persist a session position.
 * @param {SessionProgress} progress
 * @returns {boolean} false when rejected or storage is unavailable
 */
export function saveProgress(progress) {
  if (!isValidProgress(progress)) return false;
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({
      index: progress.index,
      prayerChoice: progress.prayerChoice,
      mysterySetId: progress.mysterySetId,
      date: progress.date,
    }));
    return true;
  } catch {
    // Private mode / quota: resume is a nicety, not a requirement.
    return false;
  }
}

/**
 * Read the saved session.
 * @returns {SessionProgress|null} null when absent, unreadable or invalid;
 *   an invalid entry is cleared so it is not re-read on every launch.
 */
export function loadProgress() {
  const store = storage();
  if (!store) return null;

  let raw;
  try {
    const stored = store.getItem(STORAGE_KEY);
    if (!stored) return null;
    raw = JSON.parse(stored);
  } catch {
    clearProgress();
    return null;
  }

  if (!isValidProgress(raw)) {
    clearProgress();
    return null;
  }

  // Return a fresh object with only the known keys — never hand back whatever
  // shape the stored JSON happened to have.
  return {
    index: raw.index,
    prayerChoice: raw.prayerChoice,
    mysterySetId: raw.mysterySetId,
    date: raw.date,
  };
}

/** Forget the saved session (best-effort). */
export function clearProgress() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}
