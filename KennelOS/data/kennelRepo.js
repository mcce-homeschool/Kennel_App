// kennelRepo.js — all Dexie access for the lightweight Kennel table.
// Kept deliberately minimal (Build Brief B1): kennels are added inline from the
// Contact form and managed from a bare list/rename screen; no full CRUD UI yet.
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { KENNEL_REFERENCES } from './referenceRegistry.js';

const base = makeRepo('kennels', KENNEL_REFERENCES);

function validateKennel(candidate) {
  if (!candidate.kennel_name) throw new Error('Kennel: "kennel_name" is required.');
}

export const kennelRepo = {
  ...base,

  async create(data) {
    validateKennel(data);
    return base.create(data);
  },

  async update(id, changes) {
    const existing = await db.kennels.get(id);
    if (!existing) throw new Error(`kennels: no record with id ${id}`);
    validateKennel({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // Contacts affiliated with this kennel — for the standalone kennel list screen.
  getContacts(kennelId) {
    return db.contacts.where('kennel_id').equals(kennelId).toArray();
  }
};
