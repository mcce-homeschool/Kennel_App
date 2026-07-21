// settings.js — small localStorage-backed preferences. The single owner of
// localStorage in this app (everything else goes through a repo), mirroring
// KennelOS's discipline.
//
// Keys (under `receipts.*`):
//  - kennelName   : default kennel name stamped on kennel-subject exports so
//                   KennelOS can match your kennel by name (blank is fine — the
//                   importer falls back to your configured "my kennel").
//  - mileageRate  : default $/mile prefilled on the trip form. Match this to the
//                   rate you use in KennelOS for a clean mileage total.
const KEYS = {
  kennelName: 'receipts.kennelName',
  mileageRate: 'receipts.mileageRate'
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
