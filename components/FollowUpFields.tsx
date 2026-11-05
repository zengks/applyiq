import { useRef, useState } from 'react';
import { FOLLOW_UP_LABELS, followUpTemplate, type FollowUpKind } from '@/lib/followUp';
import type { Application, JobContact, JobInterview } from '@/lib/types';

export default function FollowUpFields({
  application,
  contacts,
  interviews,
  sender,
  values,
  onEdit,
}: {
  application: Application;
  contacts: JobContact[];
  interviews: JobInterview[];
  sender: string;
  values: Record<string, string>;
  onEdit: () => void;
}) {
  const [kind, setKind] = useState(values.kind as FollowUpKind);
  const [contactId, setContactId] = useState(values.contact_id);
  const [interviewId, setInterviewId] = useState(values.interview_id);
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const contact = contacts.find((item) => item.id === contactId);
  const interview = interviews.find((item) => item.id === interviewId);

  function fillTemplate() {
    if (!subject.current || !body.current) return;
    if (
      (subject.current.value.trim() || body.current.value.trim()) &&
      !window.confirm('Replace the subject and message with this template?')
    )
      return;
    const template = followUpTemplate(kind, application, contact, interview, sender);
    subject.current.value = template.subject;
    body.current.value = template.body;
    onEdit();
    subject.current.focus();
  }

  return (
    <>
      <label htmlFor="jp-draft-kind">Follow-up type</label>
      <select
        id="jp-draft-kind"
        name="kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as FollowUpKind)}
      >
        <option value="check_in">{FOLLOW_UP_LABELS.check_in}</option>
        <option value="thank_you">{FOLLOW_UP_LABELS.thank_you}</option>
      </select>
      <label htmlFor="jp-draft-interview">Related interview</label>
      <select
        id="jp-draft-interview"
        name="interview_id"
        value={interviewId}
        onChange={(event) => {
          const selected = interviews.find((item) => item.id === event.target.value);
          setInterviewId(event.target.value);
          if (
            !contactId &&
            selected?.contactId &&
            contacts.some((item) => item.id === selected.contactId && !item.archived)
          )
            setContactId(selected.contactId);
        }}
      >
        <option value="">No interview selected</option>
        {interviews
          .filter((item) => item.status !== 'cancelled' || item.id === interviewId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.localStart.slice(0, 10)}
            </option>
          ))}
      </select>
      <label htmlFor="jp-draft-contact">Recipient contact</label>
      <select
        id="jp-draft-contact"
        name="contact_id"
        value={contactId}
        onChange={(event) => setContactId(event.target.value)}
      >
        <option value="">No contact selected</option>
        {contacts
          .filter((item) => !item.archived || item.id === contactId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.archived ? ' (archived)' : ''}
            </option>
          ))}
      </select>
      {contact?.email && <p className="jw-muted">Saved email: {contact.email}</p>}
      <p className="jw-muted">
        Fill a template or write your own. Review the recipient and text before copying a saved
        draft to your email app.
      </p>
      <button type="button" onClick={fillTemplate}>
        Fill template
      </button>
      <label htmlFor="jp-draft-subject">Draft subject</label>
      <input
        id="jp-draft-subject"
        name="subject"
        ref={subject}
        defaultValue={values.subject}
        maxLength={200}
        required
      />
      <label htmlFor="jp-draft-body">Draft message</label>
      <textarea
        id="jp-draft-body"
        name="body"
        ref={body}
        defaultValue={values.body}
        maxLength={10000}
        rows={9}
        required
      />
    </>
  );
}
