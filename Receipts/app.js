// app.js — the Receipts app controller. Single-page: a list of captured costs
// (receipts + trip logs) with capture/edit forms, an export-to-KennelOS action,
// and settings. Local-first, offline; all data via the repos (never db.* from
// here), all localStorage via settings.js — the same layering discipline as
// KennelOS.
import { entryRepo, effectiveAmount } from './data/entryRepo.js';
import { photoRepo } from './data/photoRepo.js';
import { buildCsv, downloadCsv, summarize } from './data/csvExport.js';
import { EXPENSE_CATEGORIES, SUBJECT_TYPES, categoryLabel } from './data/vocab.js';
import { getKennelName, setKennelName, getMileageRate, setMileageRate } from './data/settings.js';
import * as ocr from './data/ocr.js';
import { esc, fmtMoney, fmtDate, todayYMD, toast, openModal } from './assets/ui.js';

let ocrAvailable = false;
let filterMode = 'all'; // 'all' | 'unexported'

// ---- Register the service worker (PWA / offline) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

async function init() {
  document.getElementById('btn-receipt').addEventListener('click', () => openReceiptForm());
  document.getElementById('btn-trip').addEventListener('click', () => openTripForm());
  document.getElementById('btn-export').addEventListener('click', openExport);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filterMode = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
    renderList();
  }));
  ocr.isAvailable().then((v) => { ocrAvailable = v; }).catch(() => { ocrAvailable = false; });
  await renderList();
}

// ---------------------------------------------------------------- list ----
async function renderList() {
  const listEl = document.getElementById('list');
  const all = await entryRepo.getAll();
  const entries = filterMode === 'unexported' ? all.filter((e) => !e.exported_at) : all;

  const unexported = all.filter((e) => !e.exported_at).length;
  const badge = document.getElementById('unexported-count');
  badge.textContent = unexported ? String(unexported) : '';
  badge.style.display = unexported ? '' : 'none';

  if (!entries.length) {
    listEl.innerHTML = `<div class="empty">
      <p class="empty-emoji">🧾</p>
      <p><strong>${all.length ? 'Nothing here with this filter.' : 'No receipts or trips yet.'}</strong></p>
      <p class="muted">${all.length ? 'Switch back to “All”.' : 'Tap <strong>＋ Receipt</strong> to snap one, or <strong>＋ Trip</strong> to log mileage.'}</p>
    </div>`;
    return;
  }

  // Render cards (thumbnails fetched async and slotted in).
  listEl.innerHTML = entries.map(cardHtml).join('');
  listEl.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = entries.find((x) => x.id === el.dataset.open);
      if (entry.kind === 'trip') openTripForm(entry); else openReceiptForm(entry);
    });
  });
  for (const e of entries) {
    if (!e.photo_id) continue;
    photoRepo.getThumbnail(e.photo_id).then((thumb) => {
      const img = listEl.querySelector(`[data-thumb="${e.id}"]`);
      if (img && thumb) { img.style.backgroundImage = `url(${thumb})`; img.classList.add('has-img'); }
    });
  }
}

function cardHtml(e) {
  const amt = effectiveAmount(e);
  const isTrip = e.kind === 'trip';
  const subj = e.subject_type === 'dog' ? esc(e.subject_name || 'Dog') : (esc(e.subject_name) || 'Kennel');
  const meta = isTrip
    ? `${e.miles ?? '?'} mi × ${fmtMoney(e.mileage_rate)}`
    : (e.vendor ? esc(e.vendor) : categoryLabel(e.category));
  const exportedTag = e.exported_at ? `<span class="tag tag-exported">exported</span>` : '';
  return `<button class="card" data-open="${esc(e.id)}">
    <div class="card-thumb ${isTrip ? 'is-trip' : ''}" data-thumb="${esc(e.id)}">${isTrip ? '🚗' : '🧾'}</div>
    <div class="card-body">
      <div class="card-top">
        <span class="card-amount">${fmtMoney(amt)}</span>
        <span class="card-date">${esc(fmtDate(e.entry_date))}</span>
      </div>
      <div class="card-sub">
        <span class="chip chip-${esc(e.category)}">${esc(categoryLabel(e.category))}</span>
        <span class="card-subject">${subj}</span>
      </div>
      <div class="card-meta">${meta}${exportedTag}</div>
    </div>
  </button>`;
}

// ---------------------------------------------------- shared form bits ----
function categoryOptions(selected) {
  return EXPENSE_CATEGORIES.map((c) => `<option value="${esc(c.value)}"${c.value === selected ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
}
function subjectTypeOptions(selected) {
  return SUBJECT_TYPES.map((s) => `<option value="${esc(s.value)}"${s.value === selected ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
}

// Subject picker: a type dropdown + a name box that shows only for "dog"
// (a kennel row uses your default kennel name, editable).
function subjectFields(entry) {
  const type = entry?.subject_type || 'kennel';
  const name = entry?.subject_name ?? (type === 'kennel' ? getKennelName() : '');
  return `
    <label>Attach to
      <select name="subject_type">${subjectTypeOptions(type)}</select>
    </label>
    <label data-subject-name style="${type === 'dog' ? '' : 'display:none;'}">Dog's name (as in KennelOS)
      <input type="text" name="subject_name_dog" value="${esc(type === 'dog' ? name : '')}" placeholder="e.g. Juno" autocomplete="off">
    </label>
    <label data-subject-kennel style="${type === 'kennel' ? '' : 'display:none;'}">Kennel name <span class="muted">(optional)</span>
      <input type="text" name="subject_name_kennel" value="${esc(type === 'kennel' ? name : '')}" placeholder="${esc(getKennelName() || 'your kennel')}" autocomplete="off">
    </label>`;
}

function wireSubjectFields(root) {
  const sel = root.querySelector('[name=subject_type]');
  sel.addEventListener('change', () => {
    root.querySelector('[data-subject-name]').style.display = sel.value === 'dog' ? '' : 'none';
    root.querySelector('[data-subject-kennel]').style.display = sel.value === 'kennel' ? '' : 'none';
  });
}

function readSubject(form) {
  const subject_type = form.subject_type.value;
  const subject_name = subject_type === 'dog'
    ? form.subject_name_dog.value.trim()
    : form.subject_name_kennel.value.trim();
  return { subject_type, subject_name };
}

// ------------------------------------------------------- receipt form ----
function openReceiptForm(entry) {
  const isNew = !entry;
  let photoId = entry?.photo_id || null;
  const createdPhotos = []; // photos captured this session (cleaned up on cancel-of-new)

  const { el, close } = openModal(`
    <div class="modal-head">
      <h2>${isNew ? 'New receipt' : 'Edit receipt'}</h2>
      <button class="icon-btn" data-close aria-label="Close">✕</button>
    </div>
    <form id="rform" class="form">
      <div class="photo-zone" id="photo-zone">
        <div class="photo-preview" id="photo-preview">${photoId ? '' : '<span class="muted">No photo yet</span>'}</div>
        <div class="photo-actions">
          <label class="btn btn-soft">
            📷 ${photoId ? 'Replace photo' : 'Add photo'}
            <input type="file" accept="image/*" capture="environment" id="photo-input" hidden>
          </label>
          <button type="button" class="btn btn-soft" id="scan-btn" ${photoId ? '' : 'disabled'} style="${ocrAvailable ? '' : 'display:none;'}">✨ Scan text</button>
          <button type="button" class="btn btn-link" id="view-photo" style="${photoId ? '' : 'display:none;'}">View</button>
        </div>
        <div class="scan-status muted" id="scan-status"></div>
      </div>

      <div class="grid2">
        <label>Amount
          <input type="number" step="0.01" min="0" inputmode="decimal" name="amount" value="${entry?.amount ?? ''}" placeholder="0.00" required>
        </label>
        <label>Date
          <input type="date" name="entry_date" value="${esc(entry?.entry_date || todayYMD())}" required>
        </label>
      </div>
      <label>Category
        <select name="category">${categoryOptions(entry?.category || 'supplies')}</select>
      </label>
      <label>Vendor / store
        <input type="text" name="vendor" value="${esc(entry?.vendor || '')}" placeholder="e.g. Tractor Supply" autocomplete="off">
      </label>
      ${subjectFields(entry)}
      <label>Notes
        <textarea name="notes" rows="2" placeholder="Optional">${esc(entry?.notes || '')}</textarea>
      </label>

      <div class="form-actions">
        ${isNew ? '' : '<button type="button" class="btn btn-danger" id="del-btn">Delete</button>'}
        <span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Save' : 'Update'}</button>
      </div>
    </form>`, () => {
    // On dismissal of a NEW entry that was never saved, drop any orphaned photo.
    if (isNew && !saved) createdPhotos.forEach((id) => photoRepo.remove(id));
  });

  let saved = false;
  const form = el.querySelector('#rform');
  const preview = el.querySelector('#photo-preview');
  const scanBtn = el.querySelector('#scan-btn');
  const scanStatus = el.querySelector('#scan-status');
  wireSubjectFields(form);

  async function showThumb(id) {
    const thumb = await photoRepo.getThumbnail(id);
    preview.innerHTML = thumb ? `<img src="${thumb}" alt="receipt">` : '<span class="muted">Photo stored</span>';
  }
  if (photoId) showThumb(photoId);

  el.querySelector('#photo-input').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const newId = await photoRepo.create(file);
    createdPhotos.push(newId);
    photoId = newId;
    await showThumb(photoId);
    scanBtn.disabled = false;
    el.querySelector('#view-photo').style.display = '';
    // Auto-scan on a fresh capture if OCR is available.
    if (ocrAvailable) runScan(file);
  });

  el.querySelector('#view-photo').addEventListener('click', () => viewPhoto(photoId));
  scanBtn.addEventListener('click', async () => {
    const p = await photoRepo.get(photoId);
    if (p?.blob) runScan(p.blob);
  });

  async function runScan(blob) {
    scanBtn.disabled = true;
    scanStatus.textContent = 'Reading receipt…';
    try {
      const { amount, date, vendor } = await ocr.scan(blob, (pr) => {
        scanStatus.textContent = `Reading receipt… ${Math.round(pr * 100)}%`;
      });
      let filled = [];
      if (amount != null && !form.amount.value) { form.amount.value = amount; filled.push('amount'); }
      if (date && form.entry_date.value === todayYMD()) { form.entry_date.value = date; filled.push('date'); }
      if (vendor && !form.vendor.value) { form.vendor.value = vendor; filled.push('vendor'); }
      scanStatus.textContent = filled.length
        ? `Filled ${filled.join(', ')} — please double-check.`
        : 'Couldn’t read the details — enter them by hand.';
    } catch (err) {
      scanStatus.textContent = 'Scan unavailable — enter the details by hand.';
      ocrAvailable = false;
    } finally {
      scanBtn.disabled = false;
    }
  }

  if (!isNew) el.querySelector('#del-btn').addEventListener('click', () => confirmDelete(entry, close));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = {
      kind: 'receipt',
      entry_date: form.entry_date.value,
      amount: form.amount.value,
      category: form.category.value,
      vendor: form.vendor.value,
      notes: form.notes.value,
      photo_id: photoId,
      ...readSubject(form)
    };
    try {
      if (isNew) await entryRepo.create(data); else await entryRepo.update(entry.id, data);
      saved = true;
      close();
      toast(isNew ? 'Receipt saved' : 'Receipt updated');
      renderList();
    } catch (err) {
      toast(err.message || 'Could not save', 'err');
    }
  });
}

// ---------------------------------------------------------- trip form ----
function openTripForm(entry) {
  const isNew = !entry;
  let photoId = entry?.photo_id || null;
  const createdPhotos = [];

  const { el, close } = openModal(`
    <div class="modal-head">
      <h2>${isNew ? 'Log a trip' : 'Edit trip'}</h2>
      <button class="icon-btn" data-close aria-label="Close">✕</button>
    </div>
    <form id="tform" class="form">
      <div class="grid2">
        <label>Date
          <input type="date" name="entry_date" value="${esc(entry?.entry_date || todayYMD())}" required>
        </label>
        <label>Miles
          <input type="number" step="0.1" min="0" inputmode="decimal" name="miles" value="${entry?.miles ?? ''}" placeholder="0" required>
        </label>
      </div>
      <label>Rate per mile
        <input type="number" step="0.001" min="0" inputmode="decimal" name="mileage_rate" value="${entry?.mileage_rate ?? getMileageRate()}" required>
      </label>
      <div class="mileage-preview muted" id="mileage-preview"></div>
      ${subjectFields(entry)}
      <label>Purpose / notes
        <input type="text" name="notes" value="${esc(entry?.notes || '')}" placeholder="e.g. Vet run — Juno, or delivering a puppy" autocomplete="off">
      </label>
      <div class="photo-actions">
        <label class="btn btn-soft">📷 ${photoId ? 'Replace photo' : 'Add photo (optional)'}
          <input type="file" accept="image/*" capture="environment" id="tphoto-input" hidden></label>
        <button type="button" class="btn btn-link" id="tview-photo" style="${photoId ? '' : 'display:none;'}">View</button>
      </div>
      <div class="form-actions">
        ${isNew ? '' : '<button type="button" class="btn btn-danger" id="tdel-btn">Delete</button>'}
        <span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Save' : 'Update'}</button>
      </div>
    </form>`, () => {
    if (isNew && !saved) createdPhotos.forEach((id) => photoRepo.remove(id));
  });

  let saved = false;
  const form = el.querySelector('#tform');
  const previewEl = el.querySelector('#mileage-preview');
  wireSubjectFields(form);

  function updatePreview() {
    const miles = Number(form.miles.value);
    const rate = Number(form.mileage_rate.value);
    previewEl.textContent = (Number.isFinite(miles) && Number.isFinite(rate) && form.miles.value !== '')
      ? `= ${fmtMoney(Math.round((miles * rate + Number.EPSILON) * 100) / 100)}  (${miles} mi × ${fmtMoney(rate)}/mi)`
      : '';
  }
  form.miles.addEventListener('input', updatePreview);
  form.mileage_rate.addEventListener('input', updatePreview);
  updatePreview();

  el.querySelector('#tphoto-input').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    photoId = await photoRepo.create(file);
    createdPhotos.push(photoId);
    el.querySelector('#tview-photo').style.display = '';
    toast('Photo attached');
  });
  el.querySelector('#tview-photo').addEventListener('click', () => viewPhoto(photoId));
  if (!isNew) el.querySelector('#tdel-btn').addEventListener('click', () => confirmDelete(entry, close));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = {
      kind: 'trip',
      entry_date: form.entry_date.value,
      miles: form.miles.value,
      mileage_rate: form.mileage_rate.value,
      notes: form.notes.value,
      photo_id: photoId,
      ...readSubject(form)
    };
    try {
      if (isNew) await entryRepo.create(data); else await entryRepo.update(entry.id, data);
      saved = true;
      close();
      toast(isNew ? 'Trip logged' : 'Trip updated');
      renderList();
    } catch (err) {
      toast(err.message || 'Could not save', 'err');
    }
  });
}

// ---------------------------------------------------------- helpers -------
async function viewPhoto(photoId) {
  if (!photoId) return;
  const url = await photoRepo.getObjectUrl(photoId);
  if (!url) return;
  const { close } = openModal(`<div class="photo-full"><img src="${url}" alt="receipt photo"><div class="form-actions"><span class="spacer"></span><button class="btn" data-close>Close</button></div></div>`, () => URL.revokeObjectURL(url));
}

function confirmDelete(entry, closeParent) {
  const { close } = openModal(`
    <div class="modal-head"><h2>Delete this ${entry.kind}?</h2></div>
    <p class="muted">This removes the entry${entry.photo_id ? ' and its photo' : ''} permanently. This can’t be undone.</p>
    <div class="form-actions"><span class="spacer"></span>
      <button class="btn" data-close>Keep</button>
      <button class="btn btn-danger" id="really-del">Delete</button>
    </div>`);
  document.getElementById('really-del').addEventListener('click', async () => {
    await entryRepo.remove(entry.id);
    close();
    closeParent();
    toast('Deleted');
    renderList();
  });
}

// ---------------------------------------------------------- export --------
async function openExport() {
  const all = await entryRepo.getAll();
  if (!all.length) { toast('Nothing to export yet'); return; }
  const unexported = all.filter((e) => !e.exported_at);

  const sAll = summarize(all);
  const sNew = summarize(unexported);

  const { el, close } = openModal(`
    <div class="modal-head">
      <h2>Export to KennelOS</h2>
      <button class="icon-btn" data-close aria-label="Close">✕</button>
    </div>
    <p class="muted">Downloads a CSV you load in KennelOS under <strong>Import / Export → Import expenses (CSV)</strong>. The photos stay here — KennelOS stores the numbers, this app keeps your originals.</p>
    <div class="export-choices">
      <label class="radio-card">
        <input type="radio" name="scope" value="unexported" ${unexported.length ? 'checked' : 'disabled'}>
        <div>
          <strong>Not yet exported</strong>
          <span class="muted">${sNew.count} item${sNew.count === 1 ? '' : 's'} · ${sNew.receipts} receipt(s), ${sNew.trips} trip(s) · ${fmtMoney(sNew.total)}</span>
        </div>
      </label>
      <label class="radio-card">
        <input type="radio" name="scope" value="all" ${unexported.length ? '' : 'checked'}>
        <div>
          <strong>Everything</strong>
          <span class="muted">${sAll.count} item${sAll.count === 1 ? '' : 's'} · ${sAll.receipts} receipt(s), ${sAll.trips} trip(s) · ${fmtMoney(sAll.total)}</span>
        </div>
      </label>
    </div>
    <label class="check"><input type="checkbox" id="mark-exported" checked> Mark these as exported</label>
    <div class="form-actions"><span class="spacer"></span>
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" id="do-export">⬇ Download CSV</button>
    </div>`);

  el.querySelector('#do-export').addEventListener('click', async () => {
    const scope = el.querySelector('input[name=scope]:checked')?.value || 'all';
    const rows = scope === 'unexported' ? unexported : all;
    if (!rows.length) { toast('Nothing in that selection'); return; }
    const csv = buildCsv(rows);
    downloadCsv(`kennelos-expenses-${todayYMD()}.csv`, csv);
    if (el.querySelector('#mark-exported').checked) {
      await entryRepo.markExported(rows.map((r) => r.id));
    }
    close();
    toast(`Exported ${rows.length} item${rows.length === 1 ? '' : 's'}`);
    renderList();
  });
}

// ---------------------------------------------------------- settings ------
function openSettings() {
  const { el, close } = openModal(`
    <div class="modal-head">
      <h2>Settings</h2>
      <button class="icon-btn" data-close aria-label="Close">✕</button>
    </div>
    <form id="sform" class="form">
      <label>Default kennel name
        <input type="text" name="kennelName" value="${esc(getKennelName())}" placeholder="Matches your kennel in KennelOS" autocomplete="off">
        <span class="hint">Stamped on kennel-level costs so KennelOS matches your kennel by name. Leave blank to let KennelOS use its own configured kennel.</span>
      </label>
      <label>Default rate per mile
        <input type="number" step="0.001" min="0" name="mileageRate" value="${getMileageRate()}">
        <span class="hint">Prefilled on new trips. Use the same rate you use in KennelOS.</span>
      </label>
      <div class="form-actions"><span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
    <div class="about muted">
      <p><strong>Receipts</strong> — a companion to KennelOS. All data stays on this device. ${ocrAvailable ? 'Offline receipt scanning is ready.' : 'Receipt scanning isn’t available on this device — enter details by hand.'}</p>
    </div>`);
  el.querySelector('#sform').addEventListener('submit', (ev) => {
    ev.preventDefault();
    setKennelName(ev.target.kennelName.value);
    setMileageRate(ev.target.mileageRate.value);
    close();
    toast('Settings saved');
  });
}

init();
