// settings.js — tiny localStorage-backed settings store. This is the small,
// synchronous "UI prefs / last backup date" use case that localStorage is
// genuinely right for (Build Brief A3) — records live in IndexedDB, not here.

const KEYS = {
  lastBackupDate: 'ashleyDogs.lastBackupDate',
  persistRequested: 'ashleyDogs.persistRequested',
  sampleDataManifest: 'ashleyDogs.sampleDataManifest',
  sampleDataCleared: 'ashleyDogs.sampleDataCleared',
  myKennelId: 'ashleyDogs.myKennelId',
  myContactId: 'ashleyDogs.myContactId',
  myKennelSetupSkipped: 'ashleyDogs.myKennelSetupSkipped'
};

export function getLastBackupDate() {
  return localStorage.getItem(KEYS.lastBackupDate); // ISO string or null
}

export function setLastBackupDate(iso = new Date().toISOString()) {
  localStorage.setItem(KEYS.lastBackupDate, iso);
  return iso;
}

export function wasPersistRequested() {
  return localStorage.getItem(KEYS.persistRequested) === '1';
}

export function markPersistRequested() {
  localStorage.setItem(KEYS.persistRequested, '1');
}

// Sample-data manifest — the record of which IDs were created by the demo
// seed, so they can be found again for a clean bulk delete (see sampleData.js).
export function getSampleDataManifest() {
  const raw = localStorage.getItem(KEYS.sampleDataManifest);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSampleDataManifest(manifest) {
  localStorage.setItem(KEYS.sampleDataManifest, JSON.stringify(manifest));
}

export function removeSampleDataManifest() {
  localStorage.removeItem(KEYS.sampleDataManifest);
}

export function wasSampleDataCleared() {
  return localStorage.getItem(KEYS.sampleDataCleared) === '1';
}

export function markSampleDataCleared() {
  localStorage.setItem(KEYS.sampleDataCleared, '1');
}

// "My kennel" identity — the real Kennel/Contact created by the kennel-setup
// wizard (see kennelSetup.js). Stored as ids, not copied strings, so renaming
// either record later (e.g. from the Kennels page) stays the single source of
// truth; settings just remembers which records they are.
export function getMyKennelId() {
  return localStorage.getItem(KEYS.myKennelId);
}

export function setMyKennelId(id) {
  localStorage.setItem(KEYS.myKennelId, id);
}

export function getMyContactId() {
  return localStorage.getItem(KEYS.myContactId);
}

export function setMyContactId(id) {
  localStorage.setItem(KEYS.myContactId, id);
}

export function wasMyKennelSetupSkipped() {
  return localStorage.getItem(KEYS.myKennelSetupSkipped) === '1';
}

export function markMyKennelSetupSkipped() {
  localStorage.setItem(KEYS.myKennelSetupSkipped, '1');
}

// Full app reset (Reset App to Start): drop every key this app owns in
// localStorage, so the next load has no memory of sample data, kennel setup,
// or backup history — same blank slate as a browser that's never visited.
export function clearAllSettings() {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key);
}
