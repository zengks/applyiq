// Creates only disposable users and cleans them up. Never modifies existing accounts.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.RUN_BACKEND_VERIFICATION !== 'yes') throw new Error('Set RUN_BACKEND_VERIFICATION=yes to create and remove disposable verification accounts.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const created = [];
const files = [];
const passed = [];
const check = (result) => { if (result.error) throw result.error; return result.data; };
async function user() {
  const email = `applyiq-verification-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  created.push(user.id);
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  check(await client.auth.signInWithPassword({ email, password }));
  return { id: user.id, client };
}

try {
  const a = await user(); const b = await user();
  assert.equal(check(await a.client.from('profiles').select('id').single()).id, a.id);
  passed.push('Signup profile trigger works with restricted function permissions');
  const apps = Array.from({ length: 5 }, () => ({ id: randomUUID(), user_id: a.id, company: 'Synthetic verification', role: 'Test role', url: '' }));
  check(await a.client.from('applications').insert(apps));
  assert.ok((await a.client.from('applications').insert({ ...apps[0], id: randomUUID() })).error);
  check(await a.client.from('applications').upsert({ ...apps[0], notes: 'Idempotent retry' }).select('id').single());
  assert.equal(check(await a.client.from('applications').select('id')).length, 5);
  passed.push('Free application limit and idempotent save retries');
  assert.equal(check(await b.client.from('applications').select('id').eq('user_id', a.id)).length, 0);
  assert.ok((await b.client.from('applications').update({ notes: 'Must not save' }).eq('id', apps[0].id).select('id').single()).error);
  passed.push('Cross-account reads and writes denied');
  check(await admin.from('subscriptions').upsert({ user_id: a.id, status: 'active' }));
  const resumes = Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), user_id: a.id, name: `Synthetic ${i}`, text: `Synthetic resume ${i}`, is_default: false }));
  check(await a.client.from('resumes').insert(resumes));
  assert.ok((await a.client.from('resumes').insert({ ...resumes[0], id: randomUUID() })).error);
  check(await a.client.rpc('set_default_resume', { resume_id: resumes[0].id }));
  check(await a.client.rpc('set_default_resume', { resume_id: resumes[1].id }));
  assert.ok((await b.client.rpc('set_default_resume', { resume_id: resumes[1].id })).error);
  assert.equal(check(await a.client.from('resumes').select('id').eq('is_default', true)).length, 1);
  assert.equal(check(await a.client.from('profiles').select('resume_text').single()).resume_text, resumes[1].text);
  passed.push('Pro resume limit and atomic owned default selection');
  check(await admin.from('subscriptions').update({ status: 'canceled' }).eq('user_id', a.id));
  const reservations = await Promise.all(Array.from({ length: 4 }, () => admin.rpc('reserve_ai_analysis', { account_id: a.id, feature_name: 'ai_analysis' })));
  assert.equal(reservations.filter(r => !r.error).length, 3);
  assert.equal(reservations.filter(r => r.error).length, 1);
  assert.ok((await a.client.rpc('reserve_ai_analysis', { account_id: b.id, feature_name: 'ai_analysis' })).error);
  check(await admin.from('subscriptions').update({ status: 'active' }).eq('user_id', a.id));
  check(await admin.rpc('reserve_ai_analysis', { account_id: a.id, feature_name: 'ai_analysis' }));
  passed.push('Concurrent Free AI quota, server-only reservations, and Pro entitlement');
  const checkouts = await Promise.all(Array.from({ length: 2 }, () => admin.rpc('begin_billing_checkout', { account_id: a.id, selected_plan: 'monthly' })));
  assert.equal(check(checkouts[0])[0].request_id, check(checkouts[1])[0].request_id);
  assert.ok((await admin.rpc('begin_billing_checkout', { account_id: a.id, selected_plan: 'annual' })).error);
  assert.ok((await a.client.rpc('begin_billing_checkout', { account_id: a.id, selected_plan: 'monthly' })).error);
  passed.push('Checkout coordination and client permission boundaries');
  const path = `${a.id}/${randomUUID()}-synthetic.txt`;
  check(await a.client.storage.from('resumes').upload(path, new TextEncoder().encode('Synthetic verification only'), { contentType: 'text/plain' }));
  files.push(path);
  assert.ok((await b.client.storage.from('resumes').download(path)).error);
  assert.equal(check(await admin.storage.getBucket('resumes')).file_size_limit, 10485760);
  passed.push('Private storage ownership and file size limit');
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  if (files.length) check(await admin.storage.from('resumes').remove(files));
  for (const id of created) check(await admin.auth.admin.deleteUser(id));
  console.log('Disposable verification accounts and files removed.');
}
