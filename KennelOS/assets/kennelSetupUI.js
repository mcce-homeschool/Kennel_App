// kennelSetupUI.js — the kennel/owner setup modal and its nav-banner name.
// Shared by app.js (every page) and pages/import-export.js ("Set up your
// kennel" — the same reachable-any-time-from-Settings pattern as Clear Sample
// Data, since there's still no dedicated Settings page).
import {
  shouldOfferKennelSetupPrompt, skipKennelSetup, completeKennelSetup, getMyKennelName,
  getKennelSetupState
} from '../data/kennelSetup.js';
import { esc } from './ui.js';

export function maybeShowKennelSetupPrompt() {
  if (!shouldOfferKennelSetupPrompt()) return;
  showKennelSetupModal({ skippable: true });
}

// skippable: true for the first-run prompt; false when opened deliberately
// from Import/Export (there, "Cancel" just closes without nagging state).
// Reopening when a kennel/contact already exists prefills and UPDATES those
// same records (see completeKennelSetup) rather than creating duplicates.
// A successful save reloads the page — the nav banner and every dog-form
// owner picker need the fresh kennel/contact, same as the sample-data flow
// reloads after seeding. onDone(false) only fires on skip/cancel, where
// nothing changed and a reload would be pointless.
export async function showKennelSetupModal({ skippable, onDone } = {}) {
  const initial = await getKennelSetupState();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:440px;">
      <h2 style="margin-top:0;">🏡 Set up your kennel</h2>
      <p class="muted">This names your kennel in the header and lets new dogs prefill their
        owner automatically.</p>
      <div class="form-grid">
        <div class="field field-wide"><label>Kennel name <span class="req">*</span></label>
          <input id="ks-kennel" type="text" placeholder="e.g. Thornfield Kennels" value="${esc(initial.kennelName)}"></div>
        <div class="field field-wide"><label>Your name (as owner)</label>
          <input id="ks-owner" type="text" placeholder="Used to prefill Owner on dogs you own" value="${esc(initial.ownerName)}"></div>
      </div>
      <div id="ks-error"></div>
      <div class="form-actions">
        <button class="btn btn-primary" data-act="save">Save</button>
        ${skippable ? '<button class="btn" data-act="skip">Skip for now</button>' : '<button class="btn" data-act="cancel">Cancel</button>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const errorBox = overlay.querySelector('#ks-error');
  overlay.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const kennelName = overlay.querySelector('#ks-kennel').value.trim();
    const ownerName = overlay.querySelector('#ks-owner').value.trim();
    if (!kennelName) {
      errorBox.innerHTML = `<div class="inline-error">Kennel name is required.</div>`;
      return;
    }
    try {
      await completeKennelSetup({ kennelName, ownerName });
      location.reload();
    } catch (e) {
      errorBox.innerHTML = `<div class="inline-error">${esc(e.message || String(e))}</div>`;
    }
  });
  const dismiss = overlay.querySelector('[data-act="skip"], [data-act="cancel"]');
  dismiss.addEventListener('click', () => {
    if (skippable) skipKennelSetup();
    overlay.remove();
    onDone?.(false);
  });
}

// Appends " — <kennel name>" to the nav brand, once looked up. No-op if no
// kennel has been set up yet.
export async function renderKennelBanner() {
  const name = await getMyKennelName();
  if (!name) return;
  const brand = document.querySelector('.nav-brand');
  if (!brand) return;
  const span = document.createElement('span');
  span.className = 'nav-kennel';
  span.textContent = `— ${name}`;
  brand.appendChild(span);
}
