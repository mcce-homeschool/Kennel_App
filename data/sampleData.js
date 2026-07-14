// sampleData.js — the "Thornfield Kennels" demo packet: seed it, clear it.
// Companion to importExport.js in the data layer (Sample Data & Reset brief v1).
//
// Design (brief §2): seed through the repo layer so sample records go through
// the exact same validation real data does; track created IDs in one manifest
// object rather than an `is_sample` schema flag, so clearing needs no scan.
import { db } from './db.js';
import { dogRepo } from './dogRepo.js';
import { HistoryEvent } from './eventRepo.js';
import { contactRepo } from './contactRepo.js';
import { kennelRepo } from './kennelRepo.js';
import { findBlockingReferences, DOG_REFERENCES } from './referenceRegistry.js';
import {
  getSampleDataManifest,
  setSampleDataManifest,
  removeSampleDataManifest,
  wasSampleDataCleared,
  markSampleDataCleared
} from './settings.js';

export { getSampleDataManifest };

export function hasSampleData() {
  return getSampleDataManifest() != null;
}

// First-run gate (brief §4): only offer the choice when there are no rows in
// any Stage 1-2 table yet AND the manifest/cleared flag haven't been set —
// i.e. this browser has genuinely never made a choice before.
export async function shouldOfferFirstRunPrompt() {
  if (getSampleDataManifest() != null || wasSampleDataCleared()) return false;
  const [dogCount, contactCount, kennelCount] = await Promise.all([
    db.dogs.count(),
    db.contacts.count(),
    db.kennels.count()
  ]);
  return dogCount === 0 && contactCount === 0 && kennelCount === 0;
}

// Skip seeding: record the choice so the prompt never reappears.
export function declineSampleData() {
  markSampleDataCleared();
}

// --- Seeding ----------------------------------------------------------------

export async function seedSampleData() {
  const manifest = { seededAt: new Date().toISOString(), dogs: [], events: [], contacts: [], kennels: [] };

  // Kennels
  const thornfield = await kennelRepo.create({
    kennel_name: 'Thornfield Kennels', prefix: 'THORN', location: 'Hartland, VT'
  });
  const meadowRidge = await kennelRepo.create({
    kennel_name: 'Meadow Ridge Kennels', prefix: 'MDWR', location: 'Concord, NH'
  });
  manifest.kennels.push(thornfield.id, meadowRidge.id);

  // Contacts
  const patricia = await contactRepo.create({
    name: 'Dr. Patricia Nguyen', contact_type: ['vet'], phone: '555-0101'
  });
  const dana = await contactRepo.create({
    name: 'Dana Ruiz', contact_type: ['breeder'], kennel_id: meadowRidge.id, phone: '555-0102'
  });
  const sam = await contactRepo.create({
    name: 'Sam Okafor', contact_type: ['co_owner'], phone: '555-0103'
  });
  const tessa = await contactRepo.create({
    name: 'Tessa Lin', contact_type: ['co_owner', 'buyer_referrer'], phone: '555-0104'
  });
  const marcus = await contactRepo.create({
    name: 'Marcus Webb', contact_type: ['buyer_referrer'], phone: '555-0105'
  });
  await contactRepo.archive(marcus.id);
  manifest.contacts.push(patricia.id, dana.id, sam.id, tessa.id, marcus.id);

  // Dogs — ancestors first so each generation can reference the last.
  const ash = await dogRepo.create({
    call_name: 'Ash', sex: 'male', breed: 'Labrador Retriever',
    date_of_birth: '2016-04-02', date_of_death: '2024-08-15',
    ownership_type: 'owned', status: 'deceased'
  });
  const willow = await dogRepo.create({
    call_name: 'Willow', sex: 'female', breed: 'Labrador Retriever',
    date_of_birth: '2017-09-14',
    ownership_type: 'owned', status: 'retired_breeding'
  });
  await dogRepo.archive(willow.id);

  const juniper = await dogRepo.create({
    call_name: 'Juniper', sex: 'female', breed: 'Labrador Retriever',
    date_of_birth: '2019-11-03', sire_id: ash.id, dam_id: willow.id,
    ownership_type: 'owned', status: 'active_breeding'
  });

  const gunnar = await dogRepo.create({
    call_name: 'Gunnar', sex: 'male', breed: 'Labrador Retriever',
    date_of_birth: '2018-06-01', dob_is_estimated: true,
    ownership_type: 'external', owner_contact_id: dana.id, status: 'external_reference'
  });

  const fern = await dogRepo.create({
    call_name: 'Fern', sex: 'female', breed: 'Labrador Retriever',
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id,
    ownership_type: 'owned', status: 'puppy'
  });
  const birch = await dogRepo.create({
    call_name: 'Birch', sex: 'male', breed: 'Labrador Retriever',
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id,
    ownership_type: 'owned', status: 'active_breeding'
  });
  const hazel = await dogRepo.create({
    call_name: 'Hazel', sex: 'female', breed: 'Labrador Retriever',
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id,
    ownership_type: 'owned', status: 'pet_home'
  });

  const percy = await dogRepo.create({
    call_name: 'Percy', sex: 'male', breed: 'Labrador Retriever',
    date_of_birth: '2024-03-10',
    ownership_type: 'co_owned', co_owner_contact_ids: [sam.id, tessa.id], status: 'active_breeding'
  });

  manifest.dogs.push(ash.id, willow.id, juniper.id, gunnar.id, fern.id, birch.id, hazel.id, percy.id);

  // Events — spread across the dog-facing catalog (brief §6).
  const events = [
    // Juniper
    { subject_id: juniper.id, event_type: 'vaccination', event_date: '2026-01-10', title: 'Annual vaccines',
      details: { vaccine: 'DHPP + Rabies', lot_number: 'B4471' } },
    { subject_id: juniper.id, event_type: 'heat_cycle', event_date: '2026-02-02', title: 'Heat cycle',
      details: { cycle_start: '2026-02-02' } },
    { subject_id: juniper.id, event_type: 'ofa_pennhip', event_date: '2022-05-19', title: 'Hip evaluation',
      details: { joint: 'Hips', method: 'OFA', rating: 'Good' } },
    { subject_id: juniper.id, event_type: 'title_earned', event_date: '2021-10-03', title: 'Earned CGC',
      details: { title_abbreviation: 'CGC', organization: 'AKC' } },
    // Gunnar
    { subject_id: gunnar.id, event_type: 'genetic_test', event_date: '2023-03-01', title: 'Panel results',
      details: { panel_name: 'Embark Breeder Panel', lab: 'Embark', result: 'Clear' } },
    { subject_id: gunnar.id, event_type: 'title_earned', event_date: '2020-09-12', title: 'Earned JH',
      details: { title_abbreviation: 'JH', organization: 'AKC' } },
    // Fern
    { subject_id: fern.id, event_type: 'milestone', event_date: '2025-10-15', title: 'Eyes open',
      details: { description: 'Eyes open' } },
    { subject_id: fern.id, event_type: 'weight_check', event_date: '2026-06-01', title: 'Weight check',
      details: { weight_lbs: 42 } },
    { subject_id: fern.id, event_type: 'vaccination', event_date: '2026-05-01', title: 'Puppy shots (2nd round)',
      details: { vaccine: 'DHPP', lot_number: 'C1029' } },
    // Birch — health-tested after promotion to breeding stock
    { subject_id: birch.id, event_type: 'milestone', event_date: '2025-10-15', title: 'Eyes open',
      details: { description: 'Eyes open' } },
    { subject_id: birch.id, event_type: 'weight_check', event_date: '2026-06-01', title: 'Weight check',
      details: { weight_lbs: 48 } },
    { subject_id: birch.id, event_type: 'vaccination', event_date: '2026-05-01', title: 'Puppy shots (2nd round)',
      details: { vaccine: 'DHPP', lot_number: 'C1029' } },
    { subject_id: birch.id, event_type: 'genetic_test', event_date: '2026-06-20', title: 'Panel results',
      details: { panel_name: 'Embark Breeder Panel', lab: 'Embark', result: 'Clear' } },
    // Hazel
    { subject_id: hazel.id, event_type: 'vaccination', event_date: '2026-05-01', title: 'Puppy shots (2nd round)',
      details: { vaccine: 'DHPP', lot_number: 'C1029' } },
    { subject_id: hazel.id, event_type: 'note', event_date: '2025-12-20', title: 'Placed in pet home',
      details: {}, notes: 'Went home with a family in Concord, NH — regular updates from the family.' },
    // Percy — future-dated, tests the "upcoming" treatment
    { subject_id: percy.id, event_type: 'vet_visit', event_date: '2026-08-15', title: 'Annual checkup',
      details: { reason: 'Annual checkup', vet: 'Dr. Patricia Nguyen' } }
  ];

  for (const e of events) {
    const saved = await HistoryEvent.create({ subject_type: 'dog', ...e });
    manifest.events.push(saved.id);
  }

  setSampleDataManifest(manifest);
  return manifest;
}

// --- Clearing -----------------------------------------------------------

// Contamination check (brief §5.2): find any real (non-manifest) dog that now
// points at a manifest dog via one of the Dog reference kinds. Reuses
// DOG_REFERENCES so this stays accurate as more reference kinds are added.
async function findContaminatingReferences(manifest) {
  const manifestDogIds = new Set(manifest.dogs);
  const conflicts = new Map(); // sampleDogId -> [{label, count}]
  for (const dogId of manifest.dogs) {
    const blockers = await findBlockingReferences(DOG_REFERENCES, dogId);
    if (blockers.length === 0) continue;
    // findBlockingReferences only gives counts, not which records — re-derive
    // the actual referencing rows so we can tell which ones are real (outside
    // the manifest) vs. other sample dogs/events (which are fine to delete
    // together).
    const real = [];
    for (const ref of DOG_REFERENCES) {
      const table = db.table(ref.table);
      const rows = ref.compoundIndex
        ? await table.where(ref.compoundIndex).equals([ref.discriminatorValue, dogId]).toArray()
        : await table.where(ref.field).equals(dogId).toArray();
      for (const row of rows) {
        const isSampleRow = ref.table === 'dogs'
          ? manifestDogIds.has(row.id)
          : manifest.events.includes(row.id);
        if (!isSampleRow) real.push({ label: ref.label, row });
      }
    }
    if (real.length) conflicts.set(dogId, real);
  }
  return conflicts;
}

// clearSampleData({ archiveConflicting }):
//   - dry run (default): reports what's blocking, deletes nothing if blocked.
//   - archiveConflicting: true archives the conflicting sample dogs instead of
//     deleting them, then proceeds to delete everything else in the manifest.
export async function clearSampleData({ archiveConflicting = false } = {}) {
  const manifest = getSampleDataManifest();
  if (!manifest) return { cleared: false, reason: 'none', counts: {} };

  const conflicts = await findContaminatingReferences(manifest);

  if (conflicts.size > 0 && !archiveConflicting) {
    const details = [];
    for (const [dogId, refs] of conflicts) {
      const dog = await db.dogs.get(dogId);
      const label = dog ? dog.call_name : dogId;
      for (const r of refs) details.push(`${label} is ${r.label}`);
    }
    return { cleared: false, reason: 'contaminated', conflicts: details, counts: {} };
  }

  const archivedIds = [];
  if (conflicts.size > 0) {
    for (const dogId of conflicts.keys()) {
      await dogRepo.archive(dogId);
      archivedIds.push(dogId);
    }
  }

  const dogIdsToDelete = manifest.dogs.filter((id) => !archivedIds.includes(id));

  // Dependency order: events -> dogs -> contacts -> kennels. This is a known,
  // self-contained, unreferenced set, so it bypasses the single-record
  // hardDelete guard (which exists to protect one record at a time, not to
  // bulk-clear a whole known set — brief §5).
  const counts = {
    events: manifest.events.length,
    dogs: dogIdsToDelete.length,
    contacts: manifest.contacts.length,
    kennels: manifest.kennels.length,
    archived: archivedIds.length
  };

  await db.transaction('rw', db.events, db.dogs, db.contacts, db.kennels, async () => {
    if (manifest.events.length) await db.events.bulkDelete(manifest.events);
    if (dogIdsToDelete.length) await db.dogs.bulkDelete(dogIdsToDelete);
    if (manifest.contacts.length) await db.contacts.bulkDelete(manifest.contacts);
    if (manifest.kennels.length) await db.kennels.bulkDelete(manifest.kennels);
  });

  removeSampleDataManifest();
  markSampleDataCleared();

  return { cleared: true, counts };
}
