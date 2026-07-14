// kennels.js — minimal kennel management (add / rename / archive / delete).
// Delete is blocked while any contact still points at the kennel (KENNEL_REFERENCES).
import { kennelRepo } from '../data/kennelRepo.js';
import { esc, confirmAction } from '../assets/ui.js';

const listEl = document.getElementById('kennel-list');
const errEl = document.getElementById('page-error');

function showError(msg) { errEl.innerHTML = `<div class="inline-error">${esc(msg)}</div>`; }
function clearError() { errEl.innerHTML = ''; }

async function render() {
  const kennels = await kennelRepo.getAll({ includeArchived: true });
  if (!kennels.length) {
    listEl.innerHTML = `<div class="card empty-state">No kennels yet.</div>`;
    return;
  }
  // Compute delete-blockers per kennel so the Delete button can be disabled.
  const blockers = await Promise.all(kennels.map((k) => kennelRepo.getDeleteBlockers(k.id)));
  listEl.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Prefix</th><th>Location</th><th></th></tr></thead><tbody>${
    kennels.map((k, i) => {
      const blocked = blockers[i].length > 0;
      const title = blocked ? 'Referenced by ' + blockers[i].map((b) => `${b.label} (${b.count})`).join(', ') : 'Delete kennel';
      return `<tr class="${k.is_archived ? 'row-archived' : ''}">
        <td><strong>${esc(k.kennel_name)}</strong></td>
        <td>${k.prefix ? esc(k.prefix) : '<span class="faint">—</span>'}</td>
        <td>${k.location ? esc(k.location) : '<span class="faint">—</span>'}</td>
        <td class="pill-row" style="justify-content:flex-end;">
          <button class="btn btn-sm" data-act="rename" data-id="${esc(k.id)}">Rename</button>
          <button class="btn btn-sm" data-act="archive" data-id="${esc(k.id)}">${k.is_archived ? 'Unarchive' : 'Archive'}</button>
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${esc(k.id)}"${blocked ? ' disabled' : ''} title="${esc(title)}">Delete</button>
        </td>
      </tr>`;
    }).join('')
  }</tbody></table>`;

  listEl.querySelectorAll('[data-act]').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => onAction(btn.dataset.act, kennels.find((k) => k.id === btn.dataset.id)));
  });
}

async function onAction(act, kennel) {
  clearError();
  try {
    if (act === 'rename') {
      const name = window.prompt('Kennel name:', kennel.kennel_name);
      if (name && name.trim()) { await kennelRepo.update(kennel.id, { kennel_name: name.trim() }); render(); }
    } else if (act === 'archive') {
      kennel.is_archived ? await kennelRepo.unarchive(kennel.id) : await kennelRepo.archive(kennel.id);
      render();
    } else if (act === 'delete') {
      if (confirmAction(`Delete kennel “${kennel.kennel_name}”? This cannot be undone.`)) {
        await kennelRepo.hardDelete(kennel.id);
        render();
      }
    }
  } catch (e) {
    showError(e.message || String(e));
  }
}

document.getElementById('k-add').addEventListener('click', async () => {
  clearError();
  const name = document.getElementById('k-name').value.trim();
  const prefix = document.getElementById('k-prefix').value.trim();
  const location = document.getElementById('k-location').value.trim();
  try {
    await kennelRepo.create({ kennel_name: name, prefix, location });
    document.getElementById('k-name').value = '';
    document.getElementById('k-prefix').value = '';
    document.getElementById('k-location').value = '';
    render();
  } catch (e) {
    showError(e.message || String(e));
  }
});

render();
