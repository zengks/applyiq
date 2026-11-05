import { z } from 'zod';
import type { Application, JobContact, JobInterview } from './types';
import { calendarLabel } from './today';

export const FOLLOW_UP_LABELS = { check_in: 'Check-in', thank_you: 'Interview thank-you' };
export type FollowUpKind = keyof typeof FOLLOW_UP_LABELS;
export const followUpInputSchema = z.object({
  kind: z.enum(['check_in', 'thank_you']),
  contact_id: z.uuid().nullable(),
  interview_id: z.uuid().nullable(),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/\p{Cc}/u.test(value)),
  body: z.string().trim().min(1).max(10000),
});
export type JobFollowUp = z.infer<typeof followUpInputSchema> & { id: string; revision: number };

export function followUpValues(draft?: JobFollowUp) {
  return {
    kind: draft?.kind ?? 'check_in',
    contact_id: draft?.contact_id ?? '',
    interview_id: draft?.interview_id ?? '',
    subject: draft?.subject ?? '',
    body: draft?.body ?? '',
  };
}

const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export function followUpTemplate(
  kind: FollowUpKind,
  application: Pick<Application, 'company' | 'role'>,
  contact: Pick<JobContact, 'name'> | undefined,
  interview: Pick<JobInterview, 'localStart'> | undefined,
  sender: string,
) {
  const role = singleLine(application.role) || 'open';
  const company = singleLine(application.company);
  const position = `the ${role} role${company ? ` at ${company}` : ''}`;
  const date = interview ? ` on ${calendarLabel(interview.localStart.slice(0, 10))}` : '';
  const greeting = contact ? `Hi ${singleLine(contact.name)},` : 'Hello,';
  const signature = `Best,\n${singleLine(sender) || '[Your name]'}`;
  const message =
    kind === 'thank_you'
      ? `Thank you for taking the time to speak with me${date} about ${position}. I enjoyed learning more about the opportunity and appreciate your consideration.\n\nPlease let me know if I can share anything else as you consider next steps.`
      : `I’m following up on ${position}${date ? ` after our interview${date}` : ''}. I’m still interested in the opportunity and would appreciate any update you can share about timing or next steps.\n\nThank you for your time.`;
  return {
    subject: `${kind === 'thank_you' ? 'Thank you' : 'Checking in'} — ${role}`.slice(0, 200),
    body: `${greeting}\n\n${message}\n\n${signature}`.slice(0, 10000),
  };
}
