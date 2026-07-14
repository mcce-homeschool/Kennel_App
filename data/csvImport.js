// csvImport.js — the generic CSV match-or-create engine (Build Brief A3/B2,
// Data Model doc §8). Lives in the data layer: it parses a file (via the
// vendored PapaParse), classifies every row against existing records as
// create / update / needs-review in a DRY RUN, and only writes on an explicit
// commit. The engine is entity-agnostic — each entity contributes a small
// *mapping* (column names, natural key, normalizers, repo). Stage 2 wires in
// Dog and Contact; later stages add their own mapping to this same engine
// rather than rebuilding it.
//
// The rule that shapes everything (Data Model §8): a natural key is only valid
// if it is NON-EMPTY. Keyless / partial-key rows are never auto-matched and
// never silently created — they land in "needs review," where the user decides.
import Papa from '../vendor/papaparse.min.mjs';
import { dogRepo } from './dogRepo.js';
import { contactRepo } from './contactRepo.js';
import { kennelRepo } from './kennelRepo.js';
import { SEX, OWNERSHIP_TYPE, DOG_STATUS, CONTACT_TYPE } from './vocab.js';

// --- Parsing --------------------------------------------------------------
// Headers are normalized to lower_snake_case so "Registered Name", "registered
// name", and "registered_name" all resolve to the same key. Values are trimmed.
export function parseCsv(fileOrText) {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      transform: (v) => (typeof v === 'string' ? v.trim() : v),
      complete: (res) => resolve({ rows: res.data, fields: res.meta.fields || [], errors: res.errors || [] }),
      error: (err) => reject(err)
    });
  });
}

// --- Shared normalizers ---------------------------------------------------
// Read a column allowing a few aliases; returns '' when absent/blank.
function col(row, ...names) {
  for (const n of names) {
    const v = row[n];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// Coerce free text to a controlled-vocab value. Returns '' (blank), the value,
// or null (present but unrecognized — the caller decides how loud to be).
function normEnum(vocab, raw, extra = {}) {
  if (!raw) return '';
  const s = raw.trim();
  const k = s.toLowerCase().replace(/\s+/g, '_');
  if (extra[k]) return extra[k];
  const hit = vocab.find((v) => v.value === k || v.label.toLowerCase() === s.toLowerCase());
  return hit ? hit.value : null;
}

// Normalize a date to YYYY-MM-DD. Accepts ISO and US M/D/YYYY. Returns ''
// (blank), a valid YYYY-MM-DD string, or null (present but unrecognized).
function normDate(raw) {
  if (!raw) return '';
  const s = raw.trim();
  let y, m, d;
  let hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (hit) { [, y, m, d] = hit; }
  else if ((hit = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/))) { [, m, d, y] = hit; } // US M/D/Y
  else return null;
  const mm = Number(m), dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const ymd = `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const check = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(check.getTime()) ? null : ymd;
}

// Split a delimited multi-value cell ("breeder; vet") into trimmed parts.
function splitList(raw) {
  if (!raw) return [];
  return raw.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
}

// Natural-key string: name (case-insensitive, trimmed) + exact DOB, joined by a
// NUL that can't appear in real data, so distinct name/DOB pairs never collide.
function nk(name, dob) {
  return `${name.trim().toLowerCase()}\u0000${dob}`;
}

// =========================================================================
// Dog mapping
// =========================================================================
// Natural key: registered_name + date_of_birth, falling back to
// call_name + date_of_birth (Data Model §8). A row with no DOB, or with no
// name at all, cannot form a key → needs review.
const DOG_MAPPING = {
  entity: 'dog',
  label: 'Dogs',
  // Columns the importer understands (for the on-page template/help).
  templateHeaders: [
    'call_name', 'registered_name', 'sex', 'date_of_birth', 'breed',
    'sire_registered_name', 'dam_registered_name', 'ownership_type', 'status',
    'color_markings', 'registry', 'registration_number', 'microchip_id', 'notes'
  ],
  requiredForCreate: ['call_name', 'sex', 'breed', 'ownership_type', 'status'],

  loadExisting: () => dogRepo.getAll({ includeArchived: true }),

  buildIndex(existing) {
    const byReg = new Map();   // registered_name+dob -> id
    const byCall = new Map();  // call_name+dob -> id
    const byName = new Map();  // any name -> id (for sire/dam resolution)
    for (const d of existing) {
      if (d.registered_name && d.date_of_birth) byReg.set(nk(d.registered_name, d.date_of_birth), d);
      if (d.call_name && d.date_of_birth) byCall.set(nk(d.call_name, d.date_of_birth), d);
      if (d.registered_name) byName.set(d.registered_name.trim().toLowerCase(), d);
      const ck = d.call_name?.trim().toLowerCase();
      if (ck && !byName.has(ck)) byName.set(ck, d);
    }
    return { byReg, byCall, byName };
  },

  classify(row, index, i) {
    const reasons = [];
    const reg = col(row, 'registered_name', 'reg_name');
    const call = col(row, 'call_name', 'name');
    const dobRaw = col(row, 'date_of_birth', 'dob', 'birthdate');
    const dob = normDate(dobRaw);
    if (dob === null) reasons.push(`Unrecognized date_of_birth "${dobRaw}".`);

    const sex = normEnum(SEX, col(row, 'sex'), { m: 'male', f: 'female' });
    if (sex === null) reasons.push(`Unrecognized sex "${col(row, 'sex')}".`);
    const ownership = normEnum(OWNERSHIP_TYPE, col(row, 'ownership_type', 'ownership'));
    if (ownership === null) reasons.push(`Unrecognized ownership_type "${col(row, 'ownership_type', 'ownership')}".`);
    const status = normEnum(DOG_STATUS, col(row, 'status'));
    if (status === null) reasons.push(`Unrecognized status "${col(row, 'status')}".`);

    // Full create-ready record (only non-blank, recognized fields set).
    const record = {};
    if (call) record.call_name = call;
    if (reg) record.registered_name = reg;
    if (sex) record.sex = sex;
    if (dob) record.date_of_birth = dob;
    const breed = col(row, 'breed');
    if (breed) record.breed = breed;
    if (ownership) record.ownership_type = ownership;
    if (status) record.status = status;
    for (const [key, ...aliases] of [
      ['color_markings', 'color', 'markings'], ['registry'], ['registration_number', 'reg_number'],
      ['microchip_id', 'microchip'], ['notes']
    ]) {
      const v = col(row, key, ...aliases);
      if (v) record[key] = v;
    }

    // Sire / dam: resolve names against EXISTING dogs (Data Model §8.2). A named
    // parent that doesn't resolve is flagged (never silently dropped).
    const unresolved = [];
    for (const [nameCol, idField, roleLabel] of [
      ['sire_registered_name', 'sire_id', 'Sire'], ['dam_registered_name', 'dam_id', 'Dam']
    ]) {
      const pName = col(row, nameCol, nameCol.replace('_registered_name', '_name'));
      if (!pName) continue;
      const hit = index.byName.get(pName.toLowerCase());
      if (hit) record[idField] = hit.id;
      else { unresolved.push(`${roleLabel} "${pName}" not found`); }
    }

    // Natural key → match-or-create.
    const hasName = !!(reg || call);
    const validKey = hasName && !!dob;
    let status_ = 'create';
    let match = null;
    if (!validKey) {
      status_ = 'review';
      if (!hasName) reasons.push('No registered_name or call_name — cannot form a natural key.');
      if (!dob) reasons.push('No date_of_birth — cannot form a natural key.');
    } else {
      match = (reg && index.byReg.get(nk(reg, dob))) || (call && index.byCall.get(nk(call, dob))) || null;
      status_ = match ? 'update' : 'create';
    }

    // A create must satisfy the repo's required fields; if not, review it so the
    // user sees exactly what's missing instead of hitting a commit-time failure.
    if (status_ === 'create') {
      const missing = this.requiredForCreate.filter((f) => !record[f]);
      if (missing.length) { status_ = 'review'; reasons.push(`Missing required field(s) for a new dog: ${missing.join(', ')}.`); }
    }
    // Unresolved parents push a create/update row to review (fixable, or apply anyway).
    if (unresolved.length) { if (status_ !== 'review') status_ = 'review'; reasons.push(unresolved.join('; ') + '.'); }

    const display = reg || call || `(row ${i + 2})`;
    return {
      index: i, raw: row, entity: 'dog', display,
      record,                             // create payload
      changes: buildDogChanges(record),   // update payload (same recognized fields)
      status: status_, match, matchLabel: match ? (match.registered_name || match.call_name) : '',
      reasons,
      decision: status_ === 'review' ? 'skip' : status_,
      decisionTarget: match ? match.id : null
    };
  },

  // Human label for an existing record (used by the "match to existing" picker).
  describe: (d) => (d.registered_name || d.call_name || '(unnamed dog)') + (d.date_of_birth ? ` — ${d.date_of_birth}` : '') + (d.is_archived ? ' (archived)' : ''),

  repo: dogRepo
};

// For an update we apply the same recognized fields the create would set (blank
// CSV cells never overwrite existing data, since they were never added above).
function buildDogChanges(record) {
  return { ...record };
}

// =========================================================================
// Contact mapping
// =========================================================================
// Natural key: name (case-insensitive, trimmed). Nameless → needs review.
const CONTACT_MAPPING = {
  entity: 'contact',
  label: 'Contacts',
  templateHeaders: ['name', 'contact_type', 'email', 'phone', 'address', 'kennel_name', 'notes'],
  requiredForCreate: ['name'],

  async loadExisting() {
    const [contacts, kennels] = await Promise.all([
      contactRepo.getAll({ includeArchived: true }),
      kennelRepo.getAll({ includeArchived: true })
    ]);
    this._kennels = kennels;
    return contacts;
  },

  buildIndex(existing) {
    const byName = new Map();
    for (const c of existing) if (c.name) byName.set(c.name.trim().toLowerCase(), c);
    const kennelByName = new Map();
    for (const k of this._kennels || []) if (k.kennel_name) kennelByName.set(k.kennel_name.trim().toLowerCase(), k);
    return { byName, kennelByName };
  },

  classify(row, index, i) {
    const reasons = [];
    const name = col(row, 'name', 'contact_name');
    const record = {};
    if (name) record.name = name;

    const typesRaw = splitList(col(row, 'contact_type', 'type', 'types'));
    if (typesRaw.length) {
      const types = [];
      for (const t of typesRaw) {
        const v = normEnum(CONTACT_TYPE, t);
        if (v) types.push(v);
        else reasons.push(`Unrecognized contact_type "${t}" (ignored).`);
      }
      if (types.length) record.contact_type = types;
    }
    for (const [key, ...aliases] of [['email'], ['phone', 'telephone'], ['address'], ['notes']]) {
      const v = col(row, key, ...aliases);
      if (v) record[key] = v;
    }
    // Kennel by name → existing kennel only (left blank + flagged if unknown).
    const kName = col(row, 'kennel_name', 'kennel');
    if (kName) {
      const hit = index.kennelByName.get(kName.toLowerCase());
      if (hit) record.kennel_id = hit.id;
      else reasons.push(`Kennel "${kName}" not found (left blank).`);
    }

    let status_ = 'create';
    let match = null;
    if (!name) {
      status_ = 'review';
      reasons.push('No name — cannot form a natural key.');
    } else {
      match = index.byName.get(name.toLowerCase()) || null;
      status_ = match ? 'update' : 'create';
    }

    const display = name || `(row ${i + 2})`;
    return {
      index: i, raw: row, entity: 'contact', display,
      record, changes: { ...record },
      status: status_, match, matchLabel: match ? match.name : '',
      reasons,
      decision: status_ === 'review' ? 'skip' : status_,
      decisionTarget: match ? match.id : null
    };
  },

  describe: (c) => (c.name || '(unnamed contact)') + (c.is_archived ? ' (archived)' : ''),

  repo: contactRepo
};

const MAPPINGS = { dog: DOG_MAPPING, contact: CONTACT_MAPPING };

export function getMapping(entity) {
  const m = MAPPINGS[entity];
  if (!m) throw new Error(`Unknown import entity "${entity}".`);
  return m;
}

// --- Dry-run plan ---------------------------------------------------------
// Classify every row against current records. Returns { rows, summary }.
export async function buildPlan(entity, rows) {
  const mapping = getMapping(entity);
  const existing = await mapping.loadExisting();
  const index = mapping.buildIndex(existing);
  const plan = rows.map((row, i) => mapping.classify(row, index, i));
  return { rows: plan, summary: summarize(plan), existing };
}

export function summarize(plan) {
  const s = { create: 0, update: 0, review: 0, skip: 0 };
  for (const r of plan) {
    s[r.status] = (s[r.status] || 0) + 1;
  }
  return s;
}

// --- Commit ---------------------------------------------------------------
// Applies each row's *decision* (create / update / skip). Rows are independent:
// one failure is recorded and the rest still import.
export async function commitPlan(entity, plan) {
  const mapping = getMapping(entity);
  const result = { created: 0, updated: 0, skipped: 0, failed: [] };
  for (const r of plan) {
    try {
      if (r.decision === 'create') {
        await mapping.repo.create(r.record);
        result.created++;
      } else if (r.decision === 'update') {
        const id = r.decisionTarget || r.match?.id;
        if (!id) throw new Error('No target record to update.');
        await mapping.repo.update(id, r.changes);
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (e) {
      result.failed.push({ index: r.index, display: r.display, message: e.message || String(e) });
    }
  }
  return result;
}
