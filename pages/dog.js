// dog.js — Dog Detail (Profile section). Edit-in-place: view mode is read-only
// until "Edit" unlocks the fields; ?new=1 starts in create mode. Enforces the
// Build Brief B1 rules — hard blocks come from dogRepo (required fields, dates,
// cycles), soft/interactive ones (sex mismatch warn, the deceased confirmations)
// live here because they need the user.
import { dogRepo, ReferenceBlockedError } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { SEX, DOG_STATUS, OWNERSHIP_TYPE } from '../data/vocab.js';
import { esc, badge, fmtDate, todayYMD, param, confirmAction } from '../assets/ui.js';
import { renderTimeline } from '../assets/timeline.js';
import { renderPedigree } from '../assets/pedigree.js';

const OWNER_REQUIRED = ['external', 'leased_in'];

const els = {
  title: document.getElementById('dog-title'),
  subtitle: document.getElementById('dog-subtitle'),
  headerActions: document.getElementById('header-actions'),
  profileActions: document.getElementById('profile-actions'),
  body: document.getElementById('profile-body'),
  error: document.getElementById('page-error'),
  timeline: document.getElementById('timeline-section'),
  pedigree: document.getElementById('pedigree-section')
};

const blankDog = () => ({
  call_name: '', registered_name: '', sex: '', date_of_birth: '', dob_is_estimated: false,
  date_of_death: '', breed: '', color_markings: '', registry: '', registration_number: '',
  microchip_id: '', sire_id: '', dam_id: '', ownership_type: '', owner_contact_id: '',
  co_owner_contact_ids: [], status: '', status_date: '', notes: ''
});

const ctx = {
  mode: 'view',        // 'new' | 'view' | 'edit'
  original: null,      // saved record (null in new mode)
  draft: null,         // working copy while editing
  pickerArchived: false,
  allDogs: [],
  allContacts: [],
  breeds: [],
  dogsById: new Map(),
  contactsById: new Map()
};

// --- Data loading --------------------------------------------------------
async function loadRefs() {
  const [dogs, contacts, breeds] = await Promise.all([
    dogRepo.getAll({ includeArchived: true }),
    contactRepo.getAll({ includeArchived: true }),
    dogRepo.getBreeds()
  ]);
  ctx.allDogs = dogs;
  ctx.allContacts = contacts;
  ctx.breeds = breeds;
  ctx.dogsById = new Map(dogs.map((d) => [d.id, d]));
  ctx.contactsById = new Map(contacts.map((c) => [c.id, c]));
}

function dogName(id) {
  const d = ctx.dogsById.get(id);
  return d ? (d.call_name + (d.registered_name ? ` (${d.registered_name})` : '')) : '';
}
function contactName(id) {
  const c = ctx.contactsById.get(id);
  return c ? c.name : '';
}

// --- Option builders -----------------------------------------------------
function vocabOptions(vocab, current, placeholder) {
  const head = placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '';
  return head + vocab.map((v) =>
    `<option value="${esc(v.value)}"${v.value === current ? ' selected' : ''}>${esc(v.label)}</option>`
  ).join('');
}

function dogOptions(current, excludeId) {
  const opts = ctx.allDogs
    .filter((d) => d.id !== excludeId && (ctx.pickerArchived || !d.is_archived))
    .map((d) => `<option value="${esc(d.id)}"${d.id === current ? ' selected' : ''}>${esc(d.call_name)}${d.registered_name ? ' — ' + esc(d.registered_name) : ''}${d.is_archived ? ' (archived)' : ''}</option>`)
    .join('');
  return `<option value="">— none —</option>` + opts;
}

function contactOptions(current) {
  const opts = ctx.allContacts
    .filter((c) => ctx.pickerArchived || !c.is_archived)
    .map((c) => `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.name)}${c.is_archived ? ' (archived)' : ''}</option>`)
    .join('');
  return `<option value="">— none —</option>` + opts;
}

// --- Rendering: read-only view ------------------------------------------
function row(label, valueHtml) {
  return `<dt>${esc(label)}</dt><dd>${valueHtml || '<span class="faint">—</span>'}</dd>`;
}

function renderView() {
  const d = ctx.original;
  const coOwners = (d.co_owner_contact_ids || []).map((id) => esc(contactName(id))).filter(Boolean).join(', ');
  els.body.innerHTML = `
    <dl class="dl-meta" style="margin-top:14px;">
      ${row('Call name', esc(d.call_name))}
      ${row('Registered name', esc(d.registered_name))}
      ${row('Sex', badge(SEX, d.sex))}
      ${row('Breed', esc(d.breed))}
      ${row('Date of birth', d.date_of_birth ? esc(fmtDate(d.date_of_birth)) + (d.dob_is_estimated ? ' <span class="faint">(est.)</span>' : '') : '')}
      ${row('Date of death', d.date_of_death ? esc(fmtDate(d.date_of_death)) : '')}
      ${row('Color / markings', esc(d.color_markings))}
      ${row('Registry', esc(d.registry))}
      ${row('Registration #', esc(d.registration_number))}
      ${row('Microchip', esc(d.microchip_id))}
      ${row('Sire', esc(dogName(d.sire_id)))}
      ${row('Dam', esc(dogName(d.dam_id)))}
      ${row('Ownership', badge(OWNERSHIP_TYPE, d.ownership_type))}
      ${row('Owner', esc(contactName(d.owner_contact_id)))}
      ${row('Co-owners', coOwners)}
      ${row('Status', badge(DOG_STATUS, d.status) + (d.status_date ? ` <span class="faint">since ${esc(fmtDate(d.status_date))}</span>` : ''))}
      ${row('Notes', d.notes ? esc(d.notes).replace(/\n/g, '<br>') : '')}
    </dl>`;
}

// --- Rendering: edit form ------------------------------------------------
function field(label, inner, { required = false, hint = '', wide = false } = {}) {
  return `<div class="field${wide ? ' field-wide' : ''}">
    <label>${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
    ${inner}
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </div>`;
}

function renderEdit() {
  const d = ctx.draft;
  const breedList = ctx.breeds.map((b) => `<option value="${esc(b)}"></option>`).join('');
  const coSelected = new Set(d.co_owner_contact_ids || []);
  const coOptions = ctx.allContacts
    .filter((c) => ctx.pickerArchived || !c.is_archived || coSelected.has(c.id))
    .map((c) => `<option value="${esc(c.id)}"${coSelected.has(c.id) ? ' selected' : ''}>${esc(c.name)}${c.is_archived ? ' (archived)' : ''}</option>`)
    .join('');

  els.body.innerHTML = `
    <div class="form-grid" id="dog-form" style="margin-top:14px;">
      ${field('Call name', `<input id="f-call_name" type="text" value="${esc(d.call_name)}">`, { required: true })}
      ${field('Registered name', `<input id="f-registered_name" type="text" value="${esc(d.registered_name)}">`)}
      ${field('Sex', `<select id="f-sex">${vocabOptions(SEX, d.sex, 'Select…')}</select>`, { required: true })}
      ${field('Breed', `<input id="f-breed" type="text" list="breed-list" value="${esc(d.breed)}"><datalist id="breed-list">${breedList}</datalist>`, { required: true, hint: 'Type freely; suggestions come from breeds already entered.' })}
      ${field('Date of birth', `<input id="f-date_of_birth" type="date" max="${todayYMD()}" value="${esc(d.date_of_birth)}">`)}
      ${field('DOB estimated', `<label class="check-inline"><input id="f-dob_is_estimated" type="checkbox"${d.dob_is_estimated ? ' checked' : ''}> approximate</label>`)}
      ${field('Date of death', `<input id="f-date_of_death" type="date" value="${esc(d.date_of_death)}">`)}
      ${field('Color / markings', `<input id="f-color_markings" type="text" value="${esc(d.color_markings)}">`)}
      ${field('Registry', `<input id="f-registry" type="text" value="${esc(d.registry)}">`)}
      ${field('Registration #', `<input id="f-registration_number" type="text" value="${esc(d.registration_number)}">`)}
      ${field('Microchip', `<input id="f-microchip_id" type="text" value="${esc(d.microchip_id)}">`)}
      ${field('Ownership', `<select id="f-ownership_type">${vocabOptions(OWNERSHIP_TYPE, d.ownership_type, 'Select…')}</select>`, { required: true })}
      ${field('Status', `<select id="f-status">${vocabOptions(DOG_STATUS, d.status, 'Select…')}</select>`, { required: true })}
      ${field('Sire', `<select id="f-sire_id">${dogOptions(d.sire_id, ctx.original?.id)}</select>`)}
      ${field('Dam', `<select id="f-dam_id">${dogOptions(d.dam_id, ctx.original?.id)}</select>`)}
      ${field('Owner', `<select id="f-owner_contact_id">${contactOptions(d.owner_contact_id)}</select>`, { hint: 'Required for external / leased-in dogs.' })}
      ${field('Co-owners', `<select id="f-co_owner_contact_ids" multiple size="4">${coOptions}</select>`, { hint: 'Ctrl/Cmd-click to select multiple.' })}
      <div class="field field-wide">
        <label class="check-inline"><input id="picker-archived" type="checkbox"${ctx.pickerArchived ? ' checked' : ''}> Include archived dogs/contacts in the pickers above</label>
      </div>
      ${field('Notes', `<textarea id="f-notes">${esc(d.notes)}</textarea>`, { wide: true })}
    </div>
    <div id="form-warn"></div>`;

  const form = document.getElementById('dog-form');
  form.addEventListener('input', updateWarnings);
  form.addEventListener('change', updateWarnings);
  document.getElementById('picker-archived').addEventListener('change', (e) => {
    ctx.draft = readForm();
    ctx.pickerArchived = e.target.checked;
    renderEdit();
    renderProfileActions();
  });
  updateWarnings();
}

function readForm() {
  const val = (id) => document.getElementById(id)?.value ?? '';
  const coSel = document.getElementById('f-co_owner_contact_ids');
  return {
    ...ctx.draft,
    call_name: val('f-call_name').trim(),
    registered_name: val('f-registered_name').trim(),
    sex: val('f-sex'),
    breed: val('f-breed').trim(),
    date_of_birth: val('f-date_of_birth'),
    dob_is_estimated: document.getElementById('f-dob_is_estimated')?.checked || false,
    date_of_death: val('f-date_of_death'),
    color_markings: val('f-color_markings').trim(),
    registry: val('f-registry').trim(),
    registration_number: val('f-registration_number').trim(),
    microchip_id: val('f-microchip_id').trim(),
    ownership_type: val('f-ownership_type'),
    status: val('f-status'),
    sire_id: val('f-sire_id') || null,
    dam_id: val('f-dam_id') || null,
    owner_contact_id: val('f-owner_contact_id') || null,
    co_owner_contact_ids: coSel ? [...coSel.selectedOptions].map((o) => o.value) : [],
    notes: val('f-notes')
  };
}

function updateWarnings() {
  const d = readForm();
  const warns = [];
  const sire = ctx.dogsById.get(d.sire_id);
  const dam = ctx.dogsById.get(d.dam_id);
  if (sire && sire.sex === 'female') warns.push('Selected sire is recorded as female.');
  if (dam && dam.sex === 'male') warns.push('Selected dam is recorded as male.');
  if (OWNER_REQUIRED.includes(d.ownership_type) && !d.owner_contact_id) {
    warns.push(`An owner is required when ownership is “${OWNERSHIP_TYPE.find((o) => o.value === d.ownership_type)?.label}”.`);
  }
  if (d.date_of_death && d.status !== 'deceased') warns.push('Date of death is set but status is not Deceased.');
  const box = document.getElementById('form-warn');
  if (box) box.innerHTML = warns.length ? `<div class="inline-warn">${warns.map(esc).join('<br>')}</div>` : '';
}

// --- Actions -------------------------------------------------------------
function renderProfileActions() {
  if (ctx.mode === 'view') {
    els.profileActions.innerHTML = `<button class="btn btn-sm" id="btn-edit">Edit</button>`;
    document.getElementById('btn-edit').onclick = enterEdit;
  } else {
    els.profileActions.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-save">Save</button>
      <button class="btn btn-sm" id="btn-cancel">Cancel</button>`;
    document.getElementById('btn-save').onclick = save;
    document.getElementById('btn-cancel').onclick = cancel;
  }
}

async function renderHeaderActions() {
  els.headerActions.innerHTML = '';
  if (ctx.mode === 'new' || !ctx.original) return;
  const d = ctx.original;
  const archiveLabel = d.is_archived ? 'Unarchive' : 'Archive';
  const blockers = await dogRepo.getDeleteBlockers(d.id);
  const delTitle = blockers.length
    ? 'Referenced as ' + blockers.map((b) => `${b.label} (${b.count})`).join(', ') + ' — archive instead.'
    : 'Permanently delete this record.';
  els.headerActions.innerHTML = `
    <button class="btn btn-sm" id="btn-archive">${archiveLabel}</button>
    <button class="btn btn-danger btn-sm" id="btn-delete"${blockers.length ? ' disabled' : ''} title="${esc(delTitle)}">Delete</button>`;
  document.getElementById('btn-archive').onclick = toggleArchive;
  const del = document.getElementById('btn-delete');
  if (!blockers.length) del.onclick = doDelete;
}

function showError(msg) {
  els.error.innerHTML = `<div class="inline-error">${esc(msg)}</div>`;
  els.error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearError() { els.error.innerHTML = ''; }

function enterEdit() {
  clearError();
  ctx.mode = 'edit';
  ctx.draft = { ...ctx.original, co_owner_contact_ids: [...(ctx.original.co_owner_contact_ids || [])] };
  renderEdit();
  renderProfileActions();
  renderTimelineSection(); // hide timeline while editing the profile
  renderPedigreeSection(); // hide pedigree while editing too
}

function cancel() {
  clearError();
  if (ctx.mode === 'new') { location.href = 'dogs.html'; return; }
  ctx.mode = 'view';
  renderView();
  renderProfileActions();
  renderTimelineSection();
  renderPedigreeSection();
}

async function save() {
  clearError();
  const candidate = readForm();

  // status_date: stamp when status changes (or on first save).
  const statusChanged = !ctx.original || ctx.original.status !== candidate.status;
  if (statusChanged) candidate.status_date = todayYMD();
  else candidate.status_date = ctx.original.status_date || '';

  // Interactive rule: setting date_of_death SUGGESTS Deceased (not forced).
  if (candidate.date_of_death && candidate.status !== 'deceased') {
    if (confirmAction('Date of death is set. Also change status to “Deceased”?')) {
      candidate.status = 'deceased';
      candidate.status_date = todayYMD();
    }
  }
  // Interactive rule: leaving Deceased needs confirmation.
  if (ctx.original && ctx.original.status === 'deceased' && candidate.status !== 'deceased') {
    if (!confirmAction('This dog is marked Deceased. Are you sure you want to change that?')) return;
  }

  try {
    let saved;
    if (ctx.mode === 'new') {
      saved = await dogRepo.create(candidate);
      location.href = `dog.html?id=${encodeURIComponent(saved.id)}`;
      return;
    }
    saved = await dogRepo.update(ctx.original.id, candidate);
    ctx.original = saved;
    ctx.mode = 'view';
    await loadRefs(); // names/breeds may have changed
    ctx.original = await dogRepo.getById(saved.id);
    renderAll();
  } catch (e) {
    showError(e.message || String(e));
  }
}

async function toggleArchive() {
  const d = ctx.original;
  const verb = d.is_archived ? 'Unarchive' : 'Archive';
  if (!confirmAction(`${verb} “${d.call_name}”?`)) return;
  ctx.original = d.is_archived ? await dogRepo.unarchive(d.id) : await dogRepo.archive(d.id);
  renderAll();
}

async function doDelete() {
  const d = ctx.original;
  if (!confirmAction(`Permanently delete “${d.call_name}”? This cannot be undone.`)) return;
  try {
    await dogRepo.hardDelete(d.id);
    location.href = 'dogs.html';
  } catch (e) {
    if (e instanceof ReferenceBlockedError) { showError(e.message); await renderHeaderActions(); }
    else showError(e.message || String(e));
  }
}

// --- Top-level render ----------------------------------------------------
function renderTitle() {
  if (ctx.mode === 'new') {
    els.title.textContent = 'New Dog';
    els.subtitle.textContent = 'Fill in the required fields and save.';
    return;
  }
  const d = ctx.original;
  els.title.innerHTML = esc(d.call_name) + (d.is_archived ? ' <span class="badge badge-gray">Archived</span>' : '');
  els.subtitle.innerHTML = d.registered_name ? esc(d.registered_name) : '';
}

// Health Timeline only makes sense for a saved dog; hide it while creating/editing
// the profile so events can't be logged against an unsaved record.
function renderTimelineSection() {
  if (!els.timeline) return;
  if (ctx.mode === 'view' && ctx.original) {
    renderTimeline({ mount: els.timeline, subjectType: 'dog', subjectId: ctx.original.id });
  } else {
    els.timeline.innerHTML = '';
  }
}

// Pedigree centered on this dog (only for a saved dog in view mode). Clicking a
// node opens the full Pedigree page re-centered there.
function renderPedigreeSection() {
  if (!els.pedigree) return;
  if (ctx.mode === 'view' && ctx.original) {
    els.pedigree.innerHTML = `
      <section class="card" style="margin-top:16px;">
        <div class="row-between">
          <h2 style="margin:0;">Pedigree</h2>
          <a class="btn btn-sm" href="pedigree.html?id=${encodeURIComponent(ctx.original.id)}">Open full view →</a>
        </div>
        <div id="dog-pedigree-mount" style="margin-top:14px;"></div>
      </section>`;
    renderPedigree({
      mount: document.getElementById('dog-pedigree-mount'),
      rootId: ctx.original.id,
      generations: 3,
      onNavigate: (id) => { location.href = `pedigree.html?id=${encodeURIComponent(id)}`; }
    });
  } else {
    els.pedigree.innerHTML = '';
  }
}

function renderAll() {
  renderTitle();
  renderProfileActions();
  renderHeaderActions();
  if (ctx.mode === 'view') renderView();
  else renderEdit();
  renderTimelineSection();
  renderPedigreeSection();
}

async function main() {
  await loadRefs();
  const id = param('id');
  const isNew = param('new');

  if (isNew) {
    ctx.mode = 'new';
    ctx.draft = blankDog();
    renderTitle();
    renderEdit();
    renderProfileActions();
    renderHeaderActions();
    return;
  }

  if (!id) { showError('No dog id provided.'); return; }
  const dog = await dogRepo.getById(id);
  if (!dog) { showError('Dog not found. It may have been deleted.'); return; }
  ctx.original = dog;
  ctx.mode = 'view';
  renderAll();
}

main();
