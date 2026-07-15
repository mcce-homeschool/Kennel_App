// studServiceRepo.js — all Dexie access for the StudService table. Covers both
// directions: your stud servicing an outside female (`outgoing`) and you using
// an outside stud on your dam (`incoming`) — Data Model v3 §5.8.
//
// Owns the canonical studservice<->pairing link (`pairing_id`, mirrors
// Litter.pairing_id). There is no Pairing.stud_service_id — the reverse is
// always the derived query `getByPairing`.
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { STUD_SERVICE_REFERENCES } from './referenceRegistry.js';

const base = makeRepo('stud_services', STUD_SERVICE_REFERENCES);

const REQUIRED_FIELDS = ['direction', 'our_dog_id', 'partner_dog_id', 'partner_contact_id', 'status'];

function validateStudService(candidate) {
  for (const f of REQUIRED_FIELDS) {
    if (candidate[f] == null || candidate[f] === '') {
      throw new Error(`StudService: "${f}" is required.`);
    }
  }
}

export const studServiceRepo = {
  ...base,

  async create(data) {
    validateStudService(data);
    return base.create(data);
  },

  async update(id, changes) {
    const existing = await db.stud_services.get(id);
    if (!existing) throw new Error(`stud_services: no record with id ${id}`);
    validateStudService({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // The stud service(s) linked to a pairing — derived, since Pairing carries no
  // back-pointer (Data Model v3 §5.3, §5.8).
  getByPairing(pairingId) {
    return db.stud_services.where('pairing_id').equals(pairingId).toArray();
  },

  // Stud services where this dog appears on either side — powers the Dog
  // Detail "Stud Services" panel.
  async getForDog(dogId) {
    const [asOurs, asPartner] = await Promise.all([
      db.stud_services.where('our_dog_id').equals(dogId).toArray(),
      db.stud_services.where('partner_dog_id').equals(dogId).toArray()
    ]);
    const byId = new Map();
    for (const s of [...asOurs, ...asPartner]) byId.set(s.id, s);
    return [...byId.values()];
  }
};

export { ReferenceBlockedError } from './repoBase.js';
