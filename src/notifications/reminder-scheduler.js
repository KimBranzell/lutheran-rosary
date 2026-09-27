/**
 * Best-effort local reminders: timers fire while the app is open, and missed
 * slots are caught up on the next start or resume. No push, no background sync,
 * and no guarantee of delivery while the app is closed.
 */

import { loadSettings } from '../ui/home-view.js';

const STORAGE_KEY_LAST_SENT = 'luthers-rosenkrans-reminder-last-sent';
const NOTIFICATION_TITLE = 'Tid för bön';
const NOTIFICATION_BODY = 'Ta en stund för rosenkransen.';

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
async function showNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(NOTIFICATION_TITLE, {
      body: NOTIFICATION_BODY,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'rosary-reminder',
      vibrate: [200, 100, 200],
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
      showNotification().then(sent => {
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
      showNotification().then(sent => {
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
