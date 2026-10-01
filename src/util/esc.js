/**
 * Escape a value for safe interpolation into an HTML template literal.
 *
 * The whole app renders with `innerHTML`, so every interpolated value must go
 * through this. It previously existed as three hand-copied definitions
 * (`home-view.js`, `settings-view.js`, `licensing.js`); keeping one copy means a
 * future fix cannot be applied to two of the three by mistake.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
