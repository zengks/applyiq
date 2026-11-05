'use client';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { Application, JobContact, JobInterview } from '@/lib/types';
import { useStore } from '@/lib/store';
import { checked, sameFields } from '@/lib/jobWorkspace';
import {
  contactInput,
  contactInputSchema,
  interviewInput,
  interviewInputSchema,
  interviewLabel,
  loadJobPlanning,
  safePlanningUrl,
} from '@/lib/planning';
import FollowUpFields from './FollowUpFields';
import {
  FOLLOW_UP_LABELS,
  followUpInputSchema,
  followUpValues,
  type JobFollowUp,
} from '@/lib/followUp';
import { downloadCalendar, interviewCalendarEvent } from '@/lib/calendar';

export interface PlannerHandle {
  isDirty: () => boolean;
}
type Editor = {
  token: string;
  kind: 'contact' | 'interview' | 'draft';
  id: string;
  revision: number | null;
  values: Record<string, string>;
};
const editorCopy = {
  contact: {
    form: 'Contact editor',
    title: 'Contact details',
    save: 'Save contact',
    rpc: 'save_job_contact',
    saved: 'Contact saved.',
  },
  interview: {
    form: 'Interview editor',
    title: 'Interview details',
    save: 'Save interview',
    rpc: 'save_job_interview',
    saved: 'Interview saved. Re-export any calendar copy after changes.',
  },
  draft: {
    form: 'Follow-up draft editor',
    title: 'Follow-up draft',
    save: 'Save draft',
    rpc: 'save_job_follow_up_draft',
    saved: 'Follow-up draft saved.',
  },
};
const contactValues = (contact?: JobContact) => ({
  name: contact?.name ?? '',
  role: contact?.role ?? '',
  email: contact?.email ?? '',
  phone: contact?.phone ?? '',
  profile_url: contact?.profileUrl ?? '',
  notes: contact?.notes ?? '',
  archived: String(contact?.archived ?? false),
});
const interviewValues = (interview?: JobInterview) => ({
  title: interview?.title ?? '',
  local: interview ? interview.localStart : '',
  duration: interview
    ? String((Date.parse(interview.endsAt) - Date.parse(interview.startsAt)) / 60000)
    : '45',
  time_zone: interview?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  occurrence: 'reject',
  status: interview?.status ?? 'scheduled',
  location: interview?.location ?? '',
  meeting_url: interview?.meetingUrl ?? '',
  notes: interview?.notes ?? '',
  contact_id: interview?.contactId ?? '',
});

export default function JobPlanning({
  application,
  ref,
  onDirtyChange,
  onBusyChange,
}: {
  application: Application;
  ref?: Ref<PlannerHandle>;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { workspaceClient, accountId, profileName, saveWorkspace, dispatch, syncStatus } =
    useStore();
  const [contacts, setContacts] = useState<JobContact[]>([]);
  const [interviews, setInterviews] = useState<JobInterview[]>([]);
  const [drafts, setDrafts] = useState<JobFollowUp[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const disabled = busy || syncStatus.pending > 0 || !loaded || !!loadError;
  const read = () =>
    form.current
      ? Object.fromEntries(
          Array.from(new FormData(form.current).entries()).map(([k, v]) => [k, String(v)]),
        )
      : (editor?.values ?? {});
  const isDirty = () => !!editor && !sameFields(read(), editor.values);
  useImperativeHandle(ref, () => ({ isDirty }));
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!editor) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
  useEffect(() => {
    if (editor)
      form.current?.querySelector<HTMLElement>('input:not([type=hidden]), select')?.focus();
  }, [editor]);
  const refresh = useCallback(async () => {
    if (!accountId) throw new Error('Sign in before opening job planning.');
    const result = await loadJobPlanning(workspaceClient, application.id, accountId);
    setContacts(result.contacts);
    setInterviews(result.interviews);
    setDrafts(result.drafts);
    setLoaded(true);
    setLoadError('');
    await dispatch({
      type: 'SYNC_INTERVIEWS',
      applicationId: application.id,
      interviews: result.interviews,
    });
  }, [accountId, workspaceClient, application.id, dispatch]);
  useEffect(() => {
    let active = true;
    if (!accountId) return;
    void loadJobPlanning(workspaceClient, application.id, accountId)
      .then((result) => {
        if (!active) return;
        setContacts(result.contacts);
        setInterviews(result.interviews);
        setDrafts(result.drafts);
        setLoaded(true);
        setLoadError('');
        void dispatch({
          type: 'SYNC_INTERVIEWS',
          applicationId: application.id,
          interviews: result.interviews,
        });
      })
      .catch(() => {
        if (active) setLoadError('Could not load job planning. Retry before editing.');
      });
    return () => {
      active = false;
    };
  }, [accountId, workspaceClient, application.id, dispatch]);
  function openEditor(
    kind: Editor['kind'],
    values: Editor['values'],
    item?: { id: string; revision: number },
  ) {
    if (isDirty() && !window.confirm('Discard unsaved planning edits?')) return;
    setNotice('');
    setDirty(false);
    setEditor({
      kind,
      token: crypto.randomUUID(),
      id: item?.id ?? crypto.randomUUID(),
      revision: item?.revision ?? null,
      values,
    });
  }
  const openContact = (item?: JobContact) => openEditor('contact', contactValues(item), item);
  const openInterview = (item?: JobInterview) =>
    openEditor('interview', interviewValues(item), item);
  const openDraft = (item?: JobFollowUp) => openEditor('draft', followUpValues(item), item);

  async function copyDraft(draft: JobFollowUp) {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setNotice('Draft copied. Review it in your email app before sending.');
    } catch {
      setNotice('Clipboard unavailable. Open the saved message and select its text to copy it.');
    }
  }
  async function persist(
    kind: Editor['kind'],
    id: string,
    revision: number | null,
    details: object,
    fromEditor = false,
  ) {
    if (disabled) return;
    if (
      !fromEditor &&
      isDirty() &&
      !window.confirm('Discard unsaved planning edits before making this change?')
    )
      return;
    setBusy(true);
    setNotice('');
    try {
      const saved = await saveWorkspace(async (client) => {
        const result = await client.rpc(editorCopy[kind].rpc, {
          record_id: id,
          job_id: application.id,
          details,
          expected_revision: revision,
        });
        if (result.error) {
          if (result.error.message.includes('elsewhere'))
            setNotice(
              'This record changed in another tab. Use Reload saved data above, then review and reapply your edits.',
            );
          throw result.error;
        }
        checked(result);
        await refresh();
        setEditor(null);
        setDirty(false);
        setNotice(editorCopy[kind].saved);
      });
      if (!saved)
        setNotice(
          (previous) =>
            previous || 'This change is queued. Keep this page open and use Retry save above.',
        );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    try {
      const value = read();
      if (editor.kind === 'contact') {
        const details = contactInputSchema.parse({
          ...value,
          email: value.email.trim(),
          archived: value.archived === 'true',
        });
        await persist('contact', editor.id, editor.revision, details, true);
      } else if (editor.kind === 'draft') {
        const details = followUpInputSchema.parse({
          ...value,
          contact_id: value.contact_id || null,
          interview_id: value.interview_id || null,
        });
        await persist('draft', editor.id, editor.revision, details, true);
      } else {
        const duration = Number(value.duration);
        if (!Number.isInteger(duration) || duration < 1 || duration > 1440)
          throw new Error('Choose a whole-minute duration from 1 to 1440.');
        // Keep an unchanged instant when editing notes on a repeated hour.
        const saved = interviews.find((item) => item.id === editor.id);
        const unchanged =
          saved &&
          saved.localStart === value.local &&
          saved.timeZone === value.time_zone &&
          value.occurrence === 'reject';
        setBusy(true);
        let start: string;
        try {
          const result = unchanged
            ? { data: saved.startsAt, error: null }
            : await workspaceClient.rpc('resolve_interview_time', {
                local_time: value.local,
                zone_name: value.time_zone,
                occurrence: value.occurrence,
              });
          if (result.error) throw new Error(result.error.message);
          start = String(result.data);
        } finally {
          setBusy(false);
        }

        const details = interviewInputSchema.parse({
          title: value.title,
          starts_at: start,
          ends_at: new Date(Date.parse(start) + duration * 60000).toISOString(),
          time_zone: value.time_zone,
          status: value.status,
          location: value.location,
          meeting_url: value.meeting_url,
          notes: value.notes,
          contact_id: value.contact_id || null,
        });
        await persist('interview', editor.id, editor.revision, details, true);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? 'issues' in error
            ? editor.kind === 'draft'
              ? 'Enter a subject and message within the field limits.'
              : 'Check required fields, lengths, email, and http(s) links.'
            : error.message
          : 'Review the form before saving.',
      );
    }
  }
  function exportInterviews(items: JobInterview[]) {
    try {
      downloadCalendar(
        items.map((item) => interviewCalendarEvent(item, application, includePrivate)),
        'applyiq-interviews.ics',
      );
      setNotice('Calendar file downloaded. Imports do not sync later changes or send invitations.');
    } catch {
      setNotice('Could not export this calendar. Check the saved interview times.');
    }
  }
  const upcoming = interviews.filter(
    (item) => item.status === 'scheduled' && Date.parse(item.endsAt) >= now,
  );
  return (
    <div className="job-planning">
      <header className="jp-intro">
        <h3>People & conversations</h3>
        <p>
          Keep the people, appointments, and preparation for this job together. Scheduling here does
          not contact anyone or change the application stage.
        </p>
      </header>
      {loadError && (
        <div role="alert" className="jw-notice">
          {loadError}{' '}
          <button
            onClick={() =>
              void refresh().catch(() =>
                setLoadError('Could not load job planning. Retry before editing.'),
              )
            }
          >
            Retry planning load
          </button>
        </div>
      )}
      {!loaded && !loadError && <p role="status">Loading interviews, contacts, and drafts…</p>}
      {notice && (
        <p role="status" className="jw-notice">
          {notice}
        </p>
      )}
      <section className="jw-card jp-calendar">
        <h3>Calendar copy</h3>
        <p>
          Download an .ics file to import into your calendar. Re-export after rescheduling or
          cancelling; imported copies do not stay in sync.
        </p>
        <label className="jw-checkbox">
          <input
            type="checkbox"
            checked={includePrivate}
            onChange={(event) => setIncludePrivate(event.target.checked)}
          />{' '}
          Include meeting links, locations, and preparation notes
        </label>
        <p className="jw-muted">
          Titles and times are always included. Contact emails and private recruiter notes are never
          exported. No invitations are sent.
        </p>
        <button disabled={disabled || !upcoming.length} onClick={() => exportInterviews(upcoming)}>
          Export upcoming interviews ({upcoming.length})
        </button>
      </section>
      <section className="jw-card">
        <div className="jp-section-heading">
          <h3>Follow-up drafts</h3>
          <button disabled={disabled || drafts.length >= 100} onClick={() => openDraft()}>
            New follow-up draft
          </button>
        </div>
        <p className="jw-muted">Draft a thank-you or check-in, then copy it to your email app.</p>
        {drafts.length >= 100 && (
          <p className="jw-muted">
            This job has 100 saved drafts. Open an existing draft to edit it.
          </p>
        )}
        {drafts.map((draft) => {
          const contact = contacts.find((item) => item.id === draft.contact_id);
          const interview = interviews.find((item) => item.id === draft.interview_id);
          return (
            <article
              className="jp-record"
              key={draft.id}
              aria-label={`Follow-up draft: ${draft.subject}`}
            >
              <div className="jp-section-heading">
                <h4>{draft.subject}</h4>
                <span className="jp-badge">{FOLLOW_UP_LABELS[draft.kind]}</span>
              </div>
              <p>
                {contact
                  ? `For ${contact.name}${contact.archived ? ' (archived)' : ''}${contact.email ? ` · ${contact.email}` : ''}`
                  : 'No contact selected'}
              </p>
              {interview && (
                <p>
                  {interview.title} · {interview.localStart.slice(0, 10)}
                </p>
              )}
              <details>
                <summary>Read saved message</summary>
                <p className="jp-preserve">{draft.body}</p>
              </details>
              <div className="jw-actions">
                <button disabled={disabled} onClick={() => openDraft(draft)}>
                  Edit draft
                </button>
                <button onClick={() => void copyDraft(draft)}>Copy draft</button>
              </div>
            </article>
          );
        })}
      </section>
      <div className="jp-columns">
        <section className="jw-card">
          <div className="jp-section-heading">
            <h3>Interviews</h3>
            <button disabled={disabled} onClick={() => openInterview()}>
              Schedule interview
            </button>
          </div>
          {loaded && !interviews.length && (
            <p className="jw-muted">
              No appointments yet. Add one once a date and time are agreed.
            </p>
          )}
          {interviews.map((item) => (
            <article
              className={`jp-record jp-${item.status}`}
              key={item.id}
              aria-label={`${item.title} interview`}
            >
              <div className="jp-section-heading">
                <h4>{item.title}</h4>
                <span className="jp-badge">{item.status}</span>
              </div>
              <p>{interviewLabel(item)}</p>
              {item.contactId && (
                <p>
                  With{' '}
                  {contacts.find((contact) => contact.id === item.contactId)?.name ??
                    'saved contact'}
                </p>
              )}
              {item.location && <p>{item.location}</p>}
              {safePlanningUrl(item.meetingUrl ?? '') && (
                <a
                  href={safePlanningUrl(item.meetingUrl!)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open meeting link ↗
                </a>
              )}
              {item.notes && (
                <details>
                  <summary>Preparation notes</summary>
                  <p className="jp-preserve">{item.notes}</p>
                </details>
              )}
              <div className="jw-actions">
                <button disabled={disabled} onClick={() => openInterview(item)}>
                  Edit / reschedule
                </button>
                <button disabled={disabled} onClick={() => exportInterviews([item])}>
                  {item.status === 'cancelled' ? 'Export cancellation' : 'Export interview'}
                </button>
                {item.status === 'scheduled' && (
                  <>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void persist('interview', item.id, item.revision, {
                          ...interviewInput(item),
                          status: 'completed',
                        })
                      }
                    >
                      Mark interview complete
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this interview in ApplyIQ? Update any imported calendar copy separately.',
                          )
                        )
                          void persist('interview', item.id, item.revision, {
                            ...interviewInput(item),
                            status: 'cancelled',
                          });
                      }}
                    >
                      Cancel interview
                    </button>
                  </>
                )}
                {item.status !== 'scheduled' && (
                  <button
                    disabled={disabled}
                    onClick={() =>
                      void persist('interview', item.id, item.revision, {
                        ...interviewInput(item),
                        status: 'scheduled',
                      })
                    }
                  >
                    Reopen interview
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
        <section className="jw-card">
          <div className="jp-section-heading">
            <h3>Recruiter contacts</h3>
            <button disabled={disabled} onClick={() => openContact()}>
              Add contact
            </button>
          </div>
          <p className="jw-muted">Stored only with this job. No messages are sent from ApplyIQ.</p>
          {loaded && !contacts.length && <p>No contacts yet.</p>}
          {contacts
            .filter((item) => !item.archived)
            .map((item) => (
              <ContactCard
                key={item.id}
                contact={item}
                disabled={disabled}
                onEdit={() => openContact(item)}
                onArchive={() =>
                  void persist('contact', item.id, item.revision, {
                    ...contactInput(item),
                    archived: true,
                  })
                }
              />
            ))}
          {contacts.some((item) => item.archived) && (
            <details>
              <summary>
                Archived contacts ({contacts.filter((item) => item.archived).length})
              </summary>
              {contacts
                .filter((item) => item.archived)
                .map((item) => (
                  <ContactCard
                    key={item.id}
                    contact={item}
                    disabled={disabled}
                    onEdit={() => openContact(item)}
                    onArchive={() =>
                      void persist('contact', item.id, item.revision, {
                        ...contactInput(item),
                        archived: false,
                      })
                    }
                  />
                ))}
            </details>
          )}
        </section>
      </div>
      {editor && (
        <form
          key={editor.token}
          ref={form}
          className="jw-card jp-editor"
          onSubmit={submit}
          onChange={() => setDirty(isDirty())}
          aria-label={editorCopy[editor.kind].form}
        >
          <h3>{editorCopy[editor.kind].title}</h3>
          <p className="jw-muted">
            Save planning edits before leaving. Device recovery covers only job and material fields.
          </p>
          <fieldset className="jw-fields" disabled={disabled}>
            {editor.kind === 'draft' ? (
              <FollowUpFields
                application={application}
                contacts={contacts}
                interviews={interviews}
                sender={profileName}
                values={editor.values}
                onEdit={() => setDirty(isDirty())}
              />
            ) : editor.kind === 'contact' ? (
              <>
                <PlanningField
                  name="name"
                  label="Contact name"
                  value={editor.values.name}
                  max={200}
                  required
                />
                <PlanningField
                  name="role"
                  label="Contact role"
                  value={editor.values.role}
                  max={200}
                />
                <PlanningField
                  name="email"
                  label="Contact email"
                  value={editor.values.email}
                  type="email"
                  max={320}
                />
                <PlanningField
                  name="phone"
                  label="Contact phone"
                  value={editor.values.phone}
                  type="tel"
                  max={100}
                />
                <PlanningField
                  name="profile_url"
                  label="Contact profile URL"
                  value={editor.values.profile_url}
                  type="url"
                  max={2048}
                />
                <input type="hidden" name="archived" value={editor.values.archived} />
                <label htmlFor="jp-contact-notes">Private contact notes</label>
                <textarea
                  id="jp-contact-notes"
                  name="notes"
                  defaultValue={editor.values.notes}
                  maxLength={10000}
                  rows={4}
                />
              </>
            ) : (
              <>
                <PlanningField
                  name="title"
                  label="Interview title"
                  value={editor.values.title}
                  max={200}
                  required
                />
                <PlanningField
                  name="local"
                  label="Interview date and time"
                  value={editor.values.local}
                  type="datetime-local"
                  required
                />
                <PlanningField
                  name="duration"
                  label="Duration (minutes)"
                  value={editor.values.duration}
                  type="number"
                  required
                  min={1}
                  max={1440}
                />
                <PlanningField
                  name="time_zone"
                  label="Interview time zone (IANA)"
                  value={editor.values.time_zone}
                  max={100}
                  required
                />
                <p className="jw-muted">
                  For example America/Vancouver, America/New_York, Europe/London, or UTC. Changing
                  the zone keeps the entered wall-clock time.
                </p>
                <label htmlFor="jp-occurrence">Repeated time at daylight-saving change</label>
                <select
                  id="jp-occurrence"
                  name="occurrence"
                  defaultValue={editor.values.occurrence}
                >
                  <option value="reject">Ask me if this time occurs twice</option>
                  <option value="earlier">Earlier occurrence</option>
                  <option value="later">Later occurrence</option>
                </select>
                <label htmlFor="jp-contact">Interview contact</label>
                <select id="jp-contact" name="contact_id" defaultValue={editor.values.contact_id}>
                  <option value="">No contact selected</option>
                  {contacts
                    .filter(
                      (contact) => !contact.archived || contact.id === editor.values.contact_id,
                    )
                    .map((contact) => (
                      <option value={contact.id} key={contact.id}>
                        {contact.name}
                        {contact.archived ? ' (archived)' : ''}
                      </option>
                    ))}
                </select>
                <label htmlFor="jp-status">Interview state</label>
                <select id="jp-status" name="status" defaultValue={editor.values.status}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <PlanningField
                  name="location"
                  label="Interview location"
                  value={editor.values.location}
                  max={500}
                />
                <PlanningField
                  name="meeting_url"
                  label="Meeting URL"
                  value={editor.values.meeting_url}
                  type="url"
                  max={2048}
                />
                <label htmlFor="jp-interview-notes">Preparation notes</label>
                <textarea
                  id="jp-interview-notes"
                  name="notes"
                  defaultValue={editor.values.notes}
                  maxLength={10000}
                  rows={4}
                />
              </>
            )}
            <div className="jw-actions">
              <button type="submit" className="jw-primary">
                {editorCopy[editor.kind].save}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isDirty() || window.confirm('Discard unsaved planning edits?')) {
                    setEditor(null);
                    setDirty(false);
                  }
                }}
              >
                Discard form
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
function PlanningField({
  name,
  label,
  value,
  type = 'text',
  max,
  required,
  min,
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
  max?: number;
  required?: boolean;
  min?: number;
}) {
  return (
    <>
      <label htmlFor={`jp-${name}`}>{label}</label>
      <input
        id={`jp-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={type === 'number' ? undefined : max}
        max={type === 'number' ? max : undefined}
        min={min}
        required={required}
      />
    </>
  );
}
function ContactCard({
  contact,
  disabled,
  onEdit,
  onArchive,
}: {
  contact: JobContact;
  disabled: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="jp-record" aria-label={`${contact.name} contact`}>
      <h4>{contact.name}</h4>
      {contact.role && <p>{contact.role}</p>}
      {contact.email && <p>{contact.email}</p>}
      {contact.phone && <p>{contact.phone}</p>}
      {safePlanningUrl(contact.profileUrl) && (
        <a href={safePlanningUrl(contact.profileUrl)!} target="_blank" rel="noopener noreferrer">
          Open contact profile ↗
        </a>
      )}
      {contact.notes && (
        <details>
          <summary>Private notes</summary>
          <p className="jp-preserve">{contact.notes}</p>
        </details>
      )}
      <div className="jw-actions">
        <button disabled={disabled} onClick={onEdit}>
          Edit contact
        </button>
        <button disabled={disabled} onClick={onArchive}>
          {contact.archived ? 'Restore contact' : 'Archive contact'}
        </button>
      </div>
    </article>
  );
}
