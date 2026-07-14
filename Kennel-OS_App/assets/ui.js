// ui.js — small shared rendering helpers used across pages. No framework;
// just functions that return safe HTML strings or build DOM.
import { descriptor } from '../data/vocab.js';

// Escape untrusted text for safe interpolation into innerHTML.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A colored badge for a single vocab value.
export function badge(vocab, value) {
  const d = descriptor(vocab, value);
  return `<span class="badge ${d.badge}">${esc(d.label)}</span>`;
}

// Multiple badges (e.g. a contact's several types).
export function badges(vocab, values) {
  if (!values || !values.length) return '<span class="faint">—</span>';
  return values.map((v) => badge(vocab, v)).join(' ');
}

// Date-only display: 'YYYY-MM-DD' -> localized medium date, untouched if empty.
export function fmtDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// Today's local date as YYYY-MM-DD (for <input type=date max> and comparisons).
export function todayYMD() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Read ?id= (or any param) from the current URL.
export function param(name) {
  return new URLSearchParams(location.search).get(name);
}

// Populate a <select> from a vocab list. `current` preselects; `placeholder`
// adds a leading empty option when provided.
export function fillSelect(selectEl, vocab, current, placeholder) {
  selectEl.innerHTML = '';
  if (placeholder != null) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    selectEl.appendChild(o);
  }
  for (const v of vocab) {
    const o = document.createElement('option');
    o.value = v.value;
    o.textContent = v.label;
    if (v.value === current) o.selected = true;
    selectEl.appendChild(o);
  }
}

// Minimal confirm wrapper (kept as a seam so we can swap in a nicer modal later).
export function confirmAction(message) {
  return window.confirm(message);
}
