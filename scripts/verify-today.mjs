// Disposable non-billing verification for the Today view and workspace recovery.
// No Stripe calls, subscriptions, or billing records are created or changed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.RUN_BACKEND_VERIFICATION !== 'yes')
  throw new Error('Set RUN_BACKEND_VERIFICATION=yes to use disposable verification accounts.');
const file = path.join(os.tmpdir(), 'applyiq-today-browser.json');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const check = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
const action = process.argv[2];
const listFields =
  'id,user_id,company,role,status,match,deadline,url,created_at,posting_status,posting_checked_at,posting_note,captured_at,applied_at,next_action,next_action_due,next_action_done,selected_resume_id';
async function signedIn(person) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  check(
    await client.auth.signInWithPassword({
      email: person.email,
      password: person.password,
    }),
  );
  return client;
}
async function cleanup(fixture) {
  for (const person of fixture.users) {
    const { user } = check(await admin.auth.admin.getUserById(person.id));
    assert.equal(user.email, person.email);
    assert.match(user.email, /^applyiq-today-.*@example\.invalid$/);
    check(await admin.auth.admin.deleteUser(person.id));
  }
  await fs.unlink(file);
  console.log('Disposable Today accounts and temporary credentials removed.');
}

if (action === 'create') {
  try {
    await fs.access(file);
    throw new Error('A Today fixture exists. Clean it up first.');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const fixture = { users: [], jobs: [], checks: [] };
  const save = () => fs.writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
  try {
    for (let i = 0; i < 2; i++) {
      const email = `applyiq-today-${randomUUID()}@example.invalid`;
      const password = randomBytes(32).toString('base64url');
      const { user } = check(
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      );
      fixture.users.push({ id: user.id, email, password });
      await save();
    }
    const [a, b] = await Promise.all(fixture.users.map(signedIn));
    const owner = fixture.users[0].id;
    check(await admin.from('profiles').delete().eq('id', owner));
    check(
      await a.from('profiles').insert({
        id: owner,
        full_name: 'Today verification',
        onboarded: true,
      }),
    );
    assert.ok((await b.from('profiles').insert({ id: owner, full_name: 'Must not write' })).error);
    assert.equal(check(await b.from('profiles').select('id').eq('id', owner)).length, 0);
    fixture.checks.push('Profile ownership reads and inserts retain isolation');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Vancouver',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (name) => parts.find((p) => p.type === name).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const shifted = (days) => {
      const value = new Date(`${today}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    fixture.today = today;
    fixture.rescheduledDate = shifted(4);
    const jobs = [
      {
        id: randomUUID(),
        company: 'Northstar Studio (synthetic)',
        role: 'Product Engineer',
        next_action: 'Follow up with recruiting',
        next_action_due: shifted(-1),
        deadline: shifted(1),
      },
      {
        id: randomUUID(),
        company: 'Cedar Labs (synthetic)',
        role: 'Frontend Engineer',
        next_action: 'Prepare interview examples',
        next_action_due: today,
        deadline: shifted(1),
      },
      {
        id: randomUUID(),
        company: 'Harbor Tools (synthetic)',
        role: 'Product Developer',
        next_action: 'Review the role requirements',
        next_action_due: shifted(2),
        deadline: shifted(3),
      },
    ].map((job) => ({
      ...job,
      user_id: owner,
      description:
        'Synthetic posting: build accessible React interfaces and reliable data workflows. '.padEnd(
          60000,
          'x',
        ),
      captured_at: new Date().toISOString(),
      notes: 'Synthetic saved notes. '.repeat(100),
    }));
    check(await a.from('applications').insert(jobs));
    fixture.jobs = jobs.map(({ id, company }) => ({ id, company }));
    await save();
    assert.equal(check(await b.from('applications').select('id').eq('user_id', owner)).length, 0);
    assert.ok(
      (
        await b
          .from('applications')
          .update({ next_action_done: true })
          .eq('id', jobs[0].id)
          .select('id')
          .single()
      ).error,
    );
    assert.ok(
      (await a.from('applications').update({ user_id: fixture.users[1].id }).eq('id', jobs[0].id))
        .error,
    );
    check(
      await a
        .from('applications')
        .update({ next_action_done: true })
        .eq('id', jobs[1].id)
        .select('id')
        .single(),
    );
    check(
      await a
        .from('applications')
        .update({ next_action_done: false })
        .eq('id', jobs[1].id)
        .select('id')
        .single(),
    );
    fixture.checks.push(
      'Application isolation, owner reassignment prevention, and quick-action persistence',
    );
    const resume = {
      id: randomUUID(),
      user_id: owner,
      name: 'Product résumé',
      text: 'Synthetic candidate: built accessible React interfaces and reliable data workflows.',
    };
    check(await a.from('resumes').insert(resume));
    assert.equal(check(await b.from('resumes').select('id').eq('user_id', owner)).length, 0);
    assert.ok(
      (
        await b
          .from('resumes')
          .update({ text: 'Must not overwrite' })
          .eq('id', resume.id)
          .select('id')
          .single()
      ).error,
    );
    check(await a.rpc('set_default_resume', { resume_id: resume.id }));
    assert.equal(
      check(await a.from('profiles').select('resume_text').single()).resume_text,
      resume.text,
    );
    fixture.checks.push('Résumé isolation and owned default selection');
    fixture.resumeVersionId = randomUUID();
    fixture.analysisId = randomUUID();
    fixture.letterId = randomUUID();
    fixture.submissionId = randomUUID();
    const result = {
      matchScore: 84,
      company: jobs[0].company,
      role: jobs[0].role,
      matchedKeywords: ['React', 'Accessibility'],
      missingKeywords: ['Observability'],
      aiSuggestion: 'Use a concrete example of an accessible interface you shipped.',
      coverLetter:
        'Dear Northstar team,\n\nI build accessible React interfaces and reliable data workflows.\n\nSincerely,\nSynthetic candidate',
      interviewQuestions: [
        {
          q: 'How do you test keyboard navigation?',
          hint: 'Use an example you can support.',
        },
      ],
      salaryRange: 'Not specified',
      industry: 'Software',
      seniority: 'Mid-level',
      culture: ['Collaboration'],
    };
    check(
      await a.rpc('save_application_analysis', {
        job_id: jobs[0].id,
        resume_record: fixture.resumeVersionId,
        analysis_record: fixture.analysisId,
        letter_record: fixture.letterId,
        resume_snapshot: {
          name: resume.name,
          text: resume.text,
          filePath: null,
          sourceResumeId: resume.id,
        },
        analysis_result: result,
        posting_text: jobs[0].description,
        source_url: '',
      }),
    );
    check(
      await a.rpc('record_application_submission', {
        record_id: fixture.submissionId,
        job_id: jobs[0].id,
        resume_version: fixture.resumeVersionId,
        cover_version: fixture.letterId,
        submission_date: today,
      }),
    );
    assert.equal(check(await b.from('application_materials').select('id')).length, 0);
    fixture.checks.push('Submitted material snapshots remain owned and linked');
    const timings = { full: [], metadata: [] };
    let full, metadata;
    for (let i = 0; i < 3; i++) {
      let start = performance.now();
      full = check(await a.from('applications').select('*').order('id'));
      timings.full.push(performance.now() - start);
      start = performance.now();
      metadata = check(await a.from('applications').select(listFields).order('id'));
      timings.metadata.push(performance.now() - start);
    }
    assert.deepEqual(
      metadata.map((row) => row.id),
      full.map((row) => row.id),
    );
    assert.ok(metadata.every((row) => !('description' in row) && !('notes' in row)));
    const median = (values) => Math.round([...values].sort((x, y) => x - y)[1]);
    const fullBytes = Buffer.byteLength(JSON.stringify(full));
    const metadataBytes = Buffer.byteLength(JSON.stringify(metadata));
    fixture.measurement = {
      rows: 3,
      postingCharactersPerRow: 60000,
      fullJsonBytes: fullBytes,
      metadataJsonBytes: metadataBytes,
      jsonByteReductionPercent: Number(((1 - metadataBytes / fullBytes) * 100).toFixed(2)),
      sampleMedianMs: {
        full: median(timings.full),
        metadata: median(timings.metadata),
      },
      samples: 3,
    };
    fixture.checks.push(
      'Initial job metadata excludes large text bodies while preserving the same owned records',
    );
    await save();
    await fs.writeFile(
      '/tmp/applyiq-today-backend-report.json',
      JSON.stringify({ checks: fixture.checks, measurement: fixture.measurement }, null, 2),
    );
    console.log(
      JSON.stringify({
        passed: fixture.checks.length,
        checks: fixture.checks,
        measurement: fixture.measurement,
      }),
    );
  } catch (error) {
    try {
      await cleanup(fixture);
    } catch (cleanupError) {
      console.error('Fixture cleanup needs attention:', cleanupError.message);
    }
    throw error;
  }
} else {
  const fixture = JSON.parse(await fs.readFile(file, 'utf8'));
  if (action === 'cleanup') await cleanup(fixture);
  else if (action === 'verify-browser') {
    const [job, todayJob, futureJob] = fixture.jobs;
    const rows = check(
      await admin
        .from('applications')
        .select('id,next_action_done,next_action_due,notes')
        .in(
          'id',
          fixture.jobs.map((item) => item.id),
        ),
    );
    assert.equal(rows.find((row) => row.id === todayJob.id).next_action_done, true);
    assert.equal(
      rows.find((row) => row.id === futureJob.id).next_action_due,
      fixture.rescheduledDate,
    );
    assert.equal(rows.find((row) => row.id === job.id).notes, 'Notes recovered after reload.');
    const materials = check(
      await admin.from('application_materials').select('id,kind,body').eq('application_id', job.id),
    );
    assert.equal(materials.filter((item) => item.kind === 'cover_letter').length, 2);
    assert.match(
      materials.find((item) => item.id === fixture.letterId).body.text,
      /Dear Northstar team/,
    );
    assert.ok(
      materials.some(
        (item) =>
          item.kind === 'cover_letter' && item.body.text === 'Recovered draft letter for review.',
      ),
    );
    const submission = check(
      await admin
        .from('application_submissions')
        .select('cover_letter_version_id,resume_version_id')
        .eq('id', fixture.submissionId)
        .single(),
    );
    assert.equal(submission.cover_letter_version_id, fixture.letterId);
    assert.equal(submission.resume_version_id, fixture.resumeVersionId);
    console.log(
      'Browser Today completion/rescheduling, recovered notes/letter, and unchanged submitted versions verified in Supabase.',
    );
  } else throw new Error('Use create, verify-browser, or cleanup.');
}
