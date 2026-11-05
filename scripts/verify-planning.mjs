// Synthetic non-billing verification. Credentials stay in a private temporary file.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
if (process.env.RUN_BACKEND_VERIFICATION !== 'yes')
  throw Error('Set RUN_BACKEND_VERIFICATION=yes for disposable verification.');
const file = path.join(os.tmpdir(), 'applyiq-planning-browser.json');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  options,
);
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const login = async (person) => {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options,
  );
  check(await c.auth.signInWithPassword(person));
  return c;
};
const action = process.argv[2];
if (action === 'create') {
  try {
    await fs.access(file);
    throw Error('Fixture exists; clean it first.');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const fixture = { users: [], jobs: [], checks: [] };
  const save = () => fs.writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
  try {
    for (let i = 0; i < 2; i++) {
      const email = `applyiq-planning-${randomUUID()}@example.invalid`,
        password = randomBytes(32).toString('base64url');
      const { user } = check(
        await admin.auth.admin.createUser({ email, password, email_confirm: true }),
      );
      fixture.users.push({ id: user.id, email, password });
      await save();
      check(
        await admin
          .from('profiles')
          .update({ full_name: 'Planning verification', onboarded: true })
          .eq('id', user.id),
      );
    }
    const [a, b] = await Promise.all(
      fixture.users.map((p) => login({ email: p.email, password: p.password })),
    );
    const owner = fixture.users[0].id;
    const jobs = ['Northstar Studio (synthetic)', 'Capacity test (synthetic)'].map((company) => ({
      id: randomUUID(),
      user_id: owner,
      company,
      role: 'Product Engineer',
      next_action: 'Prepare examples',
      next_action_due: '2026-11-05',
      description: 'Synthetic role: build accessible interfaces and reliable workflows.',
    }));
    check(await a.from('applications').insert(jobs));
    fixture.jobs = jobs.map(({ id, company }) => ({ id, company }));
    await save();
    const contact = {
      record_id: randomUUID(),
      job_id: jobs[0].id,
      details: {
        name: 'Alex Recruiter (synthetic)',
        role: 'Talent partner',
        email: 'alex@example.invalid',
        notes: 'Private recruiting notes',
      },
      expected_revision: null,
    };
    const [c1, c2] = await Promise.all([
      a.rpc('save_job_contact', contact),
      a.rpc('save_job_contact', contact),
    ]);
    check(c1);
    check(c2);
    assert.equal(c1.data.id, c2.data.id);
    assert.equal(c2.data.revision, 0);
    assert.equal(check(await b.from('application_contacts').select('id')).length, 0);
    assert.ok((await b.rpc('save_job_contact', contact)).error);
    const changed = check(
      await a.rpc('save_job_contact', {
        ...contact,
        details: { ...contact.details, phone: '555-0100' },
        expected_revision: 0,
      }),
    );
    assert.equal(changed.revision, 1);
    assert.ok(
      (
        await a.rpc('save_job_contact', {
          ...contact,
          details: { name: 'Stale overwrite' },
          expected_revision: 0,
        })
      ).error,
    );
    fixture.checks.push(
      'Concurrent fixed-ID contact retries, owner isolation, and stale edit rejection',
    );
    const resolve = async (local_time, zone_name, occurrence = 'reject') =>
      a.rpc('resolve_interview_time', { local_time, zone_name, occurrence });
    assert.equal(
      Date.parse(check(await resolve('2026-11-05T10:00', 'America/Vancouver'))),
      Date.parse('2026-11-05T17:00:00Z'),
    );
    assert.ok((await resolve('2027-03-14T02:30', 'America/New_York')).error);
    assert.ok((await resolve('2027-11-07T01:30', 'America/New_York')).error);
    assert.equal(
      Date.parse(check(await resolve('2027-11-07T01:30', 'America/New_York', 'later'))) -
        Date.parse(check(await resolve('2027-11-07T01:30', 'America/New_York', 'earlier'))),
      3600000,
    );
    fixture.checks.push(
      'Correct Vancouver tzdata, DST gap rejection, and explicit repeated-hour choices',
    );
    const interview = {
      record_id: randomUUID(),
      job_id: jobs[0].id,
      details: {
        title: 'Technical conversation (synthetic)',
        starts_at: '2026-11-05T17:00:00Z',
        ends_at: '2026-11-05T17:45:00Z',
        time_zone: 'America/Vancouver',
        contact_id: contact.record_id,
        notes: 'Discuss accessible interfaces',
        meeting_url: 'https://example.invalid/meeting',
      },
      expected_revision: null,
    };
    const row = check(await a.rpc('save_job_interview', interview));
    assert.equal(row.local_start, '2026-11-05T10:00');
    assert.equal(row.utc_offset_seconds, -25200);
    assert.equal(check(await b.from('application_interviews').select('id')).length, 0);
    assert.ok((await b.rpc('save_job_interview', interview)).error);
    assert.ok(
      (
        await a.rpc('save_job_interview', {
          ...interview,
          record_id: randomUUID(),
          job_id: jobs[1].id,
        })
      ).error,
    );
    const updates = await Promise.all(
      ['completed', 'cancelled'].map((status) =>
        a.rpc('save_job_interview', {
          ...interview,
          details: { ...interview.details, status },
          expected_revision: 0,
        }),
      ),
    );
    assert.equal(updates.filter((r) => !r.error).length, 1);
    assert.equal(updates.filter((r) => r.error).length, 1);
    const current = check(
      await a.from('application_interviews').select('*').eq('id', interview.record_id).single(),
    );
    check(
      await a.rpc('save_job_interview', {
        ...interview,
        details: { ...interview.details, status: 'scheduled' },
        expected_revision: current.revision,
      }),
    );
    fixture.checks.push(
      'Interview ownership, same-job contact references, and concurrent status conflict protection',
    );
    const many = Array.from({ length: 99 }, () => ({
      id: randomUUID(),
      application_id: jobs[1].id,
      user_id: owner,
      name: 'Capacity test',
    }));
    check(await a.from('application_contacts').insert(many));
    const capacity = await Promise.all(
      [1, 2].map(() =>
        a
          .from('application_contacts')
          .insert({
            id: randomUUID(),
            application_id: jobs[1].id,
            user_id: owner,
            name: 'Concurrent final contact',
          }),
      ),
    );
    assert.equal(capacity.filter((r) => !r.error).length, 1);
    assert.equal(capacity.filter((r) => r.error).length, 1);
    check(await a.from('applications').delete().eq('id', jobs[1].id));
    assert.equal(
      check(await a.from('application_contacts').select('id').eq('application_id', jobs[1].id))
        .length,
      0,
    );
    fixture.checks.push('Concurrent per-job capacity bound and cascade cleanup');
    fixture.contactId = contact.record_id;
    fixture.interviewId = interview.record_id;
    await save();
    console.log(JSON.stringify({ passed: fixture.checks.length, checks: fixture.checks }));
  } catch (e) {
    await save();
    throw e;
  }
} else {
  const fixture = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const person of fixture.users) {
    const { user } = check(await admin.auth.admin.getUserById(person.id));
    assert.equal(user.email, person.email);
    assert.match(user.email, /^applyiq-planning-.*@example\.invalid$/);
  }
  if (action === 'cleanup') {
    for (const person of fixture.users) check(await admin.auth.admin.deleteUser(person.id));
    await fs.unlink(file);
    console.log('Disposable planning accounts and private temporary credentials removed.');
  } else if (action === 'verify') {
    const a = await login({ email: fixture.users[0].email, password: fixture.users[0].password });
    const contacts = check(
      await a.from('application_contacts').select('*').eq('application_id', fixture.jobs[0].id),
    );
    const interviews = check(
      await a.from('application_interviews').select('*').eq('application_id', fixture.jobs[0].id),
    );
    assert.ok(contacts.some((c) => c.name === 'Jordan Recruiter (synthetic)'));
    assert.ok(
      interviews.some(
        (i) =>
          i.title === 'Portfolio conversation (synthetic)' &&
          i.local_start === '2026-11-06T14:00' &&
          i.status === 'scheduled',
      ),
    );
    console.log(
      'Browser-created contact, rescheduled interview, and persisted status verified in Supabase.',
    );
  } else throw Error('Use create, verify, or cleanup.');
}
