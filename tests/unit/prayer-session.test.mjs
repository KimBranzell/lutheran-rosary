import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, SessionState } from '../../src/prayer/build-session.js';

// Mock scripture data
const mockScriptureData = {
  'LUK_1_26-38': { displayRef: 'Lukasevangeliet 1:26-38', text: 'Test passage 1' },
  'LUK_1_39-45': { displayRef: 'Lukasevangeliet 1:39-45', text: 'Test passage 2' },
  'LUK_2_1-20': { displayRef: 'Lukasevangeliet 2:1-20', text: 'Test passage 3' },
  'LUK_2_22-38': { displayRef: 'Lukasevangeliet 2:22-38', text: 'Test passage 4' },
  'LUK_2_41-50': { displayRef: 'Lukasevangeliet 2:41-50', text: 'Test passage 5' },
  'MAT_3_13-16': { displayRef: 'Matteusevangeliet 3:13-16', text: 'Test passage 6' },
  'JHN_2_1-11': { displayRef: 'Johannesevangeliet 2:1-11', text: 'Test passage 7' },
  'MRK_1_14-15': { displayRef: 'Markusevangeliet 1:14-15', text: 'Test passage 8' },
  'MAT_17_1-8': { displayRef: 'Matteusevangeliet 17:1-8', text: 'Test passage 9' },
  'LUK_22_14-20': { displayRef: 'Lukasevangeliet 22:14-20', text: 'Test passage 10' },
  'LUK_22_39-46': { displayRef: 'Lukasevangeliet 22:39-46', text: 'Test passage 11' },
  'MAT_27_26': { displayRef: 'Matteusevangeliet 27:26', text: 'Test passage 12' },
  'MAT_27_27-31': { displayRef: 'Matteusevangeliet 27:27-31', text: 'Test passage 13' },
  'MAT_27_32': { displayRef: 'Matteusevangeliet 27:32', text: 'Test passage 14' },
  'JHN_19_25-30': { displayRef: 'Johannesevangeliet 19:25-30', text: 'Test passage 15' },
  'MRK_16_1-7': { displayRef: 'Markusevangeliet 16:1-7', text: 'Test passage 16' },
  'LUK_24_45-53': { displayRef: 'Lukasevangeliet 24:45-53', text: 'Test passage 17' },
  'ACT_2_1-7': { displayRef: 'Apostlagärningarna 2:1-7', text: 'Test passage 18' },
  '1CO_12_23-27': { displayRef: 'Första Korintierbrevet 12:23-27', text: 'Test passage 19' },
  'REV_21_1-4': { displayRef: 'Uppenbarelseboken 21:1-4', text: 'Test passage 20' },
  'LUK_1_46-55': { displayRef: 'Lukasevangeliet 1:46-55', text: 'Magnificat text' },
};

test('buildSession returns exactly 86 steps', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData); // Monday
  assert.equal(steps.length, 86, 'Session should have exactly 86 steps');
});

test('buildSession with jesuBoen also returns 86 steps', () => {
  const steps = buildSession('jesuBoen', 4, mockScriptureData); // Thursday
  assert.equal(steps.length, 86, 'Session should have exactly 86 steps');
});

test('opening order is sign, creed, ourFather, 3 beads, doxology, fatima', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const openingKinds = steps.slice(0, 8).map(s => s.kind);
  assert.deepEqual(openingKinds, [
    'sign', 'creed', 'ourFather', 'bead', 'bead', 'bead', 'doxology', 'fatima',
  ]);
});

test('exactly one Fatima step is the opening one (no decadeIndex)', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const fatimaSteps = steps.filter(s => s.kind === 'fatima');
  assert.equal(fatimaSteps.length, 6, 'one opening + five decade Fatima steps');
  assert.equal(fatimaSteps.filter(s => s.decadeIndex === undefined).length, 1);
  assert.equal(fatimaSteps.filter(s => s.decadeIndex !== undefined).length, 5);
});

test('no user-facing string contains the English word "mystery"/"mysteries"', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  for (const step of steps) {
    assert.ok(!/\bmyster(y|ies)\b/i.test(step.title || ''), `title "${step.title}"`);
    assert.ok(!/\bmyster(y|ies)\b/i.test(step.body || ''), `body "${step.body}"`);
  }
});

test('each decade is announced with the Swedish term "Mysterium"', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const announcements = steps.filter((s) => s.kind === 'announcement');
  assert.equal(announcements.length, 5);
  announcements.forEach((step, i) => {
    assert.match(step.body, new RegExp(`^Mysterium ${i + 1} av 5 — `));
  });
});

test('the Jesus Prayer is prayed in full on every bead', () => {
  const steps = buildSession('jesuBoen', 1, mockScriptureData);
  const beads = steps.filter((s) => s.kind === 'bead');
  assert.equal(beads.length, 53, '3 intro + 50 decade beads');
  for (const bead of beads) {
    assert.equal(bead.body, 'Herre Jesus Kristus, Guds son, förbarma dig över mig, syndare.');
  }
});

test('Trosbekännelsen and Fader Vår are split into paragraphs', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const creed = steps.find((s) => s.kind === 'creed');
  const pater = steps.find((s) => s.kind === 'ourFather');

  for (const [label, step] of [['creed', creed], ['our father', pater]]) {
    const paragraphs = step.body.split('\n\n');
    assert.ok(paragraphs.length >= 3, `${label} should have at least 3 paragraphs`);
    assert.ok(!/\n\n\n/.test(step.body), `${label} should not have blank paragraph runs`);
    for (const p of paragraphs) {
      assert.equal(p, p.trim(), `${label} paragraph should be trimmed`);
      assert.ok(p.length > 0, `${label} paragraph should not be empty`);
    }
  }
});

test('the sign of the cross carries the decorative cross mark', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const signs = steps.filter((s) => s.kind === 'sign');
  assert.equal(signs.length, 2, 'opening and closing sign');
  for (const sign of signs) {
    assert.equal(sign.symbol, 'cross');
  }
  const others = steps.filter((s) => s.kind !== 'sign');
  assert.ok(others.every((s) => s.symbol === undefined), 'only the sign steps carry a symbol');
});

test('closing Magnificat uses the owner-supplied shortened text', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const magn = steps.find((s) => s.kind === 'magnificat');
  assert.equal(magn.title, 'Magnificat');
  assert.equal(magn.scriptureRef, 'Lukasevangeliet 1:46-55');
  assert.equal(
    magn.body,
    'Min själ upphöjer Herren, och min ande jublade över Gud, min Frälsare! För han har sett sin tjänarinnas låga status. Se, från denna stund ska alla släkten kalla mig välsignad. För den Mäktige har gjort stora ting för mig, och heligt är hans namn. Hans barmhärtighet är över dem som fruktar honom från släkte till släkte.',
  );
  // Must not depend on the extracted Luke 1:46-55 passage.
  assert.notEqual(magn.body, mockScriptureData['LUK_1_46-55'].text);
});

test('first step is Korsets tecken', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  assert.equal(steps[0].kind, 'sign');
  assert.equal(steps[0].title, 'Korsets tecken');
});

test('last step is Korsets tecken with isComplete flag', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const lastStep = steps[steps.length - 1];
  assert.equal(lastStep.kind, 'sign');
  assert.equal(lastStep.title, 'Korsets tecken');
  assert.equal(lastStep.isComplete, true);
});

test('SessionState navigation works correctly', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);
  const session = new SessionState(steps);

  assert.equal(session.currentIndex, 0);
  assert.equal(session.isFirst, true);
  assert.equal(session.isLast, false);

  session.next();
  assert.equal(session.currentIndex, 1);
  assert.equal(session.isFirst, false);

  session.previous();
  assert.equal(session.currentIndex, 0);
  assert.equal(session.isFirst, true);

  // Navigate to end
  for (let i = 0; i < 85; i++) {
    session.next();
  }
  assert.equal(session.currentIndex, 85);
  assert.equal(session.isLast, true);
  assert.equal(session.isComplete, true);
});

test('each decade has 15 steps', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);

  // Count steps per decade
  const decadeSteps = steps.filter(s => s.decadeIndex !== undefined);
  assert.equal(decadeSteps.length, 75, 'Should have 75 decade steps (15 per decade × 5)');

  // Verify each decade has exactly 15 steps
  for (let d = 0; d < 5; d++) {
    const decadeCount = decadeSteps.filter(s => s.decadeIndex === d).length;
    assert.equal(decadeCount, 15, `Decade ${d} should have 15 steps`);
  }
});

test('bead prayers use correct form (short for intro, full for decades)', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);

  // Intro beads (steps 3-5) should use short form
  const introBeads = steps.filter(s => s.beadId && s.beadId.startsWith('intro-'));
  for (const bead of introBeads) {
    assert.equal(bead.body, 'Var hälsad, Maria, full av nåd. Herren är med dig.');
  }

  // Decade beads should use full form
  const decadeBeads = steps.filter(s => s.beadId && s.beadId.includes('decade') && s.beadId.includes('bead'));
  for (const bead of decadeBeads) {
    assert.equal(bead.body, 'Var hälsad, Maria, full av nåd. Herren är med dig. Välsignad är du bland kvinnor, och välsignad är din livsfrukt, Jesus.');
  }
});

test('mystery announcement comes before reading in each decade', () => {
  const steps = buildSession('aveMaria', 1, mockScriptureData);

  for (let d = 0; d < 5; d++) {
    const decadeSteps = steps.filter(s => s.decadeIndex === d);
    const announcementIdx = decadeSteps.findIndex(s => s.kind === 'announcement');
    const readingIdx = decadeSteps.findIndex(s => s.kind === 'reading');

    assert.ok(announcementIdx >= 0, `Decade ${d} should have an announcement`);
    assert.ok(readingIdx >= 0, `Decade ${d} should have a reading`);
    assert.ok(announcementIdx < readingIdx, `Announcement should come before reading in decade ${d}`);
  }
});
