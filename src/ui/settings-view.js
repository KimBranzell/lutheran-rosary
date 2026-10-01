/**
 * Settings view — reminder configuration.
 */

import { loadSettings, saveSettings, isValidTime } from './home-view.js';
import { esc } from '../util/esc.js';
import { applyTextScale, isValidTextScale, TEXT_SCALES } from './text-scale.js';
// The scheduler owns the live timers and re-reads settings from localStorage
// itself, so it only needs to be nudged after each save.
import { scheduleReminders } from '../notifications/reminder-scheduler.js';

const SLOT_LABELS = { morning: 'Morgon', noon: 'Middag', evening: 'Kväll', night: 'Natt' };
const SLOT_ORDER = ['morning', 'noon', 'evening', 'night'];

/** Label per supported scale — keep in step with `TEXT_SCALES`. */
const SCALE_LABELS = { 1: 'Normal', 1.25: 'Stor', 1.5: 'Mycket stor' };

function scaleOption(scale, current) {
  const checked = isValidTextScale(current) && Number(current) === scale ? ' checked' : '';
  return `
          <label class="segmented__option">
            <input class="visually-hidden" type="radio" name="text-scale" value="${scale}"${checked}>
            <span class="segmented__title">
              <span class="segmented__check" aria-hidden="true">✓</span>${SCALE_LABELS[scale]}
            </span>
          </label>`;
}

export function renderSettingsView(container, onBack) {
  const settings = loadSettings();

  container.innerHTML = `
    <section class="settings-view" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Inställningar</h2>

      <fieldset class="choice">
        <legend class="choice__legend">Textstorlek</legend>
        <div class="segmented">
          ${TEXT_SCALES.map((scale) => scaleOption(scale, settings.textScale)).join('')}
        </div>
      </fieldset>

      <h3 class="settings-subheading">Påminnelser</h3>
      <p class="settings-note">
        Påminnelser är bästa ansträngning. De kan försenas eller missas om appen är stängd
        eller avstängd av systemet.
      </p>

      <div class="slots">
        ${SLOT_ORDER.map((slot) => {
          const label = SLOT_LABELS[slot];
          const r = settings.reminders[slot];
          return `
            <div class="slot-row">
              <label class="switch">
                <input class="switch__input" type="checkbox" id="reminder-${slot}"${r.enabled ? ' checked' : ''}>
                <span class="switch__ui" aria-hidden="true"><span class="switch__thumb"></span></span>
                <span class="switch__label">${esc(label)}</span>
              </label>
              <label class="visually-hidden" for="time-${slot}">Tid för ${esc(label)}</label>
              <input class="time-input" type="time" id="time-${slot}"
                value="${esc(r.time || '')}"${r.enabled ? '' : ' disabled'}>
            </div>`;
        }).join('')}
      </div>

      <p id="notif-status" class="status-note" role="status" aria-live="polite"></p>

      <div class="settings-actions">
        <button id="btn-enable-notif" class="btn btn--ghost" type="button">Aktivera aviseringar</button>
        <button id="btn-back" class="btn btn--primary" type="button">Tillbaka</button>
      </div>
    </section>
  `;

  SLOT_ORDER.forEach((slot) => {
    const checkbox = container.querySelector(`#reminder-${slot}`);
    const timeInput = container.querySelector(`#time-${slot}`);

    checkbox.addEventListener('change', () => {
      settings.reminders[slot].enabled = checkbox.checked;
      timeInput.disabled = !checkbox.checked;
      if (checkbox.checked && !isValidTime(timeInput.value)) {
        timeInput.value = '19:30';
      }
      settings.reminders[slot].time = isValidTime(timeInput.value) ? timeInput.value : '';
      saveSettings(settings);
      // Timers were built at boot from the old settings; rebuild now, otherwise a
      // reminder enabled while the app stays in the foreground never fires.
      scheduleReminders();
    });

    timeInput.addEventListener('change', () => {
      const valid = isValidTime(timeInput.value);
      settings.reminders[slot].time = valid ? timeInput.value : '';
      if (!valid) {
        timeInput.value = '';
      }
      saveSettings(settings);
      scheduleReminders();
    });
  });

  // Text size — applied immediately so the effect is visible, then persisted.
  container.querySelectorAll('input[name="text-scale"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (!event.target.checked) return;
      const scale = Number(event.target.value);
      // Never persist a value the app does not support.
      if (!isValidTextScale(scale)) return;
      settings.textScale = scale;
      saveSettings(settings);
      applyTextScale(settings.textScale);
    });
  });

  const statusEl = container.querySelector('#notif-status');
  const btnEnable = container.querySelector('#btn-enable-notif');

  function updateNotifStatus() {
    if (!('Notification' in window)) {
      statusEl.textContent = 'Aviseringar stöds inte i denna webbläsare.';
      btnEnable.disabled = true;
      return;
    }
    const perm = Notification.permission;
    if (perm === 'granted') {
      statusEl.textContent = 'Aviseringar är aktiverade.';
      btnEnable.disabled = true;
    } else if (perm === 'denied') {
      statusEl.textContent = 'Aviseringar är blockerade. Ändra i webbläsarens inställningar.';
      btnEnable.disabled = true;
    } else {
      statusEl.textContent = 'Aviseringar är inte aktiverade ännu.';
      btnEnable.disabled = false;
    }
  }

  btnEnable.addEventListener('click', async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
      updateNotifStatus();
      // Permission state feeds the scheduler's decision to fire; reschedule now.
      scheduleReminders();
    }
  });

  updateNotifStatus();

  container.querySelector('#btn-back').addEventListener('click', () => {
    onBack();
  });
}
