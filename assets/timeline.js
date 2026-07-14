// timeline.js — renders a subject's Health Timeline (Event list, newest first)
// with add/edit/archive/delete. Reused for dogs now; pairings/litters later.
import { HistoryEvent } from '../data/eventRepo.js';
import { EVENT_TYPES, descriptor } from '../data/vocab.js';
import { esc, badge, fmtDate, todayYMD, confirmAction } from './ui.js';
import { openEventForm } from './eventForm.js';

// Compact "label: value" summary of an event's type-specific details.
function detailsSummary(ev) {
  const typeDef = descriptor(EVENT_TYPES, ev.event_type);
  if (!typeDef.fields?.length || !ev.details) return '';
  const parts = typeDef.fields
    .filter((f) => ev.details[f.key] != null && ev.details[f.key] !== '')
    .map((f) => {
      const v = f.type === 'date' ? fmtDate(ev.details[f.key]) : ev.details[f.key];
      return `${esc(f.label)}: ${esc(v)}`;
    });
  return parts.join(' · ');
}

export function renderTimeline(opts) {
  const { mount, subjectType, subjectId } = opts;
  let showArchived = false;

  mount.innerHTML = `
    <section class="card" style="margin-top:16px;">
      <div class="row-between">
        <h2 style="margin:0;">Health Timeline</h2>
        <div class="pill-row">
          <label class="check-inline"><input type="checkbox" id="tl-archived"> Show archived</label>
          <button class="btn btn-primary btn-sm" id="tl-add">+ Add Event</button>
        </div>
      </div>
      <div id="tl-body" style="margin-top:14px;"></div>
    </section>`;

  const body = mount.querySelector('#tl-body');

  async function refresh() {
    const events = await HistoryEvent.getForSubject(subjectType, subjectId, { includeArchived: true });
    const visible = showArchived ? events : events.filter((e) => !e.is_archived);
    if (!visible.length) {
      body.innerHTML = `<div class="empty-state">No events logged yet.</div>`;
      return;
    }
    const today = todayYMD();
    body.innerHTML = `<ul class="timeline">` + visible.map((ev, i) => {
      const upcoming = ev.event_date > today;
      const summary = detailsSummary(ev);
      const meta = [summary, ev.notes ? esc(ev.notes) : '']
        .filter(Boolean).join(' — ');
      return `<li class="timeline-item${upcoming ? ' event-upcoming' : ''}${ev.is_archived ? ' row-archived' : ''}" data-idx="${i}">
        <div class="timeline-date">${esc(fmtDate(ev.event_date))}${upcoming ? ' <span class="badge badge-amber">Upcoming</span>' : ''}</div>
        <div class="timeline-main">
          <div>${badge(EVENT_TYPES, ev.event_type)} <strong>${esc(ev.title)}</strong>${ev.cost != null ? ` <span class="faint">$${esc(ev.cost)}</span>` : ''}</div>
          ${meta ? `<div class="muted" style="font-size:14px;">${meta}</div>` : ''}
          ${ev.reminder_date ? `<div class="faint" style="font-size:13px;">⏰ reminder ${esc(fmtDate(ev.reminder_date))}</div>` : ''}
        </div>
        <div class="timeline-actions pill-row">
          <button class="btn btn-sm" data-act="edit" data-idx="${i}">Edit</button>
          <button class="btn btn-sm" data-act="archive" data-idx="${i}">${ev.is_archived ? 'Unarchive' : 'Archive'}</button>
          <button class="btn btn-danger btn-sm" data-act="delete" data-idx="${i}">Delete</button>
        </div>
      </li>`;
    }).join('') + `</ul>`;

    body.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.act, visible[Number(btn.dataset.idx)]));
    });
  }

  async function onAction(act, ev) {
    if (act === 'edit') {
      openEventForm({ subjectType, subjectId, event: ev, onSaved: refresh });
    } else if (act === 'archive') {
      ev.is_archived ? await HistoryEvent.unarchive(ev.id) : await HistoryEvent.archive(ev.id);
      refresh();
    } else if (act === 'delete') {
      if (confirmAction(`Permanently delete “${ev.title}”? This cannot be undone.`)) {
        await HistoryEvent.hardDelete(ev.id);
        refresh();
      }
    }
  }

  mount.querySelector('#tl-add').addEventListener('click', () => {
    openEventForm({ subjectType, subjectId, onSaved: refresh });
  });
  mount.querySelector('#tl-archived').addEventListener('change', (e) => {
    showArchived = e.target.checked;
    refresh();
  });

  refresh();
}
