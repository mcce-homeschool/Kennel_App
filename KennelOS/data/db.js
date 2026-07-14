// db.js — Dexie schema definition (single source of truth for tables/indexes).
//
// Layering rule (see CLAUDE.md): pages never import this file directly and never
// call db.<table>.* — they go through the repo modules in /data. The repos are the
// only code that touches Dexie.
//
// Dexie is vendored locally (no CDN) so the app works offline after first load.
import Dexie from '../vendor/dexie.min.mjs';

// App-specific DB name: project pages on github.io share one origin as path
// prefixes, so a distinct name prevents collisions with anything else the user
// hosts on the same account (Data Model doc §2.1).
export const db = new Dexie('KennelOSBreedingApp');

// --- Schema ---------------------------------------------------------------
// version(1) covers the Stage 1–2 tables only: dogs, events, contacts, kennels.
// Schema is ADDITIVE — later stages add tables in a NEW db.version(N).stores({...})
// block. NEVER edit version(1) (CLAUDE.md / Build Brief A2).
//
// Index notes:
//  - events '[subject_type+subject_id]' is a COMPOUND index, required for fast
//    "timeline for this dog/pairing/litter" lookups. Do not split into two.
//  - dogs '*co_owner_contact_ids' is a MULTI-ENTRY index so "dogs co-owned by X"
//    is a real query, not a full scan.
//  - Only fields we actually query/filter on are indexed; all other fields still
//    persist, they just aren't indexed.
db.version(1).stores({
  dogs: 'id, sire_id, dam_id, litter_id, owner_contact_id, *co_owner_contact_ids, status, ownership_type, sex, breed, is_archived',
  events: 'id, [subject_type+subject_id], event_type, event_date, related_dog_id, is_archived',
  contacts: 'id, kennel_id, is_archived',
  kennels: 'id, is_archived'
});

// version(2) adds the Stage 3 Breeding Workflow tables: pairings, litters. This
// is a NEW, ADDITIVE block — version(1) above is untouched (CLAUDE.md / Stage 3
// Brief §2). dogs.litter_id and events '[subject_type+subject_id]' already exist
// from version(1) and need no change; a Dog with status "puppy" simply points its
// existing litter_id at one of these new litter rows.
db.version(2).stores({
  pairings: 'id, sire_id, dam_id, status, pairing_type, is_archived',
  litters:  'id, pairing_id, sire_id, dam_id, status, whelp_date, is_archived'
});

// --- First-run storage durability ----------------------------------------
// Ask the browser to keep this origin's data from being evicted under storage
// pressure (Data Model doc §2.1). Best-effort; safe to ignore if unsupported.
export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* non-fatal — durability is a nicety, not a requirement */
  }
  return false;
}

// Convenience: the list of table names that actually exist in the current schema
// version. referenceRegistry / import-export use this so stage-aware code never
// probes a table that doesn't exist yet.
export function existingTableNames() {
  return db.tables.map((t) => t.name);
}
