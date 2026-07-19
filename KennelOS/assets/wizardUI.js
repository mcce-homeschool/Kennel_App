// wizardUI.js — the guided-tour overlay/spotlight/tooltip, the nav "Take the
// tour" entry, and the "Resume tour" pill (Wizard Runtime Spec v1 §4-§7).
// The only module that touches wizard DOM; app.js's shared boot is the only
// caller (no page file imports anything from here — §7).
import {
  isTourAvailable, getWizardStatus, getWizardStepIndex, currentStep,
  startWizard, advanceWizard, retreatWizard, dismissWizard
} from '../data/wizardState.js';
import { WIZARD_STEPS } from '../data/wizardSteps.js';
import { confirmModal, alertModal, esc } from './ui.js';

function rootPrefix() {
  return location.pathname.includes('/pages/') ? '../' : '';
}

function currentFile() {
  const parts = location.pathname.split('/');
  return parts[parts.length - 1] || 'index.html';
}

function resolvePagePath(page) {
  return `${rootPrefix()}pages/${page}`;
}

function goToStep(step) {
  location.href = resolvePagePath(step.page);
}

// --- First offer -------------------------------------------------------
export async function maybeOfferWizardStart() {
  if (getWizardStatus() !== 'unseen') return;
  const start = await confirmModal({
    title: 'Take a guided tour?',
    message: 'Take a 2-minute guided tour of Thornfield Kennels — one idea per stop, ' +
      'across every hub. You can skip it any time and pick it back up later from the More menu.',
    confirmLabel: 'Start tour', cancelLabel: 'Not now'
  });
  if (!start) {
    dismissWizard();
    return;
  }
  startWizard();
  const step = currentStep();
  if (step.page.split('?')[0] === currentFile()) runWizardStep();
  else goToStep(step);
}

// --- Nav menu entry ------------------------------------------------------
export function renderWizardMenuEntry() {
  if (!isTourAvailable()) return;
  const menu = document.querySelector('.nav-more-menu');
  if (!menu) return;

  const status = getWizardStatus();
  const label = status === 'completed' ? '🧭 Retake the tour'
    : (status === 'active' && getWizardStepIndex() > 0) ? '🧭 Resume tour'
    : '🧭 Take the tour';

  const a = document.createElement('a');
  a.href = '#';
  a.className = 'nav-link';
  a.textContent = label;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (status !== 'active') startWizard();
    const step = currentStep();
    if (!step) return;
    if (step.page.split('?')[0] === currentFile()) runWizardStep();
    else goToStep(step);
  });
  menu.appendChild(a);
}

// --- Overlay / spotlight / tooltip ---------------------------------------
let mountedNodes = [];
let spotlightEl = null;

function teardown() {
  mountedNodes.forEach((n) => n.remove());
  mountedNodes = [];
  if (spotlightEl) {
    spotlightEl.classList.remove('wizard-spotlight-target');
    spotlightEl = null;
  }
}

function revealTarget(step) {
  if (!step.beforeShow?.openCard) return;
  const key = step.beforeShow.openCard;
  const btn = document.querySelector(`[data-card="${CSS.escape(key)}"] .card-toggle-btn`);
  const body = btn?.closest('.card-collapsible')?.querySelector('.card-body');
  if (btn && body && body.hidden) btn.click();
}

function positionTooltip(tip, target) {
  const rect = target.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let top = rect.bottom + 12;
  if (top + tipRect.height > window.innerHeight - 12) top = rect.top - tipRect.height - 12;
  top = Math.max(top, 12);
  let left = rect.left;
  left = Math.min(Math.max(left, 12), window.innerWidth - tipRect.width - 12);
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

const CLOSING_MESSAGE = 'That’s the whole spine, Reminders to Reports. Take the tour again any ' +
  'time from the More menu — and before you start adding your own records, back up your data from ' +
  'Import / Export.';

function goNext() {
  advanceWizard();
  if (getWizardStatus() !== 'active') {
    teardown();
    alertModal({ title: 'Tour complete', message: CLOSING_MESSAGE });
    return;
  }
  const step = currentStep();
  if (step.page.split('?')[0] === currentFile()) runWizardStep();
  else goToStep(step);
}

function goBack() {
  retreatWizard();
  const step = currentStep();
  if (step.page.split('?')[0] === currentFile()) runWizardStep();
  else goToStep(step);
}

function skip() {
  dismissWizard();
  teardown();
}

function mountTooltip(step, target) {
  const index = getWizardStepIndex();
  const total = WIZARD_STEPS.length;
  const isLast = index === total - 1;
  const next = WIZARD_STEPS[index + 1];
  const nextLabel = isLast ? 'Finish' : (next?.isHubEntry ? `Next: ${esc(next.hub)} →` : 'Next');

  const tip = document.createElement('div');
  tip.className = target ? 'wizard-tooltip' : 'wizard-tooltip wizard-tooltip-centered';
  tip.innerHTML = `
    <div class="wizard-step-count">Step ${index + 1} of ${total}</div>
    <h3 class="wizard-tooltip-title">${esc(step.title)}</h3>
    <p class="wizard-tooltip-body">${esc(step.body)}</p>
    <div class="wizard-tooltip-actions">
      ${index > 0 ? '<button type="button" class="btn btn-sm" data-act="back">Back</button>' : ''}
      <button type="button" class="btn btn-sm" data-act="skip">Skip tour</button>
      <button type="button" class="btn btn-primary btn-sm" data-act="next">${nextLabel}</button>
    </div>`;
  document.body.appendChild(tip);
  mountedNodes.push(tip);

  tip.querySelector('[data-act="back"]')?.addEventListener('click', goBack);
  tip.querySelector('[data-act="skip"]').addEventListener('click', skip);
  tip.querySelector('[data-act="next"]').addEventListener('click', goNext);

  if (target) positionTooltip(tip, target);
}

function mountStep(step) {
  revealTarget(step);
  const target = step.selector ? document.querySelector(step.selector) : null;

  const overlay = document.createElement('div');
  overlay.className = 'wizard-overlay';
  document.body.appendChild(overlay);
  mountedNodes.push(overlay);

  if (target) {
    target.classList.add('wizard-spotlight-target');
    spotlightEl = target;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    requestAnimationFrame(() => mountTooltip(step, target));
  } else {
    mountTooltip(step, null); // §4.3 case 3 — missing target, centered non-spotlit fallback
  }
}

function renderResumePill(step) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'wizard-resume-pill';
  pill.textContent = '🧭 Resume tour →';
  pill.addEventListener('click', () => goToStep(step));
  document.body.appendChild(pill);
  mountedNodes.push(pill);
}

// The per-page hook: app.js's shared boot() calls this unconditionally on every
// page load (§7). No page file imports anything wizard-related.
export function runWizardStep() {
  teardown();
  if (!isTourAvailable()) return;
  if (getWizardStatus() !== 'active') return;
  const step = currentStep();
  if (!step) return;
  if (step.page.split('?')[0] !== currentFile()) {
    renderResumePill(step);
    return;
  }
  mountStep(step);
}
