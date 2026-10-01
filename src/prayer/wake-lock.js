/**
 * Screen Wake Lock — keeps the display on during a prayer session.
 *
 * A dimming screen mid-session is the most likely real-world annoyance for an
 * 86-step session, so the lock is requested when the prayer view mounts and
 * released when it is torn down or the app is backgrounded.
 *
 * Everything degrades silently: on a browser without the API, or when the OS
 * refuses (battery saver, low power, hidden document), nothing is exposed to the
 * user — there is deliberately no UI, so no promise is made that can break.
 *
 * The lock is a transient resource: it is dropped whenever the document becomes
 * hidden, so it must be re-acquired on `visibilitychange` (per the spec) while a
 * session is still wanted.
 */

/** @type {WakeLockSentinel|null} */
let sentinel = null;
let wanted = false;

/** @returns {boolean} */
export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function acquire() {
  if (!wanted || !isWakeLockSupported()) return false;
  if (sentinel) return true;
  // The spec rejects with NotAllowedError while the document is hidden.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;

  try {
    const lock = await navigator.wakeLock.request('screen');
    sentinel = lock;
    lock.addEventListener('release', () => {
      // Only clear our own reference — a later lock may already be installed.
      if (sentinel === lock) sentinel = null;
    });
    return true;
  } catch (err) {
    // NotAllowedError (power saving / OS policy) and friends are expected here.
    console.warn('Screen wake lock unavailable:', err);
    return false;
  }
}

async function release() {
  const lock = sentinel;
  sentinel = null;
  if (!lock) return;
  try {
    await lock.release();
  } catch {
    // Already released, or the browser refused — nothing to do.
  }
}

/**
 * Declare whether a wake lock is wanted from now on.
 * @param {boolean} next
 */
export async function setWakeLockWanted(next) {
  wanted = Boolean(next);
  if (wanted) {
    await acquire();
  } else {
    await release();
  }
}

/** @returns {boolean} whether a lock is currently held (for tests/diagnostics) */
export function isWakeLockHeld() {
  return sentinel !== null;
}

/**
 * Re-acquire after the app returns to the foreground, if a session still wants
 * it. Call once at bootstrap.
 */
export function initWakeLockReacquire() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') {
      acquire();
    }
  });
}
