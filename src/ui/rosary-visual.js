/**
 * Rosary loop SVG. Read upwards from the crucifix the pendant is: one large
 * bead, three small beads, one large bead, then the medallion. Large beads get
 * extra angular room so each decade bead stands apart from its group of ten.
 * Decorative (`aria-hidden`); position is announced by the live status instead.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export const VIEW = { width: 340, height: 440 };

const LOOP = { cx: 170, cy: 150, rx: 140, ry: 118 };
const GAP_DEG = 26;
const LOOP_BEAD_COUNT = 55;
const LOOP_LARGE_R = 9.6;
const LOOP_SMALL_R = 5.8;
/** Large beads occupy this many angular units; small beads occupy 1. */
const LARGE_SLOT_WEIGHT = 3;

const MEDALLION = { cx: 170, cy: 268, r: 13 };

// Pendant, medallion → crucifix. Prayer order is the reverse (crucifix → medallion).
const PENDANT_BEADS = [
  { beadId: 'pater-2', cx: 170, cy: 294, r: 11, kind: 'large' },
  { beadId: 'intro-3', cx: 170, cy: 316, r: 6.5, kind: 'small' },
  { beadId: 'intro-2', cx: 170, cy: 331, r: 6.5, kind: 'small' },
  { beadId: 'intro-1', cx: 170, cy: 346, r: 6.5, kind: 'small' },
  { beadId: 'pater-1', cx: 170, cy: 374, r: 11, kind: 'large' },
];

const CRUCIFIX = { cx: 170, cy: 414, width: 24, height: 38 };

/**
 * Ordered, addressable bead list.
 * 62 entries: medallion + 55 loop beads + 5 pendant beads + crucifix.
 *
 * @returns {Array<{beadId: string, cx: number, cy: number, r: number, kind: string}>}
 */
export function beadPositions() {
  const beads = [
    { beadId: 'medal', cx: MEDALLION.cx, cy: MEDALLION.cy, r: MEDALLION.r, kind: 'medal' },
  ];

  const weights = [];
  for (let i = 0; i < LOOP_BEAD_COUNT; i++) {
    weights.push(i % 11 === 0 ? LARGE_SLOT_WEIGHT : 1);
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const sweep = 360 - GAP_DEG;
  const startDeg = 90 + GAP_DEG / 2;

  let cumulative = 0;
  for (let i = 0; i < LOOP_BEAD_COUNT; i++) {
    const isLarge = i % 11 === 0;
    const weight = weights[i];
    // Each bead sits at the centre of its angular slot.
    const centreUnit = cumulative + weight / 2;
    const theta = ((startDeg + (centreUnit / totalWeight) * sweep) * Math.PI) / 180;

    const cx = LOOP.cx + LOOP.rx * Math.cos(theta);
    const cy = LOOP.cy + LOOP.ry * Math.sin(theta);
    const decade = Math.floor(i / 11);

    beads.push({
      beadId: isLarge ? `decade-${decade}-pater` : `decade-${decade}-bead-${i % 11}`,
      cx,
      cy,
      r: isLarge ? LOOP_LARGE_R : LOOP_SMALL_R,
      kind: isLarge ? 'large' : 'small',
    });

    cumulative += weight;
  }

  for (const bead of PENDANT_BEADS) {
    beads.push({ ...bead });
  }

  beads.push({ beadId: 'crucifix', cx: CRUCIFIX.cx, cy: CRUCIFIX.cy, r: 0, kind: 'crucifix' });

  return beads;
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

/**
 * Build the rosary SVG element.
 * @returns {SVGSVGElement}
 */
export function buildRosarySvg() {
  const svg = el('svg', {
    class: 'rosary',
    viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
    width: VIEW.width,
    height: VIEW.height,
    xmlns: SVG_NS,
    'aria-hidden': 'true',
    focusable: 'false',
  });

  // Cord behind the beads
  svg.appendChild(el('ellipse', {
    class: 'cord',
    cx: LOOP.cx,
    cy: LOOP.cy,
    rx: LOOP.rx,
    ry: LOOP.ry,
  }));
  svg.appendChild(el('line', {
    class: 'cord',
    x1: MEDALLION.cx,
    y1: MEDALLION.cy,
    x2: MEDALLION.cx,
    y2: CRUCIFIX.cy - CRUCIFIX.height / 2,
  }));

  // Medallion (addressable, but no prayer is bound to it)
  svg.appendChild(el('circle', {
    class: 'bead medallion',
    'data-bead': 'medal',
    'data-r': MEDALLION.r,
    cx: MEDALLION.cx,
    cy: MEDALLION.cy,
    r: MEDALLION.r,
  }));
  svg.appendChild(el('circle', { class: 'medallion-inner', cx: MEDALLION.cx, cy: MEDALLION.cy, r: 8 }));
  svg.appendChild(el('circle', { class: 'medallion-mark', cx: MEDALLION.cx, cy: MEDALLION.cy, r: 1.8 }));

  // Loop and pendant beads
  for (const bead of beadPositions()) {
    if (bead.kind === 'medal' || bead.kind === 'crucifix') continue;
    svg.appendChild(el('circle', {
      class: bead.kind === 'large' ? 'bead bead--large' : 'bead',
      'data-bead': bead.beadId,
      'data-r': bead.r,
      cx: bead.cx.toFixed(2),
      cy: bead.cy.toFixed(2),
      r: bead.r,
    }));
  }

  // Crucifix
  const cross = el('g', { class: 'bead-cross', 'data-bead': 'crucifix' });
  cross.appendChild(el('rect', {
    class: 'crucifix',
    x: CRUCIFIX.cx - 3.5,
    y: CRUCIFIX.cy - CRUCIFIX.height / 2,
    width: 7,
    height: CRUCIFIX.height,
    rx: 1.5,
  }));
  cross.appendChild(el('rect', {
    class: 'crucifix',
    x: CRUCIFIX.cx - 12,
    y: CRUCIFIX.cy - CRUCIFIX.height / 2 + 10,
    width: 24,
    height: 6.5,
    rx: 1.5,
  }));
  svg.appendChild(cross);

  // Halo for the active bead, kept last so it renders on top
  svg.appendChild(el('circle', { class: 'bead-halo', cx: 0, cy: 0, r: 0 }));

  return svg;
}

/**
 * Update the highlighted/complete state of the rosary.
 *
 * @param {SVGSVGElement} svg element returned by buildRosarySvg()
 * @param {string|null} activeBeadId
 * @param {Iterable<string>} [completedBeadIds]
 */
export function highlightBead(svg, activeBeadId, completedBeadIds = []) {
  if (!svg) return;
  const completed = new Set(completedBeadIds);
  const halo = svg.querySelector('.bead-halo');

  svg.querySelectorAll('.bead, .bead-cross').forEach((node) => {
    node.classList.remove('is-active', 'is-complete');
    const id = node.getAttribute('data-bead');
    if (id === activeBeadId) {
      node.classList.add('is-active');
    } else if (completed.has(id)) {
      node.classList.add('is-complete');
    }
  });

  // Reset every bead radius, then enlarge the active one.
  svg.querySelectorAll('circle.bead').forEach((circle) => {
    circle.setAttribute('r', circle.getAttribute('data-r'));
  });

  const active = activeBeadId
    ? svg.querySelector(`[data-bead="${CSS.escape(String(activeBeadId))}"]`)
    : null;

  if (active && halo) {
    // Bring the active bead to the front (just beneath the halo).
    svg.insertBefore(active, halo);
  }

  if (active && active.tagName.toLowerCase() === 'circle' && halo) {
    const baseR = parseFloat(active.getAttribute('data-r'));
    active.setAttribute('r', (baseR * 1.35).toFixed(2));
    halo.setAttribute('cx', active.getAttribute('cx'));
    halo.setAttribute('cy', active.getAttribute('cy'));
    halo.setAttribute('r', (baseR * 1.8).toFixed(2));
    halo.classList.add('is-visible');
  } else if (halo) {
    halo.classList.remove('is-visible');
  }
}

export const ROSARY_LAYOUT = {
  VIEW,
  LOOP,
  MEDALLION,
  CRUCIFIX,
  LOOP_BEAD_COUNT,
  LARGE_SLOT_WEIGHT,
  GAP_DEG,
};
