/**
 * Hash-based route table.
 *
 * Hash routing rather than path routing is deliberate: the app ships as static
 * files that must work from any web root with no server rewrite rules (README,
 * "Publicering"). Path routing (`/settings`) would require every host to add an
 * SPA fallback; `/#settings` needs nothing.
 *
 * The URL is untrusted input, so `routeFromLocation()` can only ever return one
 * of four literal view ids — anything unknown collapses to 'home'.
 */

/** View id → hash fragment. `home` is the empty hash. */
export const HASH_FOR_VIEW = {
  home: '',
  prayer: '#prayer',
  settings: '#settings',
  sources: '#sources',
};

// A Map (not a plain object) so hostile fragments like `#__proto__` or
// `#constructor` cannot resolve to inherited properties instead of 'home'.
// NOTE the inversion: Object.entries yields [view, hash], so it must be flipped
// to [hash, view] or every lookup misses and falls through to 'home'.
const VIEW_FOR_HASH = new Map(
  Object.entries(HASH_FOR_VIEW).map(([view, hash]) => [hash, view]),
);

/**
 * Resolve a location hash to a known view id.
 *
 * @param {string} [hash] defaults to `window.location.hash`
 * @returns {'home' | 'prayer' | 'settings' | 'sources'}
 */
export function routeFromLocation(hash = window.location.hash) {
  const key = hash === '#' ? '' : hash;
  return VIEW_FOR_HASH.get(key) || 'home';
}

/**
 * The hash a view should occupy, or `null` if the view is not routable.
 * @param {string} view
 * @returns {string | null}
 */
export function hashForView(view) {
  return Object.prototype.hasOwnProperty.call(HASH_FOR_VIEW, view) ? HASH_FOR_VIEW[view] : null;
}

/**
 * Subscribe to route changes (in-app hash writes and Back/Forward).
 * @param {(view: 'home'|'prayer'|'settings'|'sources') => void} cb
 */
export function onRouteChange(cb) {
  window.addEventListener('hashchange', () => cb(routeFromLocation()));
}
