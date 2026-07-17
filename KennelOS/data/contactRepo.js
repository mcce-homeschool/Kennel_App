// contactRepo.js — all Dexie access for the Contact table (breeder network:
// vets, other breeders, co-owners, referral sources).
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { CONTACT_REFERENCES } from './referenceRegistry.js';

const base = makeRepo('contacts', CONTACT_REFERENCES);

function validateContact(candidate) {
  // Contact requires only `name` (Build Brief B1); contact_type is a free
  // multi-select with no restriction on combinations.
  if (!candidate.name) throw new Error('Contact: "name" is required.');
}

export const contactRepo = {
  ...base,

  async create(data) {
    validateContact(data);
    return base.create(data);
  },

  async update(id, changes) {
    const existing = await db.contacts.get(id);
    if (!existing) throw new Error(`contacts: no record with id ${id}`);
    validateContact({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // Dogs owned OR co-owned by this contact — powers the Contact Detail list
  // (read-only there; ownership is edited from the Dog record). Uses the
  // owner_contact_id index and the *co_owner_contact_ids multi-entry index.
  async getDogs(contactId) {
    const [owned, coOwned] = await Promise.all([
      db.dogs.where('owner_contact_id').equals(contactId).toArray(),
      db.dogs.where('co_owner_contact_ids').equals(contactId).toArray()
    ]);
    const byId = new Map();
    for (const d of [...owned, ...coOwned]) byId.set(d.id, d);
    return [...byId.values()];
  },

  // Distinct first_contact_source values already entered — feeds the free-text
  // autocomplete (Stage4 Revision v2 §3, built like `breed`: suggested, never
  // enforced).
  async getFirstContactSources() {
    const all = await db.contacts.toArray();
    return [...new Set(all.map((c) => c.first_contact_source).filter(Boolean))].sort();
  }
};
