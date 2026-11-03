// Companion for a manual browser smoke test. Uses only disposable synthetic data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.RUN_BACKEND_VERIFICATION !== 'yes') throw new Error('Set RUN_BACKEND_VERIFICATION=yes for disposable browser verification.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const file = path.join(os.tmpdir(), 'applyiq-workspace-browser.json');
const check = result => { if (result.error) throw result.error; return result.data; };
const action = process.argv[2];

if (action === 'create') {
  try { await fs.access(file); throw new Error('A browser fixture already exists. Clean it up first.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const email = `applyiq-browser-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  await fs.writeFile(file, JSON.stringify({ id: user.id, email, password }), { mode: 0o600 });
  check(await admin.from('profiles').update({ full_name: 'Workspace verification', onboarded: true }).eq('id', user.id));
  check(await admin.from('resumes').insert({ user_id: user.id, name: 'Product résumé', text: 'Synthetic candidate: built accessible React interfaces and reliable data workflows.', is_default: true }));
  console.log('Disposable browser fixture created; credentials are stored privately in the OS temporary directory.');
} else {
  const fixture = JSON.parse(await fs.readFile(file, 'utf8'));
  const { user } = check(await admin.auth.admin.getUserById(fixture.id));
  assert.equal(user.email, fixture.email);
  assert.match(user.email, /^applyiq-browser-.*@example\.invalid$/);
  if (action === 'cleanup') {
    check(await admin.auth.admin.deleteUser(fixture.id));
    await fs.unlink(file);
    console.log('Disposable browser fixture removed.');
  } else if (action === 'seed-analysis') {
    const job = check(await admin.from('applications').select('*').eq('user_id', fixture.id).eq('company', 'Northstar Studio (synthetic)').single());
    const resume = check(await admin.from('application_materials').select('*').eq('application_id', job.id).eq('kind', 'resume').single());
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    check(await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password }));
    const result = { matchScore: 84, company: job.company, role: job.role, matchedKeywords: ['React', 'Accessibility', 'Product engineering'], missingKeywords: ['Observability'], aiSuggestion: 'Use a concrete example of an accessible interface you shipped. Add only experience you can support.', coverLetter: 'Dear Northstar team,\n\nI build accessible React interfaces and reliable data workflows. I would welcome the opportunity to discuss how that experience fits your product engineering work.\n\nSincerely,\nSynthetic candidate', interviewQuestions: [{ q: 'How did you test keyboard navigation?', hint: 'Discuss focus order, semantics, and the checks you actually ran.' }], salaryRange: 'Not specified', industry: 'Software', seniority: 'Mid-level', culture: ['Collaboration'] };
    const analysisId = randomUUID(); const letterId = randomUUID();
    check(await client.rpc('save_application_analysis', { job_id: job.id, resume_record: resume.id, analysis_record: analysisId, letter_record: letterId, resume_snapshot: null, analysis_result: result, posting_text: job.description, source_url: job.url }));
    await fs.writeFile(file, JSON.stringify({ ...fixture, jobId: job.id, resumeId: resume.id, analysisId, letterId }), { mode: 0o600 });
    console.log('Synthetic analysis and cover letter saved through the authenticated workspace RPC. No AI provider call was made.');
  } else if (action === 'verify') {
    const job = check(await admin.from('applications').select('*').eq('id', fixture.jobId).eq('user_id', fixture.id).single());
    assert.equal(job.next_action, 'Follow up with recruiting'); assert.equal(job.next_action_due, '2026-11-10');
    assert.match(job.description, /accessible React/);
    const materials = check(await admin.from('application_materials').select('*').eq('application_id', job.id));
    assert.equal(materials.filter(item => item.kind === 'resume').length, 1);
    assert.equal(materials.filter(item => item.kind === 'analysis').length, 1);
    assert.equal(materials.filter(item => item.kind === 'cover_letter').length, 2);
    const submission = check(await admin.from('application_submissions').select('*').eq('application_id', job.id).single());
    assert.equal(submission.resume_version_id, fixture.resumeId);
    assert.equal(submission.cover_letter_version_id, fixture.letterId);
    const original = materials.find(item => item.id === fixture.letterId);
    assert.match(original.body.text, /Dear Northstar team/);
    assert.ok(materials.some(item => item.kind === 'cover_letter' && item.body.text.includes('Edited version for a later application')));
    check(await admin.from('resumes').update({ text: 'Later vault edit: must not replace the submitted snapshot.' }).eq('user_id', fixture.id));
    assert.match(materials.find(item => item.id === fixture.resumeId).body.text, /accessible React/);
    assert.equal(job.status, 'applied');
    console.log('Browser-created job, next action, immutable materials, selected submission, and database persistence verified.');
  } else throw new Error('Use create, seed-analysis, verify, or cleanup.');
}
