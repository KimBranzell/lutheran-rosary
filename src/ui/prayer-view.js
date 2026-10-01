/**
 * Prayer view — active prayer screen with the full rosary loop.
 *
 * Renders the current step's title/body/reference, the rosary loop, a polite
 * live status, and persistent previous/continue controls.
 *
 * @returns {{ destroy: () => void }} teardown that detaches the container-level
 *   keydown listener; main.js must call it before rendering another view.
 */

import { buildSession, SessionState } from '../prayer/build-session.js';
import { saveProgress, clearProgress } from '../prayer/session-progress.js';
import { setWakeLockWanted } from '../prayer/wake-lock.js';
import { todayIso } from '../data/weekdays.js';
import { buildRosarySvg, highlightBead } from './rosary-visual.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Decorative cross mark for the sign of the cross, drawn as an inline SVG
 * (cross pattée) so it renders identically on every platform.
 */
function buildCrossMark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'cross-mark');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    'M7.5 1 H16.5 L13.5 10.5 L23 7.5 V16.5 L13.5 13.5 L16.5 23 H7.5 L10.5 13.5 L1 16.5 V7.5 L10.5 10.5 Z',
  );
  svg.appendChild(path);

  return svg;
}

/** Map a step's `symbol` token to a decorative element. */
function buildSymbol(token) {
  if (token === 'cross') return buildCrossMark();
  return null;
}

/** Swedish context label for the current step. */
function kickerFor(step, index, total) {
  if (step.decadeIndex !== undefined) {
    return `Mysterium ${step.decadeIndex + 1} av 5`;
  }
  if (index >= total - 3) {
    return 'Avslutning';
  }
  return 'Inledning';
}

/** Bead ids of every step before `upto` (used for the "completed" bead state). */
function completedBeadIds(steps, upto) {
  const ids = new Set();
  for (let i = 0; i < upto; i++) {
    if (steps[i].beadId) ids.add(steps[i].beadId);
  }
  return ids;
}

/**
 * @param {object} [options]
 * @param {number} [options.startIndex] 0-based step to resume at, clamped into
 *   range so a future step-count change can never produce an invalid index.
 */
export function renderPrayerView(container, settings, scriptureData, onExit, { startIndex = 0 } = {}) {
  const dayOfWeek = new Date().getDay();
  const steps = buildSession(settings.prayerChoice, dayOfWeek, scriptureData, settings.mysterySetId);
  const session = new SessionState(steps);

  const start = Number.isInteger(startIndex) ? startIndex : 0;
  session.currentIndex = Math.min(Math.max(0, start), steps.length - 1);

  container.innerHTML = `
    <section class="prayer-view" aria-labelledby="step-title">
      <div class="prayer-head">
        <p class="step-counter">Steg <span id="step-current">1</span> av <span id="step-total">${steps.length}</span></p>
        <button id="btn-exit" class="btn btn--ghost btn--sm" type="button" aria-label="Avsluta rosenkransen">Avsluta</button>
      </div>

      <div class="prayer-card card">
        <p class="prayer-card__kicker" id="step-kicker"></p>
        <h2 class="prayer-card__title" id="step-title" tabindex="-1"></h2>
        <p class="prayer-card__body" id="step-body"></p>
        <p class="prayer-card__ref" id="step-ref" hidden></p>
      </div>

      <div class="rosary-panel card" aria-hidden="true"></div>

      <p class="visually-hidden" id="prayer-status" role="status" aria-live="polite" aria-atomic="true"></p>

      <div class="prayer-nav">
        <button id="btn-prev" class="btn btn--ghost" type="button">Föregående</button>
        <button id="btn-next" class="btn btn--primary" type="button">Fortsätt</button>
      </div>
    </section>
  `;

  const svg = buildRosarySvg();
  container.querySelector('.rosary-panel').appendChild(svg);

  const titleEl = container.querySelector('#step-title');
  const bodyEl = container.querySelector('#step-body');
  const refEl = container.querySelector('#step-ref');
  const kickerEl = container.querySelector('#step-kicker');
  const currentEl = container.querySelector('#step-current');
  const statusEl = container.querySelector('#prayer-status');
  const btnPrev = container.querySelector('#btn-prev');
  const btnNext = container.querySelector('#btn-next');
  const btnExit = container.querySelector('#btn-exit');

  // Decorative sign-of-the-cross mark, inlined at the start of the prayer text.
  const crossMark = buildSymbol('cross');

  function updateView({ focusTitle = false } = {}) {
    const step = session.current;
    const index = step.index;
    const kicker = kickerFor(step, index, steps.length);

    kickerEl.textContent = kicker;
    titleEl.textContent = step.title;
    currentEl.textContent = index + 1;

    // Body text with an optional inline decorative symbol before it.
    bodyEl.replaceChildren();
    if (step.symbol && crossMark) {
      bodyEl.appendChild(crossMark);
    }
    bodyEl.appendChild(document.createTextNode(step.body));

    if (step.scriptureRef) {
      refEl.textContent = step.scriptureRef;
      refEl.hidden = false;
    } else {
      refEl.textContent = '';
      refEl.hidden = true;
    }

    highlightBead(svg, step.beadId || null, completedBeadIds(steps, index));

    btnPrev.disabled = session.isFirst;
    btnNext.textContent = session.isLast ? 'Avsluta' : 'Fortsätt';
    // Avoid two identically-named controls at the last step.
    btnExit.hidden = session.isLast;

    // When focus moves to the heading, let the heading carry the announcement
    // instead of also writing the live region (avoids a double announcement).
    if (focusTitle) {
      statusEl.textContent = '';
      titleEl.focus();
    } else {
      statusEl.textContent = `Steg ${index + 1} av ${steps.length}. ${kicker}. ${step.title}.`;
    }

    // Persist progress so an accidental refresh can resume. Step 0 has nothing
    // to resume to and the final step completes the session, so both clear.
    // ("Avsluta" deliberately keeps progress; only finishing step 86 drops it.)
    if (session.currentIndex === 0 || session.isComplete) {
      clearProgress();
    } else {
      saveProgress({
        index: session.currentIndex,
        prayerChoice: settings.prayerChoice,
        mysterySetId: settings.mysterySetId,
        date: todayIso(),
      });
    }
  }

  function goNext() {
    if (session.isLast) {
      onExit();
      return;
    }
    session.next();
    updateView({ focusTitle: session.isLast });
  }

  function goPrevious() {
    if (session.isFirst) return;
    session.previous();
    updateView();
  }

  btnPrev.addEventListener('click', goPrevious);
  btnNext.addEventListener('click', goNext);
  btnExit.addEventListener('click', onExit);

  // Arrow keys are handled once here. Space is intentionally NOT intercepted so
  // buttons never double-activate from a native click plus a synthetic one.
  //
  // `container` is the persistent <main id="app">, so this listener outlives the
  // view. It must be removed by destroy() or every enter/exit of the prayer view
  // stacks another handler bound to a stale SessionState and detached DOM nodes.
  function onKeydown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious();
    }
  }
  container.addEventListener('keydown', onKeydown);

  // Move focus into the view on entry so keyboard navigation (arrow keys) and
  // screen-reader announcement start from the step heading, not a removed button.
  updateView({ focusTitle: true });

  // Keep the screen awake while the session is on screen. Silently a no-op on
  // browsers without the Screen Wake Lock API — there is deliberately no UI.
  setWakeLockWanted(true);

  return {
    destroy() {
      container.removeEventListener('keydown', onKeydown);
      setWakeLockWanted(false);
    },
  };
}
