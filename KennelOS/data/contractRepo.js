// contractRepo.js — all Dexie access for the Contract table. Generic enough to
// cover sale, stud service, co-ownership, and lease agreements — one table
// instead of four (Data Model v3 §5.7). A LEAF entity: nothing points at a
// Contract, so it is always hard-deletable (CONTRACT_REFERENCES is empty).
//
// Owns both canonical links: related_sale_id and related_stud_service_id.
// "Linking" a contract to a sale/stud-service is a single write here — there is
// no reverse field on Sale/StudService to keep in sync (Stage4 Revision v2 §5).
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { CONTRACT_REFERENCES } from './referenceRegistry.js';

const base = makeRepo('contracts', CONTRACT_REFERENCES);

const REQUIRED_FIELDS = ['contract_type'];

function validateContract(candidate) {
  for (const f of REQUIRED_FIELDS) {
    if (candidate[f] == null || candidate[f] === '') {
      throw new Error(`Contract: "${f}" is required.`);
    }
  }
  // status is not a locked state machine (Stage4 Revision v2 §7) — any type can
  // be any status, moves in any direction, no confirmation dialogs here.
}

export const contractRepo = {
  ...base,

  async create(data) {
    const record = { status: 'draft', ...data };
    validateContract(record);
    return base.create(record);
  },

  async update(id, changes) {
    const existing = await db.contracts.get(id);
    if (!existing) throw new Error(`contracts: no record with id ${id}`);
    validateContract({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // Derived reverse lookups — the sale/stud-service side never stores a pointer
  // back to its contract(s); this is the query that replaces it. Permits more
  // than one contract per sale/stud-service by design (e.g. sale + addendum).
  getBySale(saleId) {
    return db.contracts.where('related_sale_id').equals(saleId).toArray();
  },

  getByStudService(studServiceId) {
    return db.contracts.where('related_stud_service_id').equals(studServiceId).toArray();
  },

  // "The live contract" of a sale/stud-service — a derived rule, never a stored
  // flag (Stage4 Revision v2 §7): the most recent `signed` contract by
  // signed_date (falling back to created_at), or null if none is signed.
  governingContract(contracts) {
    const signed = contracts.filter((c) => c.status === 'signed');
    if (!signed.length) return null;
    return signed.slice().sort((a, b) =>
      (b.signed_date || b.created_at || '').localeCompare(a.signed_date || a.created_at || '')
    )[0];
  }
};

export { ReferenceBlockedError } from './repoBase.js';
