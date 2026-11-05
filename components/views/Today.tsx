'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  AGENDA_GROUPS,
  AGENDA_LABELS,
  buildAgenda,
  calendarLabel,
  validCalendarDate,
  type AgendaItem,
} from '@/lib/today';
import { agendaCalendarEvents, downloadCalendar } from '@/lib/calendar';
import { interviewLabel, updateInterviewStatus } from '@/lib/planning';
import { useLocalDay } from '@/lib/useLocalDay';

export default function Today() {
  const { applications, interviews, darkMode, dispatch } = useStore();
  const { day, timeZone } = useLocalDay();
  const items = useMemo(
    () => (day ? buildAgenda(applications, day, interviews) : []),
    [applications, day, interviews],
  );
  const [exportNotice, setExportNotice] = useState('');
  const calendarEvents = day ? agendaCalendarEvents(applications, interviews, day) : [];
  const needsAttention = items.filter((item) => item.group === 'today' || item.group === 'overdue');
  return (
    <main className="today-view workspace-view" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="today-header">
        <div>
          <span className="today-eyebrow">One step at a time</span>
          <h1>Today</h1>
          <p>{day ? `${calendarLabel(day)} · ${timeZone}` : 'Loading your local day…'}</p>
        </div>
        <button className="today-primary" onClick={() => void dispatch({ type: 'OPEN_ADD_JOB' })}>
          ＋ Add a job
        </button>
      </header>
      <div className="today-calendar">
        <button
          disabled={!calendarEvents.length}
          onClick={() => {
            try {
              downloadCalendar(calendarEvents);
              setExportNotice(
                'Calendar file downloaded. Imported copies do not sync changes or send invitations.',
              );
            } catch {
              setExportNotice('Could not create the calendar file. Review saved dates.');
            }
          }}
        >
          Export calendar ({calendarEvents.length})
        </button>
        <p>
          Scheduled interviews and dated next actions/deadlines. Meeting links, preparation notes,
          and contact details are excluded.
        </p>
        {exportNotice && <p role="status">{exportNotice}</p>}
      </div>
      <div className="today-intro">
        <div>
          <strong>{needsAttention.length}</strong>
          <span>
            {needsAttention.length === 1 ? 'item needs attention' : 'items need attention'}
          </span>
        </div>
        <p>
          Your interviews, next steps, and deadlines in one place. Interview dates and times use
          each appointment’s saved time zone.
        </p>
      </div>
      {day && items.length === 0 && (
        <section className="today-empty">
          <span aria-hidden>✓</span>
          <h2>A clear day</h2>
          <p>
            Save a job and give it a next action. Its due date and application deadline will appear
            here.
          </p>
          <button onClick={() => void dispatch({ type: 'SET_VIEW', view: 'applications' })}>
            Open application board
          </button>
        </section>
      )}
      {AGENDA_GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (!rows.length) return null;
        const content = (
          <div className="today-items">
            {rows.map((item) => (
              <AgendaCard key={item.id} item={item} />
            ))}
          </div>
        );
        return group === 'completed' ? (
          <details key={group} className="today-completed">
            <summary>
              {AGENDA_LABELS[group]} <span>{rows.length}</span>
            </summary>
            {content}
          </details>
        ) : (
          <section
            key={group}
            className={`today-group today-${group}`}
            aria-labelledby={`agenda-${group}`}
          >
            <h2 id={`agenda-${group}`}>
              {AGENDA_LABELS[group]} <span>{rows.length}</span>
            </h2>
            {content}
          </section>
        );
      })}
      <p className="today-footnote">
        In-app reminders only. Action dates follow your local calendar; interview dates use their
        saved time zones. Recording a submission removes its application deadline from this view.
      </p>
    </main>
  );
}

function AgendaCard({ item }: { item: AgendaItem }) {
  const { dispatch, syncStatus, saveWorkspace, accountId } = useStore();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const disabled = busy || syncStatus.pending > 0;
  async function saveDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get('date') || '');
    if (date && !validCalendarDate(date)) {
      setNotice('Choose a valid calendar date.');
      return;
    }
    setBusy(true);
    const saved = await dispatch(
      item.kind === 'action'
        ? {
            type: 'UPDATE_APP_ACTION',
            id: item.application.id,
            due: date || null,
          }
        : {
            type: 'UPDATE_APP_DEADLINE',
            id: item.application.id,
            deadline: date || null,
          },
    );
    setBusy(false);
    setNotice(
      saved
        ? 'Date saved.'
        : 'Date change is queued. Keep this page open and use Retry save above.',
    );
    if (saved) setEditing(false);
  }
  async function toggleInterview() {
    if (!item.interview || !accountId) return;
    setBusy(true);
    try {
      const saved = await saveWorkspace(async (client) => {
        const result = await updateInterviewStatus(
          client,
          item.interview!.id,
          accountId,
          item.interview!.status === 'completed' ? 'scheduled' : 'completed',
        );
        await dispatch({ type: 'SYNC_INTERVIEWS', ...result });
      });
      setNotice(
        saved
          ? 'Interview saved. Update any imported calendar copy separately.'
          : 'Change is queued. Keep this page open and use Retry save above.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    setBusy(true);
    const saved = await dispatch({
      type: 'UPDATE_APP_ACTION',
      id: item.application.id,
      done: !item.application.nextActionDone,
    });
    setNotice(
      saved ? 'Action saved.' : 'Change is queued. Keep this page open and use Retry save above.',
    );
    setBusy(false);
  }
  return (
    <article className="today-item" aria-label={`${item.title} · ${item.application.company}`}>
      <div className="today-item-heading">
        <div>
          <span className={`today-kind today-kind-${item.kind}`}>
            {item.kind === 'action'
              ? 'Next action'
              : item.kind === 'interview'
                ? 'Interview'
                : 'Deadline'}
          </span>
          <h3>{item.title}</h3>
          <p>
            {item.application.company} <span aria-hidden>·</span> {item.application.role}
          </p>
        </div>
        <span className="today-date">
          {item.interview
            ? interviewLabel(item.interview)
            : item.date
              ? calendarLabel(item.date)
              : 'Choose a date'}
        </span>
      </div>
      <div className="today-controls">
        {item.kind === 'action' && (
          <button disabled={disabled} onClick={() => void toggle()}>
            {item.application.nextActionDone ? 'Reopen action' : 'Mark complete'}
          </button>
        )}
        {item.interview && (
          <button disabled={disabled} onClick={() => void toggleInterview()}>
            {item.interview.status === 'completed' ? 'Reopen interview' : 'Mark interview complete'}
          </button>
        )}
        {item.kind !== 'interview' && (
          <button
            disabled={disabled}
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Cancel date edit' : item.date ? 'Reschedule' : 'Set date'}
          </button>
        )}
        <button
          className="today-open"
          onClick={() =>
            void dispatch({
              type: 'OPEN_DETAIL',
              id: item.application.id,
              ...(item.interview ? { section: 'planning' as const } : {}),
            })
          }
        >
          {item.interview ? 'Open / reschedule ↗' : 'Open workspace ↗'}
        </button>
      </div>
      {editing && (
        <form className="today-reschedule" onSubmit={(event) => void saveDate(event)}>
          <label htmlFor={`agenda-date-${item.id}`}>
            {item.kind === 'action' ? 'Next-action date' : 'Application deadline'}
          </label>
          <input
            id={`agenda-date-${item.id}`}
            name="date"
            type="date"
            defaultValue={item.date ?? ''}
            disabled={disabled}
          />
          <button type="submit" className="today-primary" disabled={disabled}>
            Save date
          </button>
          <small>Clear the field to remove the date.</small>
        </form>
      )}
      {notice && (
        <p role="status" className="today-item-notice">
          {notice}
        </p>
      )}
    </article>
  );
}
