// settings.js — small localStorage-backed preferences. The single owner of
// localStorage in this app (everything else goes through a repo), mirroring
// KennelOS's discipline.
//
// Keys (under `receipts.*`):
//  - kennelName   : default kennel name stamped on kennel-subject exports so
//                   KennelOS can match your kennel by name (blank is fine — the
//                   importer falls back to your configured "my kennel").
//  - mileageRate  : default $/mile prefilled on the trip form.
//  - seq          : monotonic counter behind the auto-assigned receipt number.
//  - businesses   : JSON array of business names you track (this app can serve
//                   more than one business; e.g. "Thornfield Kennels", "Etsy
//                   shop"). Used to tag each entry and to scope an export.
//  - defaultBusiness : the business prefilled on a new entry.
const KEYS = {
  kennelName: 'receipts.kennelName',
  mileageRate: 'receipts.mileageRate',
  seq: 'receipts.seq',
  businesses: 'receipts.businesses',
  defaultBusiness: 'receipts.defaultBusiness',
  customCategories: 'receipts.customCategories'
};

const DEFAULTS = { kennelName: '', mileageRate: 0.70 };

export function getKennelName() {
  return localStorage.getItem(KEYS.kennelName) ?? DEFAULTS.kennelName;
}
export function setKennelName(v) {
  localStorage.setItem(KEYS.kennelName, String(v ?? '').trim());
}

export function getMileageRate() {
  const raw = localStorage.getItem(KEYS.mileageRate);
  const n = raw == null ? DEFAULTS.mileageRate : Number(raw);
  return Number.isFinite(n) ? n : DEFAULTS.mileageRate;
}
export function setMileageRate(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) localStorage.setItem(KEYS.mileageRate, String(n));
}

// --- Receipt numbers ------------------------------------------------------
// Auto-assigned, human-facing, monotonic. Format R-0001, R-0002, … Never
// reused. This number is what ties an entry to its row in KennelOS (which now
// has a matching "Receipt #" field), so you can relate them at tax time.
export function nextReceiptNumber() {
  const cur = Number(localStorage.getItem(KEYS.seq) || '0');
  const next = (Number.isFinite(cur) ? cur : 0) + 1;
  localStorage.setItem(KEYS.seq, String(next));
  return `R-${String(next).padStart(4, '0')}`;
}

// --- Businesses -----------------------------------------------------------
export function getBusinesses() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEYS.businesses) || '[]');
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
  } catch {
    return [];
  }
}
export function setBusinesses(list) {
  const clean = [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))];
  localStorage.setItem(KEYS.businesses, JSON.stringify(clean));
  return clean;
}
export function addBusiness(name) {
  const n = String(name || '').trim();
  if (!n) return getBusinesses();
  return setBusinesses([...getBusinesses(), n]);
}
export function removeBusiness(name) {
  return setBusinesses(getBusinesses().filter((b) => b !== name));
}
export function getDefaultBusiness() {
  const v = localStorage.getItem(KEYS.defaultBusiness) || '';
  // Only honor it if still a configured business, else fall back to the first.
  const list = getBusinesses();
  if (v && list.includes(v)) return v;
  return list[0] || '';
}
export function setDefaultBusiness(v) {
  localStorage.setItem(KEYS.defaultBusiness, String(v ?? '').trim());
}

// --- Custom categories ----------------------------------------------------
// Your own categories, on top of the KennelOS-mirrored built-ins. A custom
// category exports as-is; KennelOS soft-maps any category it doesn't recognize
// to "Other" — so custom categories are best for non-kennel businesses you scope
// out of the KennelOS export.
export function getCustomCategories() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEYS.customCategories) || '[]');
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
  } catch {
    return [];
  }
}
export function setCustomCategories(list) {
  const clean = [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))];
  localStorage.setItem(KEYS.customCategories, JSON.stringify(clean));
  return clean;
}
export function addCustomCategory(name) {
  const n = String(name || '').trim();
  if (!n) return getCustomCategories();
  return setCustomCategories([...getCustomCategories(), n]);
}
export function removeCustomCategory(name) {
  return setCustomCategories(getCustomCategories().filter((c) => c !== name));
}
