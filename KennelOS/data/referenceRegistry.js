// referenceRegistry.js — the single declared list of every foreign key that
// points at each entity, plus the generic guard that drives hard-delete blocking
// (Data Model doc §10, Build Brief A2/B1).
//
// Why a registry instead of ad-hoc checks in each repo:
//  - It stays HONEST per stage. `findBlockingReferences` skips any entry whose
//    table doesn't exist in the current schema version, so at Stage 2 a Dog's
//    blockers are genuinely only "sire/dam of another dog" and "subject/partner
//    of an event" — it never claims to check litters/sales/stud-services that
//    don't exist yet.
//  - It can't silently rot: adding a referencing table later means appending one
//    line here, not remembering to update a scattered check.
//
// Entry shape:
//   { table, field, label,
//     multiEntry?:   true if `field` is a Dexie multi-entry (*) index,
//     compoundIndex? + discriminatorValue?:  for the polymorphic Event, match
//       only rows of the right subject_type via the [subject_type+subject_id]
//       compound index }
import { db, existingTableNames } from './db.js';

// --- Dog: what can point at a Dog (Data Model doc §10) ---------------------
export const DOG_REFERENCES = [
  { table: 'dogs',   field: 'sire_id',        label: 'sire of another dog' },
  { table: 'dogs',   field: 'dam_id',         label: 'dam of another dog' },
  {
    table: 'events', field: 'subject_id', label: 'subject of an event',
    compoundIndex: '[subject_type+subject_id]', discriminatorValue: 'dog'
  },
  { table: 'events', field: 'related_dog_id', label: 'partner on an event' },
  // Stage 3 (this stage): a Dog is also referenceable as a parent on a pairing or
  // a litter. findBlockingReferences skips these while the tables don't exist, so
  // Stage 2 behavior is unchanged; once version(2) lands they become live blockers
  // and the Dog Detail "can't delete" message picks them up with no UI change.
  { table: 'pairings', field: 'sire_id', label: 'sire in a pairing' },
  { table: 'pairings', field: 'dam_id',  label: 'dam in a pairing' },
  { table: 'litters',  field: 'sire_id', label: 'sire of a litter' },
  { table: 'litters',  field: 'dam_id',  label: 'dam of a litter' }
  // Stage 6+ append: sales.dog_id, stud_services.our_dog_id/partner_dog_id
];

// --- Litter: what can point at a Litter (Data Model doc §10) ----------------
// A litter can't be hard-deleted while any Dog still has litter_id pointing at it
// (its puppy roster). Archive instead.
export const LITTER_REFERENCES = [
  { table: 'dogs', field: 'litter_id', label: 'puppy roster member' }
];

// --- Pairing: what can point at a Pairing ----------------------------------
// A linked litter (Litter.pairing_id — the canonical litter↔pairing link) or any
// Event logged against the pairing blocks hard delete.
export const PAIRING_REFERENCES = [
  { table: 'litters', field: 'pairing_id', label: 'linked litter' },
  {
    table: 'events', field: 'subject_id', label: 'subject of an event',
    compoundIndex: '[subject_type+subject_id]', discriminatorValue: 'pairing'
  }
  // Stage 6+ append: stud_services.pairing_id
];

// --- Contact: what can point at a Contact ---------------------------------
export const CONTACT_REFERENCES = [
  { table: 'dogs', field: 'owner_contact_id',    label: 'owner of a dog' },
  { table: 'dogs', field: 'co_owner_contact_ids', label: 'co-owner of a dog', multiEntry: true }
  // Stage 6+ append: stud_services.partner_contact_id
];

// --- Kennel: what can point at a Kennel ------------------------------------
export const KENNEL_REFERENCES = [
  { table: 'contacts', field: 'kennel_id', label: 'kennel of a contact' }
];

// Count rows matching one registry entry for the given target id.
async function countReferences(ref, id) {
  const table = db.table(ref.table);
  if (ref.compoundIndex) {
    // Polymorphic reference (Event): match [discriminatorValue, id] on the
    // compound index so we only count events whose subject_type is right.
    return table.where(ref.compoundIndex).equals([ref.discriminatorValue, id]).count();
  }
  // Both single-field and multi-entry (*) indexes answer .where(field).equals(id).
  return table.where(ref.field).equals(id).count();
}

// Generic guard: returns the list of human-readable blockers ({ label, count })
// for `id` against `registry`, skipping any table not present in the current
// schema. Empty array => hard delete is allowed.
export async function findBlockingReferences(registry, id) {
  const existing = new Set(existingTableNames());
  const blockers = [];
  for (const ref of registry) {
    if (!existing.has(ref.table)) continue; // stage-honest: don't probe absent tables
    const count = await countReferences(ref, id);
    if (count > 0) blockers.push({ label: ref.label, count });
  }
  return blockers;
}
