// app.js — shared shell bootstrap imported by every page. Injects the nav and,
// on first run, asks the browser to keep this origin's data durable.
//
// Imports here resolve relative to THIS module's URL (the app root), so they are
// correct no matter which page (root or /pages/) pulls app.js in.
import { renderNav } from './nav.js';
import { requestPersistentStorage } from './data/db.js';
import { wasPersistRequested, markPersistRequested } from './data/settings.js';
import { maybeShowFirstRunPrompt, renderSampleBanner } from './assets/sampleDataUI.js';

async function firstRunPersistence() {
  if (wasPersistRequested()) return;
  markPersistRequested(); // record the attempt so we only prompt once
  await requestPersistentStorage();
}

function boot() {
  renderNav();
  firstRunPersistence();
  renderSampleBanner();
  maybeShowFirstRunPrompt();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
