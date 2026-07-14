// settings.js — tiny localStorage-backed settings store. This is the small,
// synchronous "UI prefs / last backup date" use case that localStorage is
// genuinely right for (Build Brief A3) — records live in IndexedDB, not here.

const KEYS = {
  lastBackupDate: 'ashleyDogs.lastBackupDate',
  persistRequested: 'ashleyDogs.persistRequested',
  sampleDataManifest: 'ashleyDogs.sampleDataManifest',
  sampleDataCleared: 'ashleyDogs.sampleDataCleared'
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
