// listView.js — the shared list-screen pattern (Build Brief B3): a search box,
// zero or more filter dropdowns, an "include archived" toggle, and a data table.
// Built once here and reused by the Dog List and Contact List (and later
// Litters/Buyers/etc.).
//
// Data is loaded once (including archived) and filtered in memory — trivial at
// kennel scale and keeps typing in the search box instant.
import { esc } from './ui.js';

export function createListView(opts) {
  const {
    mount,                 // container element to render into
    search,                // { placeholder, text: (record) => string } — searchable text
    filters = [],          // [{ id, label, options:[{value,label}], match:(record,value)=>bool }]
    columns,               // [{ header, cell:(record)=>htmlString, className? }]
    rowClass = () => '',   // (record) => extra <tr> class
    onRowClick,            // (record) => void
    load,                  // async ({ includeArchived }) => records[]
    emptyText = 'No records yet.',
    baseFilter = () => true // (record) => bool — a fixed predicate applied before
                             // search/filters/archived, e.g. the Buyer view on
                             // Contacts (a filtered view, not a separate table/page)
  } = opts;

  let all = [];
  const state = { q: '', showArchived: false, filters: {} };

  // --- Build toolbar ---
  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = search?.placeholder || 'Search…';
  searchInput.addEventListener('input', () => { state.q = searchInput.value.trim().toLowerCase(); render(); });
  toolbar.appendChild(searchInput);

  for (const f of filters) {
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', f.label);
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = f.label + ': All';
    sel.appendChild(optAll);
    for (const o of f.options) {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      sel.appendChild(el);
    }
    sel.addEventListener('change', () => { state.filters[f.id] = sel.value; render(); });
    toolbar.appendChild(sel);
  }

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  const archLabel = document.createElement('label');
  archLabel.className = 'check-inline';
  const archCheck = document.createElement('input');
  archCheck.type = 'checkbox';
  archCheck.addEventListener('change', () => { state.showArchived = archCheck.checked; render(); });
  archLabel.appendChild(archCheck);
  archLabel.appendChild(document.createTextNode(' Show archived'));
  toolbar.appendChild(archLabel);

  const tableWrap = document.createElement('div');

  mount.innerHTML = '';
  mount.appendChild(toolbar);
  mount.appendChild(tableWrap);

  function visibleRecords() {
    return all.filter((r) => {
      if (!baseFilter(r)) return false;
      if (!state.showArchived && r.is_archived) return false;
      if (state.q && search?.text) {
        if (!search.text(r).toLowerCase().includes(state.q)) return false;
      }
      for (const f of filters) {
        const v = state.filters[f.id];
        if (v && !f.match(r, v)) return false;
      }
      return true;
    });
  }

  function render() {
    const rows = visibleRecords();
    if (!rows.length) {
      tableWrap.innerHTML = `<div class="card empty-state">${esc(emptyText)}</div>`;
      return;
    }
    const head = columns.map((c) => `<th>${esc(c.header)}</th>`).join('');
    const body = rows.map((r, i) => {
      const cls = [rowClass(r), r.is_archived ? 'row-archived' : '', onRowClick ? 'clickable' : '']
        .filter(Boolean).join(' ');
      const cells = columns.map((c) => `<td class="${c.className || ''}">${c.cell(r)}</td>`).join('');
      return `<tr class="${cls}" data-idx="${i}">${cells}</tr>`;
    }).join('');
    tableWrap.innerHTML = `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

    if (onRowClick) {
      tableWrap.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => onRowClick(rows[Number(tr.dataset.idx)]));
      });
    }
  }

  async function refresh() {
    all = await load({ includeArchived: true });
    render();
  }

  refresh();
  return { refresh, get records() { return all; } };
}
