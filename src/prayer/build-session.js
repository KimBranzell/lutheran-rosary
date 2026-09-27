/**
 * Builds the flat prayer sequence for one rosary session (86 steps).
 *
 * Pendant, upwards from the crucifix: korsets tecken, trosbekännelsen,
 * Fader Vår (pater-1), three bead prayers (intro-1..3), Ära vare and
 * Fatimabönen (pater-2).
 * Each decade: announcement, reading, Fader Vår, ten bead prayers, Ära vare,
 * Fatimabönen. Closing: Magnificat, Ave Maria, korsets tecken.
 */

import { korsetsTecken, trosbekannelsen, faderVar, araVare, fatimaboen, closingAveMaria, magnificat, aveMaria, jesuboen } from '../data/prayer-texts.js';
import { getMysterySetForDay, passageId } from '../data/mystery-catalog.js';

/**
 * @param {'aveMaria' | 'jesuBoen'} prayerChoice
 * @param {number} dayOfWeek 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param {object} scriptureData - loaded scripture-passages.json
 * @returns {Array<object>} flat array of 86 steps
 */
export function buildSession(prayerChoice, dayOfWeek, scriptureData) {
  const steps = [];
  let stepIndex = 0;

  // Helper to add a step
  function addStep(step) {
    steps.push({ ...step, index: stepIndex++ });
  }

  // Get the prayer texts based on choice
  const beadPrayer = prayerChoice === 'jesuBoen' ? jesuboen : aveMaria;

  // Get mystery set for today
  const mysterySet = getMysterySetForDay(dayOfWeek);

  // ── Opening (8 steps) — pendant: crucifix → pater-1 → 3 beads → pater-2 → medallion ──
  addStep({ kind: 'sign', title: korsetsTecken.title, body: korsetsTecken.body, symbol: korsetsTecken.symbol, beadId: 'crucifix' });
  // The Creed is prayed at the crucifix, so the highlight starts at the cross
  // and moves up the pendant towards the medallion.
  addStep({ kind: 'creed', title: trosbekannelsen.title, body: trosbekannelsen.body, beadId: 'crucifix' });
  addStep({ kind: 'ourFather', title: faderVar.title, body: faderVar.body, beadId: 'pater-1', beadType: 'large' });

  // 3 introductory bead prayers. The Ave Maria uses its shortened form here;
  // the Jesus Prayer is prayed in full on every bead.
  for (let i = 0; i < 3; i++) {
    addStep({
      kind: 'bead',
      title: beadPrayer.title,
      body: beadPrayer.short,
      beadId: `intro-${i + 1}`,
      beadType: 'small',
    });
  }

  // Second pendant bead, adjacent to the medallion
  addStep({ kind: 'doxology', title: araVare.title, body: araVare.body, beadId: 'pater-2', beadType: 'large' });

  // Opening Fatimabönen — the cited Lutheran order prays it after the opening doxology
  addStep({ kind: 'fatima', title: fatimaboen.title, body: fatimaboen.body, beadId: 'pater-2' });

  // ── 5 decades (15 steps each = 75 steps) ──
  for (let decade = 0; decade < 5; decade++) {
    const mystery = mysterySet.mysteries[decade];

    // Mystery announcement
    addStep({
      kind: 'announcement',
      title: mystery.title,
      body: `Hemlighet ${decade + 1} av 5 — ${mysterySet.name}`,
      decadeIndex: decade,
      beadId: null,
    });

    // Scripture reading
    const refId = passageId(mystery.ref);
    const passage = scriptureData[refId];
    if (passage) {
      addStep({
        kind: 'reading',
        title: passage.displayRef,
        body: passage.text,
        decadeIndex: decade,
        scriptureRef: passage.displayRef,
        beadId: null,
      });
    }

    // Our Father (decade opening bead)
    addStep({
      kind: 'ourFather',
      title: faderVar.title,
      body: faderVar.body,
      decadeIndex: decade,
      beadId: `decade-${decade}-pater`,
      beadType: 'large',
    });

    // 10 bead prayers (full form)
    for (let b = 0; b < 10; b++) {
      addStep({
        kind: 'bead',
        title: beadPrayer.title,
        body: beadPrayer.full,
        decadeIndex: decade,
        beadId: `decade-${decade}-bead-${b + 1}`,
        beadType: 'small',
      });
    }

    // Doxology
    addStep({
      kind: 'doxology',
      title: araVare.title,
      body: araVare.body,
      decadeIndex: decade,
      beadId: null,
    });

    // Fatimabönen
    addStep({
      kind: 'fatima',
      title: fatimaboen.title,
      body: fatimaboen.body,
      decadeIndex: decade,
      beadId: null,
    });
  }

  // ── Closing (3 steps) ──
  addStep({
    kind: 'magnificat',
    title: magnificat.title,
    body: magnificat.body,
    scriptureRef: magnificat.reference,
    beadId: null,
  });

  addStep({
    kind: 'closingAve',
    title: closingAveMaria.title,
    body: closingAveMaria.body,
    beadId: null,
  });

  addStep({
    kind: 'sign',
    title: korsetsTecken.title,
    body: korsetsTecken.body,
    symbol: korsetsTecken.symbol,
    beadId: 'crucifix',
    isComplete: true,
  });

  return steps;
}

/**
 * Session state manager.
 */
export class SessionState {
  constructor(steps) {
    this.steps = steps;
    this.currentIndex = 0;
  }

  get current() {
    return this.steps[this.currentIndex];
  }

  get isFirst() {
    return this.currentIndex === 0;
  }

  get isLast() {
    return this.currentIndex === this.steps.length - 1;
  }

  get isComplete() {
    return this.current?.isComplete === true;
  }

  next() {
    if (!this.isLast) this.currentIndex++;
    return this.current;
  }

  previous() {
    if (!this.isFirst) this.currentIndex--;
    return this.current;
  }

  get progress() {
    return `${this.currentIndex + 1} av ${this.steps.length}`;
  }
}
