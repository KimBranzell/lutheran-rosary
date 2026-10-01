/**
 * In-app text size preference.
 *
 * Every font size and spacing value in the design tokens is expressed in `rem`,
 * so scaling the root font size scales the whole type scale *and* the spacing
 * rhythm together — gaps grow with the text instead of leaving cramped layout,
 * while values that must not shrink (`--min-target: 44px`, radii, focus widths)
 * are declared in `px` and are therefore untouched.
 *
 * Three steps rather than a free slider: WCAG 1.4.4 requires 200% without loss
 * of content, and a small, tested set of fixed steps is far easier to keep
 * verifiable at every liturgical colour theme.
 */

/** Supported scales, as multipliers of the user's browser default (16px). */
export const TEXT_SCALES = [1, 1.25, 1.5];

/**
 * @param {unknown} value
 * @returns {boolean} whether the value is one of the supported scales
 */
export function isValidTextScale(value) {
  return TEXT_SCALES.includes(value);
}

/**
 * Apply a scale to the document root.
 *
 * Invalid input falls back to 1 rather than leaving the page unstyled.
 *
 * @param {unknown} scale
 */
export function applyTextScale(scale) {
  if (typeof document === 'undefined') return;
  const value = isValidTextScale(scale) ? scale : 1;
  document.documentElement.style.fontSize = `${Math.round(value * 100)}%`;
}
