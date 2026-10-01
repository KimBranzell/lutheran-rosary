/**
 * Best-effort local reminders: timers fire while the app is open, and missed
 * slots are caught up on the next start or resume. No push, no background sync,
 * and no guarantee of delivery while the app is closed.
 */

import { loadSettings } from '../ui/home-view.js';

const STORAGE_KEY_LAST_SENT = 'luthers-rosenkrans-reminder-last-sent';
const NOTIFICATION_TITLE = 'Tid för bön';

/** Swedish label per reminder slot, used to name the moment in the notification. */
const SLOT_LABELS = {
  morning: 'Morgon',
  noon: 'Middag',
  evening: 'Kväll',
  night: 'Natt',
};

/**
 * Narrow a slot id to a known key.
 *
 * `slot` can arrive from `event.notification.data`, so it must never be allowed
 * to resolve through the prototype chain — `SLOT_LABELS['__proto__']` is truthy
 * and would render as "[object Object]" in the notification body.
 *
 * @param {string} slot
 * @returns {'morning'|'noon'|'evening'|'night'}
 */
function resolveSlot(slot) {
  return Object.hasOwn(SLOT_LABELS, slot) ? slot : 'evening';
}

/** Delay applied by the "Påminn senare" action. */
const SNOOZE_MINUTES = 10;

// NOTE: `actions` is unsupported in Safari entirely (macOS and iOS), and
// `notificationclick` does not fire at all on iOS. Unknown option members are
// ignored by the spec, so sending them is safe everywhere — the buttons simply
// do not appear where unsupported. See README "Påminnelser".
const NOTIFICATION_ACTIONS = [
  { action: 'open', title: 'Be rosenkransen' },
  { action: 'later', title: 'Påminn senare' },
];

/**
 * Get the last-sent dates from localStorage.
 * Always returns a plain object, even for hostile/corrupt stored values.
 */
function getLastSentDates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAST_SENT);
    const parsed = stored ? JSON.parse(stored) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Save the last-sent dates to localStorage (best-effort).
 */
function saveLastSentDates(dates) {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SENT, JSON.stringify(dates));
  } catch {
    // Storage may be unavailable (private mode / quota); best-effort only.
  }
}

/**
 * Get today's date string in YYYY-MM-DD format (local time).
 */
function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Compute the next occurrence of a time string (HH:MM) today or tomorrow.
 */
function getNextOccurrence(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  // If the target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

/**
 * Show a notification using the service worker.
 */
/**
 * Show a local reminder notification.
 * Exported for unit testing (the options payload is otherwise unreachable).
 *
 * @param {string} [slot] which reminder slot is firing
 * @returns {Promise<boolean>} true when a notification was shown
 */
export async function showNotification(slot = 'evening') {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(NOTIFICATION_TITLE, {
      body: `${SLOT_LABELS[resolveSlot(slot)]} — ta en stund för rosenkransen.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'rosary-reminder',
      vibrate: [200, 100, 200],
      actions: NOTIFICATION_ACTIONS,
      // Lets the click handler reschedule the same slot on "Påminn senare".
      data: { slot: resolveSlot(slot) },
    });
    return true;
  } catch (err) {
    console.warn('Failed to show notification:', err);
    return false;
  }
}

/**
 * Check for missed reminders and send catch-up notifications.
 * Called on app startup and visibility resume.
 */
export function checkMissedReminders() {
  const settings = loadSettings();
  const lastSent = getLastSentDates();
  const today = todayString();
  const now = new Date();

  for (const [slot, config] of Object.entries(settings.reminders)) {
    if (!config.enabled || !config.time) continue;

    const [hours, minutes] = config.time.split(':').map(Number);
    const reminderTime = new Date(now);
    reminderTime.setHours(hours, minutes, 0, 0);

    // If the reminder time has passed today and we haven't sent it yet
    if (now >= reminderTime && lastSent[slot] !== today) {
      showNotification(slot).then(sent => {
        if (sent) {
          lastSent[slot] = today;
          saveLastSentDates(lastSent);
        }
      });
    }
  }
}

/**
 * Schedule the next reminder timer.
 * Called after checking missed reminders.
 */
let activeTimers = [];

export function scheduleReminders() {
  // Clear existing timers
  activeTimers.forEach(id => clearTimeout(id));
  activeTimers = [];

  const settings = loadSettings();
  const now = new Date();

  for (const [slot, config] of Object.entries(settings.reminders)) {
    if (!config.enabled || !config.time) continue;

    const nextTime = getNextOccurrence(config.time);
    if (!nextTime) continue;

    const delay = nextTime.getTime() - now.getTime();
    const timerId = setTimeout(() => {
      showNotification(slot).then(sent => {
        if (sent) {
          const lastSent = getLastSentDates();
          lastSent[slot] = todayString();
          saveLastSentDates(lastSent);
        }
        // Reschedule for the next day
        scheduleReminders();
      });
    }, delay);

    activeTimers.push(timerId);
  }
}

/**
 * Initialize the reminder system.
 * Call this once on app startup.
 */
export function initReminders() {
  // Check for missed reminders immediately
  checkMissedReminders();

  // Schedule future reminders
  scheduleReminders();

  // Re-check on visibility change (app resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkMissedReminders();
      scheduleReminders();
    }
  });
}

/**
 * Delay a repeat of the most recent reminder ("Påminn senare").
 *
 * Best-effort by design: the timer lives in this window, so it only fires while
 * the app stays open. The service worker cannot hold a long timer of its own —
 * it posts `{type:'REMINDER_SNOOZE'}` to any open client instead, which is what
 * lands here. Documented in README "Påminnelser".
 *
 * @param {number} [minutes]
 * @param {string} [slot] which slot's label to show
 * @returns {number} timer id (tracked so `scheduleReminders()` can clear it)
 */
export function scheduleSnooze(minutes = SNOOZE_MINUTES, slot = 'evening') {
  const delay = Math.max(0, Number(minutes) || 0) * 60_000;
  const timerId = setTimeout(() => {
    showNotification(slot);
  }, delay);
  activeTimers.push(timerId);
  return timerId;
}

/**
 * Handle snooze requests posted by the service worker. Call once at startup.
 * A no-op when service workers are unavailable (private mode, unsupported).
 */
export function initSnoozeListener() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event && event.data;
    if (data && data.type === 'REMINDER_SNOOZE') {
      scheduleSnooze(data.minutes, data.slot);
    }
  });
}
