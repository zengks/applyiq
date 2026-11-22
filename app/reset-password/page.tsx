'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authStyles as s } from '@/components/auth/authStyles';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    setError('');
    if (password.length < 12 || password !== form.get('confirmPassword')) {
      setError('Use matching passwords with at least 12 characters.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setSaved(true);
    } catch {
      setError('We couldn’t save the password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" style={s.page}>
      <form className="auth-card" style={s.card} method="post" onSubmit={submit}>
        <h1 style={s.brand}>{saved ? 'Password updated' : 'Set a new password'}</h1>
        {saved ? (
          <div style={s.footer}>
            <Link href="/dashboard" style={s.link}>
              Continue to your workspace
            </Link>
          </div>
        ) : (
          <>
            <p style={s.subtitle}>Use at least 12 characters.</p>
            {error && (
              <p style={s.error} role="alert">
                {error}
              </p>
            )}
            <label htmlFor="password" style={s.label}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              className="auth-input"
              style={s.input}
            />
            <label htmlFor="confirmPassword" style={s.label}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              className="auth-input"
              style={s.input}
            />
            <button type="submit" className="auth-button" style={s.button} disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
            <div style={s.footer}>
              <Link href="/forgot-password" style={s.link}>
                Request another link
              </Link>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
