// listView.js — the shared list-screen pattern (Build Brief B3): a search box,
// zero or more filter dropdowns, an "include archived" toggle, and a data table.
// Built once here and reused by the Dog List and Contact List (and later
// Litters/Buyers/etc.).
//
// Data is loaded once (including archived) and filtered in memory — trivial at
// kennel scale and keeps typing in the search box instant.
import { esc } from './ui.js';
import Papa from '../vendor/papaparse.min.mjs';

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
    baseFilter = () => true, // (record) => bool — a fixed predicate applied before
                              // search/filters/archived, e.g. the Buyer view on
                              // Contacts (a filtered view, not a separate table/page)
    csv = null              // optional { filename, columns:[{header, value:(r)=>string}] } —
                             // adds an "Export visible to CSV" button (Navigation
                             // Consolidation Plan v1 §3/§6: Roster's export moves onto Dogs)
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

  if (csv) {
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-sm';
    exportBtn.textContent = '⬇ Export visible to CSV';
    exportBtn.addEventListener('click', () => {
      const rows = visibleRecords();
      const data = rows.map((r) => {
        const o = {};
        for (const c of csv.columns) o[c.header] = c.value(r);
        return o;
      });
      const text = Papa.unparse({ fields: csv.columns.map((c) => c.header), data });
      downloadCsv(csv.filename, text);
    });
    toolbar.appendChild(exportBtn);
  }

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

  // Columns marked `collapse: true` hide on narrow screens (CSS) and move into
  // a per-row expandable detail panel instead, so the table never forces
  // horizontal scroll on a phone. Columns without the flag are always shown.
  const hasCollapse = columns.some((c) => c.collapse);

  function render() {
    const rows = visibleRecords();
    if (!rows.length) {
      tableWrap.innerHTML = `<div class="card empty-state">${esc(emptyText)}</div>`;
      return;
    }
    const head = columns.map((c) => `<th class="${c.collapse ? 'col-collapse' : ''}">${esc(c.header)}</th>`).join('')
      + (hasCollapse ? `<th class="col-toggle"></th>` : '');
    const body = rows.map((r, i) => {
      const cls = [rowClass(r), r.is_archived ? 'row-archived' : '', onRowClick ? 'clickable' : '', 'list-row']
        .filter(Boolean).join(' ');
      const cells = columns.map((c) => `<td class="${[c.className || '', c.collapse ? 'col-collapse' : ''].filter(Boolean).join(' ')}">${c.cell(r)}</td>`).join('');
      const toggleCell = hasCollapse
        ? `<td class="col-toggle"><button type="button" class="row-toggle-btn" aria-label="More details" aria-expanded="false">▸</button></td>`
        : '';
      const mainRow = `<tr class="${cls}" data-idx="${i}">${cells}${toggleCell}</tr>`;
      const detailRow = hasCollapse
        ? `<tr class="row-detail" hidden><td colspan="${columns.length + 1}"><dl class="dl-meta">${
            columns.filter((c) => c.collapse).map((c) => `<dt>${esc(c.header)}</dt><dd>${c.cell(r)}</dd>`).join('')
          }</dl></td></tr>`
        : '';
      return mainRow + detailRow;
    }).join('');
    tableWrap.innerHTML = `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

    if (onRowClick) {
      tableWrap.querySelectorAll('tbody tr.list-row').forEach((tr) => {
        tr.addEventListener('click', () => onRowClick(rows[Number(tr.dataset.idx)]));
      });
    }

    if (hasCollapse) {
      tableWrap.querySelectorAll('.row-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const detailRow = btn.closest('tr').nextElementSibling;
          const open = detailRow.hidden;
          detailRow.hidden = !open;
          btn.textContent = open ? '▾' : '▸';
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
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
