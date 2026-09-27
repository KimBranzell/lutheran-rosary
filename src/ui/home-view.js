/**
 * Home view — start screen with mystery/prayer selectors and start button.
 *
 * Selectors are native radio groups styled as cards / a segmented control
 * (never <select>). Today's mystery set is preselected by calendar date and a
 * manual override persists only for the same day.
 */

import {
  mysterySets,
  getMysterySetForDay,
  isKnownSetId,
  resolvePreselectedSetId,
  passageId,
} from '../data/mystery-catalog.js';
import { formatWeekdays, todayIso, weekdayOf } from '../data/weekdays.js';

const STORAGE_KEY_SETTINGS = 'luthers-rosenkrans-settings';
const PRAYER_CHOICES = ['aveMaria', 'jesuBoen'];
const REMINDER_SLOTS = ['morning', 'noon', 'evening', 'night'];

/** Set during loadSettings() when bad stored data was replaced. */
let lastLoadNotice = null;

/** Swedish message describing why stored settings were reset, if any. */
export function getStorageNotice() {
  return lastLoadNotice;
}

/** Escape interpolated text for safe template interpolation. */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getDefaultSettings(today = todayIso()) {
  return {
    version: 2,
    mysterySetId: getMysterySetForDay(weekdayOf(today)).id,
    mysterySetDate: '',
    prayerChoice: 'aveMaria',
    reminders: {
      morning: { enabled: false, time: '' },
      noon: { enabled: false, time: '' },
      evening: { enabled: true, time: '19:30' },
      night: { enabled: false, time: '' },
    },
  };
}

/** @returns {boolean} true for a valid 24-hour HH:mm string */
export function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sanitizeReminders(raw, defaults) {
  const result = {};
  for (const slot of REMINDER_SLOTS) {
    const src = raw && typeof raw === 'object' ? raw[slot] : null;
    if (src && typeof src === 'object') {
      result[slot] = {
        enabled: Boolean(src.enabled),
        time: isValidTime(src.time) ? src.time : '',
      };
    } else {
      result[slot] = { ...defaults.reminders[slot] };
    }
    if (result[slot].enabled && !result[slot].time) {
      // Enabled but no valid time: keep it off rather than firing at midnight.
      result[slot].enabled = false;
    }
  }
  return result;
}

function mergeAndValidate(raw, defaults) {
  const problems = [];
  if (!raw || typeof raw !== 'object') {
    if (raw != null) problems.push('settings');
    return { settings: defaults, problems };
  }

  const settings = { ...defaults };

  if (isKnownSetId(raw.mysterySetId)) {
    settings.mysterySetId = raw.mysterySetId;
  } else if (raw.mysterySetId !== undefined) {
    problems.push('mysterySetId');
  }

  if (typeof raw.mysterySetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.mysterySetDate)) {
    settings.mysterySetDate = raw.mysterySetDate;
  }

  if (PRAYER_CHOICES.includes(raw.prayerChoice)) {
    settings.prayerChoice = raw.prayerChoice;
  } else if (raw.prayerChoice !== undefined) {
    problems.push('prayerChoice');
  }

  settings.reminders = sanitizeReminders(raw.reminders, defaults);

  return { settings, problems };
}

export function loadSettings() {
  const today = todayIso();
  const defaults = getDefaultSettings(today);
  lastLoadNotice = null;

  let raw = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (stored) {
      raw = JSON.parse(stored);
    }
  } catch {
    lastLoadNotice = 'Dina sparade inställningar kunde inte läsas och har återställts.';
    return defaults;
  }

  const { settings, problems } = mergeAndValidate(raw, defaults);
  if (problems.length) {
    lastLoadNotice = 'Vissa sparade inställningar var ogiltiga och har återställts.';
  }

  // Preselect today's set unless the user chose one today.
  settings.mysterySetId = resolvePreselectedSetId(
    settings.mysterySetId,
    settings.mysterySetDate,
    today,
  );

  return settings;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode / quota); preferences are best-effort.
  }
}

export function renderHomeView(container, settings, onStart, onNavigateSettings, scriptureData) {
  const today = todayIso();
  const todaySetId = getMysterySetForDay(weekdayOf(today)).id;
  const currentSet = mysterySets.find((s) => s.id === settings.mysterySetId) || mysterySets[0];

  // One mystery list item: title plus its Scripture reference.
  function mysteryItem(mystery) {
    const passage = scriptureData ? scriptureData[passageId(mystery.ref)] : null;
    const reference = (passage && passage.displayRef) || mystery.ref;
    return `<li class="mystery-preview__item">
      <span class="mystery-preview__title">${esc(mystery.title)}</span>
      <span class="mystery-preview__ref">${esc(reference)}</span>
    </li>`;
  }

  const mysteryCards = mysterySets.map((set) => {
    const isToday = set.id === todaySetId;
    const checked = set.id === settings.mysterySetId;
    return `
      <label class="mystery-option">
        <input class="visually-hidden" type="radio" name="mystery-set"
          value="${esc(set.id)}"${checked ? ' checked' : ''}>
        <span class="mystery-option__name">${esc(set.name)}</span>
        <span class="mystery-option__days">${esc(formatWeekdays(set.weekdays))}</span>
        ${isToday ? '<span class="badge badge--today"><span aria-hidden="true">✓</span> Idag</span>' : ''}
        <span class="mystery-option__check" aria-hidden="true">✓</span>
      </label>`;
  }).join('');

  const prayerOptions = [
    {
      value: 'aveMaria',
      title: 'Luthers Ave Maria',
      desc: 'Den pre-tridentinska hälsningen, så som Luther bad den.',
    },
    {
      value: 'jesuBoen',
      title: 'Jesusbönen',
      desc: 'Herre Jesus Kristus, Guds son, förbarma dig över mig, syndare.',
    },
  ].map((opt) => `
    <label class="segmented__option">
      <input class="visually-hidden" type="radio" name="prayer-choice"
        value="${esc(opt.value)}"${opt.value === settings.prayerChoice ? ' checked' : ''}>
      <span class="segmented__title">
        <span class="segmented__check" aria-hidden="true">✓</span>${esc(opt.title)}
      </span>
      <span class="segmented__desc">${esc(opt.desc)}</span>
    </label>`).join('');

  const notice = getStorageNotice();

  container.innerHTML = `
    <section class="home-view" aria-labelledby="home-heading">
      <h2 id="home-heading">Dagens rosenkrans</h2>
      <p id="home-notice" class="status-note" role="status"${notice ? '' : ' hidden'}>
        ${notice ? esc(notice) : ''}
      </p>

      <fieldset class="choice">
        <legend class="choice__legend">Mysterier</legend>
        <p id="mystery-hint" class="choice__hint">Dagens krans är förvald. Välj en annan om du vill.</p>
        <div class="mystery-grid" aria-describedby="mystery-hint">
          ${mysteryCards}
        </div>
      </fieldset>

      <fieldset class="choice">
        <legend class="choice__legend">Bön på pärlorna</legend>
        <div class="segmented">
          ${prayerOptions}
        </div>
      </fieldset>

      <div class="mystery-preview card" id="mystery-preview">
        <h3 id="preview-title">${esc(currentSet.name)}</h3>
        <ol id="preview-list">
          ${currentSet.mysteries.map(mysteryItem).join('')}
        </ol>
      </div>

      <div class="stack">
        <button id="btn-start" class="btn btn--primary btn--block" type="button">Börja rosenkransen</button>
        <button id="btn-settings" class="btn btn--ghost btn--block" type="button">Påminnelser</button>
      </div>
    </section>
  `;

  function renderPreview() {
    const set = mysterySets.find((s) => s.id === settings.mysterySetId) || mysterySets[0];
    container.querySelector('#preview-title').textContent = set.name;
    container.querySelector('#preview-list').innerHTML = set.mysteries.map(mysteryItem).join('');
  }

  container.querySelectorAll('input[name="mystery-set"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (!event.target.checked) return;
      settings.mysterySetId = event.target.value;
      settings.mysterySetDate = todayIso();
      saveSettings(settings);
      renderPreview();
    });
  });

  container.querySelectorAll('input[name="prayer-choice"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (!event.target.checked) return;
      settings.prayerChoice = event.target.value;
      saveSettings(settings);
    });
  });

  container.querySelector('#btn-start').addEventListener('click', () => {
    onStart(settings);
  });

  container.querySelector('#btn-settings').addEventListener('click', () => {
    onNavigateSettings();
  });
}
