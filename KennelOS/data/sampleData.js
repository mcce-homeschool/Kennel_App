// sampleData.js — the "Thornfield Kennels" demo packet: seed it, clear it.
// Companion to importExport.js in the data layer (Sample Data & Reset brief v2).
//
// Design (brief §2): seed through the repo layer so sample records go through
// the exact same validation real data does; track created IDs in one manifest
// object rather than an `is_sample` schema flag, so clearing needs no scan.
// v2 unifies all six tables that exist through Stage 3 (Dog, Event, Contact,
// Kennel, Pairing, Litter) into one seed/clear set — this replaces v1 entirely,
// it is not a diff.
import { db } from './db.js';
import { dogRepo } from './dogRepo.js';
import { HistoryEvent } from './eventRepo.js';
import { contactRepo } from './contactRepo.js';
import { kennelRepo } from './kennelRepo.js';
import { pairingRepo } from './pairingRepo.js';
import { litterRepo } from './litterRepo.js';
import { findBlockingReferences, DOG_REFERENCES, PAIRING_REFERENCES, LITTER_REFERENCES } from './referenceRegistry.js';
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

// YYYY-MM-DD for `n` months after today — used for Pairing P2's planned_date so
// the sample packet always shows a pairing "several months out" regardless of
// when it's seeded (brief §6).
function monthsFromToday(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function seedSampleData() {
  const manifest = {
    seededAt: new Date().toISOString(),
    dogs: [], events: [], contacts: [], kennels: [], pairings: [], litters: []
  };

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

  // Dogs — ancestors first so each generation can reference the last. Every
  // sample dog is Boston Terrier (brief §6).
  const BREED = 'Boston Terrier';

  const ash = await dogRepo.create({
    call_name: 'Ash', sex: 'male', breed: BREED,
    date_of_birth: '2016-04-02', date_of_death: '2024-08-15',
    ownership_type: 'owned', status: 'deceased'
  });
  const willow = await dogRepo.create({
    call_name: 'Willow', sex: 'female', breed: BREED,
    date_of_birth: '2017-09-14',
    ownership_type: 'owned', status: 'retired_breeding'
  });
  await dogRepo.archive(willow.id);

  const juniper = await dogRepo.create({
    call_name: 'Juniper', sex: 'female', breed: BREED,
    date_of_birth: '2019-11-03', sire_id: ash.id, dam_id: willow.id,
    ownership_type: 'owned', status: 'active_breeding'
  });

  const gunnar = await dogRepo.create({
    call_name: 'Gunnar', sex: 'male', breed: BREED,
    date_of_birth: '2018-06-01', dob_is_estimated: true,
    ownership_type: 'external', owner_contact_id: dana.id, status: 'external_reference'
  });

  // Pairing P1 — the actual, whelped breeding that produced Fern/Birch/Hazel.
  const pairingP1 = await pairingRepo.create({
    sire_id: gunnar.id, dam_id: juniper.id, pairing_type: 'actual', method: 'natural',
    status: 'whelped', planned_date: '2025-06-18', expected_due_date: '2025-08-20'
  });

  // Litter — dam/sire authoritative on the litter itself, pairing_id links back
  // to P1 (data model §5.4). Status closed: all three puppies have moved on,
  // even though the individual dogs sit at different life stages.
  const litter = await litterRepo.create({
    pairing_id: pairingP1.id, dam_id: juniper.id, sire_id: gunnar.id,
    whelp_date: '2025-08-20', litter_registration_number: 'THORN-L-2025-01',
    puppies_born_total: 3, puppies_born_alive: 3, puppies_born_deceased: 0,
    status: 'closed'
  });

  const fern = await dogRepo.create({
    call_name: 'Fern', sex: 'female', breed: BREED,
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id, litter_id: litter.id,
    ownership_type: 'owned', status: 'puppy'
  });
  const birch = await dogRepo.create({
    call_name: 'Birch', sex: 'male', breed: BREED,
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id, litter_id: litter.id,
    ownership_type: 'owned', status: 'active_breeding'
  });
  const hazel = await dogRepo.create({
    call_name: 'Hazel', sex: 'female', breed: BREED,
    date_of_birth: '2025-08-20', sire_id: gunnar.id, dam_id: juniper.id, litter_id: litter.id,
    ownership_type: 'owned', status: 'pet_home'
  });

  const percy = await dogRepo.create({
    call_name: 'Percy', sex: 'male', breed: BREED,
    date_of_birth: '2024-03-10',
    ownership_type: 'co_owned', co_owner_contact_ids: [sam.id, tessa.id], status: 'active_breeding'
  });

  manifest.dogs.push(ash.id, willow.id, juniper.id, gunnar.id, fern.id, birch.id, hazel.id, percy.id);

  // Pairing P2 — same pair, planned only, no litter yet. Exercises the "Create
  // Litter from this Pairing" empty state and an empty pairing timeline.
  const pairingP2 = await pairingRepo.create({
    sire_id: gunnar.id, dam_id: juniper.id, pairing_type: 'planned', status: 'planned',
    planned_date: monthsFromToday(4)
  });

  manifest.pairings.push(pairingP1.id, pairingP2.id);
  manifest.litters.push(litter.id);

  // Events — spread across all three subject types to cover most of the catalog
  // (brief §6).
  const dogEvents = [
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
    { subject_id: fern.id, event_type: 'evaluation', event_date: '2026-06-15', title: 'Puppy evaluation',
      details: { evaluator: 'Dr. Patricia Nguyen', temperament_notes: 'Confident, food-motivated.', structure_notes: 'Level topline, good angulation.' } },
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

  const pairingEvents = [
    { subject_id: pairingP1.id, event_type: 'breeding_tie', event_date: '2025-06-18', title: 'Breeding tie',
      details: { tie_date: '2025-06-18', method: 'Natural' } },
    { subject_id: pairingP1.id, event_type: 'progesterone_test', event_date: '2025-06-10', title: 'Progesterone test',
      details: { value: 15, lab: 'Antech' } },
    { subject_id: pairingP1.id, event_type: 'ultrasound', event_date: '2025-07-16', title: 'Ultrasound',
      details: { confirmed: 'Yes', estimated_count: 3 } },
    { subject_id: pairingP1.id, event_type: 'pregnancy_update', event_date: '2025-07-20', title: 'Pregnancy update',
      details: { note: 'Active, eating well, on schedule for an early-to-mid August whelp.' } }
  ];

  const litterEvents = [
    { subject_id: litter.id, event_type: 'whelping_summary', event_date: '2025-08-20', title: 'Whelping summary',
      details: { total_born: 3, live_born: 3, notes: 'Uncomplicated whelp, all three nursing well within the hour.' } }
  ];

  for (const e of dogEvents) {
    const saved = await HistoryEvent.create({ subject_type: 'dog', ...e });
    manifest.events.push(saved.id);
  }
  for (const e of pairingEvents) {
    const saved = await HistoryEvent.create({ subject_type: 'pairing', ...e });
    manifest.events.push(saved.id);
  }
  for (const e of litterEvents) {
    const saved = await HistoryEvent.create({ subject_type: 'litter', ...e });
    manifest.events.push(saved.id);
  }

  setSampleDataManifest(manifest);
  return manifest;
}

// --- Clearing -----------------------------------------------------------

const ENTITY_REPOS = { dog: dogRepo, pairing: pairingRepo, litter: litterRepo };
const ENTITY_REGISTRIES = { dog: DOG_REFERENCES, pairing: PAIRING_REFERENCES, litter: LITTER_REFERENCES };

// Human-readable label for a conflict message. Dogs already have a name; a
// pairing/litter doesn't, so build one from its dam/sire the same way the UI
// does (Pairing/Litter Detail's own title).
async function labelFor(entityType, id) {
  if (entityType === 'dog') {
    const d = await db.dogs.get(id);
    return d ? d.call_name : id;
  }
  const row = await db.table(entityType === 'pairing' ? 'pairings' : 'litters').get(id);
  if (!row) return id;
  const [sire, dam] = await Promise.all([db.dogs.get(row.sire_id), db.dogs.get(row.dam_id)]);
  const label = `${sire?.call_name || '—'} × ${dam?.call_name || '—'}`;
  return entityType === 'pairing' ? `Pairing (${label})` : `Litter (${label})`;
}

// Contamination check (brief §5.2): find any real (non-manifest) record that
// now points at a manifest Dog/Pairing/Litter via one of the reference
// registries. Reuses the same registries the live hard-delete guard uses, so
// this stays accurate as more reference kinds are added.
async function findContaminatingReferences(manifest) {
  const manifestSets = {
    dogs: new Set(manifest.dogs),
    events: new Set(manifest.events || []),
    pairings: new Set(manifest.pairings || []),
    litters: new Set(manifest.litters || [])
  };

  // conflicts: Map key `${entityType}:${id}` -> { entityType, id, refs: [{label, row}] }
  const conflicts = new Map();

  for (const [entityType, ids] of [
    ['dog', manifest.dogs], ['pairing', manifest.pairings || []], ['litter', manifest.litters || []]
  ]) {
    const registry = ENTITY_REGISTRIES[entityType];
    for (const id of ids) {
      const blockers = await findBlockingReferences(registry, id);
      if (blockers.length === 0) continue;
      const real = [];
      for (const ref of registry) {
        const table = db.table(ref.table);
        const rows = ref.compoundIndex
          ? await table.where(ref.compoundIndex).equals([ref.discriminatorValue, id]).toArray()
          : await table.where(ref.field).equals(id).toArray();
        const manifestSet = manifestSets[ref.table] || new Set();
        for (const row of rows) {
          if (!manifestSet.has(row.id)) real.push({ label: ref.label, row });
        }
      }
      if (real.length) conflicts.set(`${entityType}:${id}`, { entityType, id, refs: real });
    }
  }
  return conflicts;
}

// clearSampleData({ archiveConflicting }):
//   - dry run (default): reports what's blocking, deletes nothing if blocked.
//   - archiveConflicting: true archives the conflicting sample records instead
//     of deleting them, then proceeds to delete everything else in the manifest.
export async function clearSampleData({ archiveConflicting = false } = {}) {
  const manifest = getSampleDataManifest();
  if (!manifest) return { cleared: false, reason: 'none', counts: {} };
  // Defensive: treat any missing array key as empty, in case of a future
  // partial-seed failure or a manifest written by an older app version.
  manifest.pairings = manifest.pairings || [];
  manifest.litters = manifest.litters || [];

  const conflicts = await findContaminatingReferences(manifest);

  if (conflicts.size > 0 && !archiveConflicting) {
    const details = [];
    for (const { entityType, id, refs } of conflicts.values()) {
      const label = await labelFor(entityType, id);
      for (const r of refs) details.push(`${label} is ${r.label}`);
    }
    return { cleared: false, reason: 'contaminated', conflicts: details, counts: {} };
  }

  // Archive conflicting records (grouped by entity type), tracking which ids
  // to exclude from the bulk delete below.
  const archivedIds = { dog: [], pairing: [], litter: [] };
  if (conflicts.size > 0) {
    for (const { entityType, id } of conflicts.values()) {
      await ENTITY_REPOS[entityType].archive(id);
      archivedIds[entityType].push(id);
    }
  }

  const dogIdsToDelete = manifest.dogs.filter((id) => !archivedIds.dog.includes(id));
  const pairingIdsToDelete = manifest.pairings.filter((id) => !archivedIds.pairing.includes(id));
  const litterIdsToDelete = manifest.litters.filter((id) => !archivedIds.litter.includes(id));

  const counts = {
    events: manifest.events.length,
    litters: litterIdsToDelete.length,
    pairings: pairingIdsToDelete.length,
    dogs: dogIdsToDelete.length,
    contacts: manifest.contacts.length,
    kennels: manifest.kennels.length,
    archived: archivedIds.dog.length + archivedIds.pairing.length + archivedIds.litter.length
  };

  // Dependency order: events -> litters -> pairings -> dogs -> contacts ->
  // kennels. Litters and pairings must clear before dogs, since a Litter
  // references dogs via dam_id/sire_id and dogs' own litter_id pointers need
  // to go with the same pass. This is a known, self-contained, unreferenced
  // set, so it bypasses the single-record hardDelete guard (which exists to
  // protect one record at a time, not to bulk-clear a whole known set — brief §5).
  await db.transaction('rw', db.events, db.litters, db.pairings, db.dogs, db.contacts, db.kennels, async () => {
    if (manifest.events.length) await db.events.bulkDelete(manifest.events);
    if (litterIdsToDelete.length) await db.litters.bulkDelete(litterIdsToDelete);
    if (pairingIdsToDelete.length) await db.pairings.bulkDelete(pairingIdsToDelete);
    if (dogIdsToDelete.length) await db.dogs.bulkDelete(dogIdsToDelete);
    if (manifest.contacts.length) await db.contacts.bulkDelete(manifest.contacts);
    if (manifest.kennels.length) await db.kennels.bulkDelete(manifest.kennels);
  });

  removeSampleDataManifest();
  markSampleDataCleared();

  return { cleared: true, counts };
}
