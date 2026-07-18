// companionExport.js — the Companion feature's allow-list bundle builder.
//
// THE LOAD-BEARING SECURITY INVARIANT of this feature. importExport.js
// deliberately iterates whatever tables exist (a full backup); this module does
// the EXACT OPPOSITE. Each builder constructs a fresh object naming every field
// explicitly and copies ONLY the listed fields. Hard rules (checked in review):
//   - No object spread of a record ({...dog}), no Object.assign from a record,
//     no "take the record and delete the private keys."
//   - Reads go through repos, never db.<table> directly (layering rule).
//   - No second family's data, no internal notes, no Event.details/notes, no
//     lead/source fields, no financials beyond the one stud fee_amount.
//   - A new field added to a source table does NOT appear in a bundle until
//     someone adds it here by name. Silence is the safe default.
// After building, assertOnlyKeys() runs a POSITIVE allow-list check (not a
// deny-list): if any unexpected top-level key is present, the send is aborted.
//
// All three bundles are anchored on a Contact (the recipient) and discriminated
// by bundleType. Money is the app's native decimal, never cents — the shell
// formats it. Bundle evolution is additive; COMPANION_BUNDLE_VERSION bumps only
// on a breaking shape change.
import { dogRepo } from './dogRepo.js';
import { saleRepo } from './saleRepo.js';
import { contactRepo } from './contactRepo.js';
import { contractRepo } from './contractRepo.js';
import { studServiceRepo } from './studServiceRepo.js';
import { eventRepo } from './eventRepo.js';
import { pairingRepo } from './pairingRepo.js';
import { litterRepo } from './litterRepo.js';
import { getCompanionSettings } from './settings.js';
import { EVENT_TYPES } from './vocab.js';

export const COMPANION_BUNDLE_VERSION = 1;

// Health/vet event types safe to surface to a family, projected to {date, label}
// with the FIXED type label only — never Event.details/notes, which can hold
// internal remarks (e.g. an illness diagnosis or vet findings). Deliberately
// excludes illness/injury/evaluation and every non-health type.
const HEALTH_VISIT_TYPES = ['vaccination', 'preventative', 'vet_visit', 'surgery'];
const FEE_STRUCTURES_WITH_PICK = ['pick_of_litter', 'flat_plus_pick'];
const EXTERNAL_OWNERSHIP = ['external', 'leased_in'];

function typeLabel(value) {
  return (EVENT_TYPES.find((t) => t.value === value) || {}).label || value;
}

function dogMini(d) {
  return d ? { name: d.call_name || '', breed: d.breed || '' } : null;
}

// Positive allow-list assertion — abort the send rather than emit a superset.
function assertOnlyKeys(obj, allowed, ctx) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) {
      throw new Error(`Companion bundle (${ctx}) has unexpected key "${k}" — send aborted.`);
    }
  }
  return obj;
}

// Shared header copy. Layer 1 (per-type settings) supplies kennel identity +
// intro; Layer 2 (Contact.companion_note) overrides the per-type announcement
// when the owner has written a personal line for this recipient.
function headerCopy(type, contact) {
  const s = getCompanionSettings(type);
  const note = (contact.companion_note || '').trim();
  return {
    kennelName: s.kennelName || '',
    tagline: s.tagline || '',
    introText: s.introText || '',
    announcement: note || s.announcement || ''
  };
}

const PROSPECTIVE_KEYS = [
  'bundleVersion', 'bundleType', 'kennelName', 'tagline', 'introText', 'announcement',
  'familyName', 'availablePups', 'litters', 'updatedAt'
];
const FAMILY_KEYS = [
  'bundleVersion', 'bundleType', 'kennelName', 'tagline', 'introText', 'announcement',
  'familyName', 'pups', 'litters', 'pickupDates', 'vetVisits', 'contractUrls', 'updatedAt'
];
const PARTNER_KEYS = [
  'bundleVersion', 'bundleType', 'kennelName', 'tagline', 'introText', 'announcement',
  'partnerName', 'studServices', 'externalPairings', 'contracts', 'updatedAt'
];

// --- Prospective family: current availability (NO per-recipient private data,
// NO price). Scoped to available puppies + the litters they came from. -------
export async function buildProspectiveBundle(contact) {
  const h = headerCopy('prospective', contact);
  const dogs = await dogRepo.getAll();
  const available = dogs.filter((d) => d.status === 'puppy' && d.disposition === 'available');
  const availablePups = available.map((d) => ({ name: d.call_name || '', breed: d.breed || '', sex: d.sex || '' }));

  const litterIds = [...new Set(available.map((d) => d.litter_id).filter(Boolean))];
  const litters = [];
  for (const id of litterIds) {
    const l = await litterRepo.getById(id);
    if (!l) continue;
    litters.push({
      whelpDate: l.whelp_date || null,
      availableCount: available.filter((d) => d.litter_id === id).length
    });
  }

  const bundle = {
    bundleVersion: COMPANION_BUNDLE_VERSION,
    bundleType: 'prospective',
    ...h,
    familyName: contact.name || '',
    availablePups,
    litters,
    updatedAt: new Date().toISOString()
  };
  return assertOnlyKeys(bundle, PROSPECTIVE_KEYS, 'prospective');
}

// --- Current family: their placed dog(s), the litter, pickup, sanitized vet
// visits, and a pointer to the governing contract document. -----------------
export async function buildFamilyBundle(contact) {
  const h = headerCopy('family', contact);
  const sales = (await saleRepo.getByBuyer(contact.id)).filter((s) => !s.is_archived);

  const pups = [];
  const littersByWhelp = new Map();
  const pickupDates = [];
  const vetVisits = [];
  const contractUrls = [];

  for (const sale of sales) {
    const dog = await dogRepo.getById(sale.dog_id);
    if (dog) {
      pups.push({ name: dog.call_name || '', breed: dog.breed || '', sex: dog.sex || '' });
      if (dog.litter_id) {
        const l = await litterRepo.getById(dog.litter_id);
        if (l) littersByWhelp.set(l.id, { whelpDate: l.whelp_date || null });
      }
      // getForSubject excludes archived and returns newest-first.
      const events = await eventRepo.getForSubject('dog', dog.id);
      const placement = events.find((e) => e.event_type === 'placement' && e.event_date);
      if (placement) pickupDates.push(placement.event_date);
      for (const e of events) {
        if (HEALTH_VISIT_TYPES.includes(e.event_type) && e.event_date) {
          vetVisits.push({ date: e.event_date, label: typeLabel(e.event_type) });
        }
      }
    }
    const gov = contractRepo.governingContract(await contractRepo.getBySale(sale.id));
    if (gov && gov.document_url) contractUrls.push(gov.document_url);
  }

  vetVisits.sort((a, b) => a.date.localeCompare(b.date));

  const bundle = {
    bundleVersion: COMPANION_BUNDLE_VERSION,
    bundleType: 'family',
    ...h,
    familyName: contact.name || '',
    pups,
    litters: [...littersByWhelp.values()],
    pickupDates,
    vetVisits,
    contractUrls,
    updatedAt: new Date().toISOString()
  };
  return assertOnlyKeys(bundle, FAMILY_KEYS, 'family');
}

// --- Partner: stud services, external-dog pairings, and lease/co_own/other
// contracts where this partner is the counterparty. -------------------------
export async function buildPartnerBundle(contact) {
  const h = headerCopy('partner', contact);

  const services = (await studServiceRepo.getByPartnerContact(contact.id)).filter((s) => !s.is_archived);
  const studServices = [];
  for (const ss of services) {
    const our = await dogRepo.getById(ss.our_dog_id);
    const partner = ss.partner_dog_id ? await dogRepo.getById(ss.partner_dog_id) : null;
    // Direction decides which side is the stud vs. the dam: outgoing = our dog
    // is the stud, incoming = our dog is the dam.
    const studDog = ss.direction === 'incoming' ? partner : our;
    const damDog = ss.direction === 'incoming' ? our : partner;

    let breedingDates = [];
    if (ss.pairing_id) {
      const evs = await eventRepo.getForSubject('pairing', ss.pairing_id);
      breedingDates = evs
        .filter((e) => e.event_type === 'breeding_tie' && e.event_date)
        .map((e) => e.event_date);
    }

    const hasPick = FEE_STRUCTURES_WITH_PICK.includes(ss.fee_structure);
    studServices.push({
      studDog: dogMini(studDog),
      damDog: dogMini(damDog),
      breedingDates,
      compensation: {
        fee_structure: ss.fee_structure || null,
        fee_amount: ss.fee_amount != null && ss.fee_amount !== '' ? ss.fee_amount : null,
        pick_status: hasPick ? (ss.pick_status || null) : null
      }
    });
  }

  // Pairings involving this partner's external/leased-in dogs.
  const theirDogs = await contactRepo.getDogs(contact.id);
  const externalDogIds = theirDogs
    .filter((d) => EXTERNAL_OWNERSHIP.includes(d.ownership_type))
    .map((d) => d.id);
  const pairingsById = new Map();
  for (const dogId of externalDogIds) {
    for (const p of await pairingRepo.getForDog(dogId)) {
      if (!p.is_archived) pairingsById.set(p.id, p);
    }
  }
  const externalPairings = [];
  for (const p of pairingsById.values()) {
    const sire = p.sire_id ? await dogRepo.getById(p.sire_id) : null;
    const dam = p.dam_id ? await dogRepo.getById(p.dam_id) : null;
    externalPairings.push({
      sire: dogMini(sire),
      dam: dogMini(dam),
      status: p.status || null,
      plannedDate: p.planned_date || null
    });
  }

  const contracts = (await contractRepo.getByContact(contact.id))
    .filter((c) => !c.is_archived)
    .map((c) => ({
      type: c.contract_type || null,
      title: c.title || null,
      status: c.status || null,
      document_url: c.document_url || null
    }));

  const bundle = {
    bundleVersion: COMPANION_BUNDLE_VERSION,
    bundleType: 'partner',
    ...h,
    partnerName: contact.name || '',
    studServices,
    externalPairings,
    contracts,
    updatedAt: new Date().toISOString()
  };
  return assertOnlyKeys(bundle, PARTNER_KEYS, 'partner');
}

// Convenience dispatcher used by the Send-Link UI.
export function buildBundle(type, contact) {
  if (type === 'prospective') return buildProspectiveBundle(contact);
  if (type === 'family') return buildFamilyBundle(contact);
  if (type === 'partner') return buildPartnerBundle(contact);
  throw new Error(`Unknown companion bundle type "${type}".`);
}
