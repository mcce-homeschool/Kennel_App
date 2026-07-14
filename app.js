// app.js — shared shell bootstrap imported by every page. Injects the nav and,
// on first run, asks the browser to keep this origin's data durable.
//
// Imports here resolve relative to THIS module's URL (the app root), so they are
// correct no matter which page (root or /pages/) pulls app.js in.
import { renderNav } from './nav.js';
import { requestPersistentStorage } from './data/db.js';
import { wasPersistRequested, markPersistRequested } from './data/settings.js';
import { maybeShowFirstRunPrompt, renderSampleBanner } from './assets/sampleDataUI.js';
import { maybeShowKennelSetupPrompt, renderKennelBanner } from './assets/kennelSetupUI.js';

async function firstRunPersistence() {
  if (wasPersistRequested()) return;
  markPersistRequested(); // record the attempt so we only prompt once
  await requestPersistentStorage();
}

// The kennel-setup wizard follows the sample-data choice, not precedes it:
// picking "Explore with sample data" reloads the page (Thornfield Kennels
// already fills that role), so only the "blank kennel" branch — or a later
// reload right after sample data gets cleared — ever reaches it.
async function firstRunFlow() {
  const choice = await maybeShowFirstRunPrompt();
  if (choice !== 'seeded') maybeShowKennelSetupPrompt();
}

function boot() {
  renderNav();
  firstRunPersistence();
  renderSampleBanner();
  renderKennelBanner();
  firstRunFlow();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
