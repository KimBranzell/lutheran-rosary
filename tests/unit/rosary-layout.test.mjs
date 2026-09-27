import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beadPositions, ROSARY_LAYOUT, VIEW } from '../../src/ui/rosary-visual.js';

const beads = beadPositions();
const byId = Object.fromEntries(beads.map((b) => [b.beadId, b]));

/** Angle of a loop bead around the ellipse, in degrees. */
function loopAngle(bead) {
  const { LOOP } = ROSARY_LAYOUT;
  const x = (bead.cx - LOOP.cx) / LOOP.rx;
  const y = (bead.cy - LOOP.cy) / LOOP.ry;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function loopBeads() {
  return beads
    .filter((b) => /^decade-\d-(pater|bead-\d+)$/.test(b.beadId))
    .map((b) => ({ ...b, angle: loopAngle(b) }))
    .sort((a, b) => a.angle - b.angle);
}

test('rosary exposes 62 addressable elements', () => {
  assert.equal(beads.length, 62);
});

test('bead ids are unique', () => {
  const ids = beads.map((b) => b.beadId);
  assert.equal(new Set(ids).size, ids.length);
});

test('the loop has five large decade beads and fifty small decade beads', () => {
  const large = beads.filter((b) => /^decade-\d-pater$/.test(b.beadId));
  const small = beads.filter((b) => /^decade-\d-bead-\d+$/.test(b.beadId));
  assert.equal(large.length, 5);
  assert.equal(small.length, 50);
  assert.deepEqual(
    large.map((b) => b.beadId),
    ['decade-0-pater', 'decade-1-pater', 'decade-2-pater', 'decade-3-pater', 'decade-4-pater'],
  );
});

test('the pendant runs Cross -> 1 bead -> 3 beads -> 1 bead -> Emblem', () => {
  // Order in the data is medallion -> crucifix (top to bottom).
  assert.equal(byId.medal.kind, 'medal');
  assert.equal(byId['pater-2'].kind, 'large');
  assert.equal(byId['pater-1'].kind, 'large');
  for (const id of ['intro-1', 'intro-2', 'intro-3']) {
    assert.equal(byId[id].kind, 'small');
  }
  assert.equal(byId.crucifix.kind, 'crucifix');

  // Pendant order top to bottom: medal, pater-2, intro-3, intro-2, intro-1, pater-1, cross
  const order = ['medal', 'pater-2', 'intro-3', 'intro-2', 'intro-1', 'pater-1', 'crucifix'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(
      byId[order[i]].cy > byId[order[i - 1]].cy,
      `${order[i]} should sit below ${order[i - 1]}`,
    );
  }
  // The three small beads are grouped closely between the two large ones.
  assert.ok(byId['pater-2'].cy < byId['intro-3'].cy);
  assert.ok(byId['intro-1'].cy < byId['pater-1'].cy);
});

test('every bead lies inside the viewBox', () => {
  for (const bead of beads) {
    if (bead.kind === 'crucifix') {
      const top = bead.cy - ROSARY_LAYOUT.CRUCIFIX.height / 2;
      const bottom = bead.cy + ROSARY_LAYOUT.CRUCIFIX.height / 2;
      assert.ok(top >= 0, `crucifix top ${top}`);
      assert.ok(bottom <= VIEW.height, `crucifix bottom ${bottom}`);
      continue;
    }
    assert.ok(bead.cx - bead.r >= 0, `${bead.beadId} left edge`);
    assert.ok(bead.cx + bead.r <= VIEW.width, `${bead.beadId} right edge`);
    assert.ok(bead.cy - bead.r >= 0, `${bead.beadId} top edge`);
    assert.ok(bead.cy + bead.r <= VIEW.height, `${bead.beadId} bottom edge`);
  }
});

test('loop decade large beads are bigger than loop decade small beads', () => {
  assert.ok(byId['decade-0-pater'].r > byId['decade-0-bead-1'].r);
});

test('large loop beads stand apart: every gap touching a large bead exceeds any small-small gap', () => {
  const loop = loopBeads();
  const gaps = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    let delta = (b.angle - a.angle + 360) % 360;
    gaps.push({ delta, touchesLarge: a.kind === 'large' || b.kind === 'large' });
  }
  // Drop the single largest gap (the medallion seam).
  const maxDelta = Math.max(...gaps.map((g) => g.delta));
  const seamIndex = gaps.findIndex((g) => g.delta === maxDelta);
  const considered = gaps.filter((_, i) => i !== seamIndex);

  const smallSmall = considered.filter((g) => !g.touchesLarge).map((g) => g.delta);
  const touching = considered.filter((g) => g.touchesLarge).map((g) => g.delta);

  assert.ok(smallSmall.length > 0, 'expected small-small gaps');
  assert.ok(touching.length > 0, 'expected gaps touching large beads');
  assert.ok(
    Math.min(...touching) > Math.max(...smallSmall),
    `large-bead gaps (min ${Math.min(...touching).toFixed(2)}) should exceed small-small gaps (max ${Math.max(...smallSmall).toFixed(2)})`,
  );
});
