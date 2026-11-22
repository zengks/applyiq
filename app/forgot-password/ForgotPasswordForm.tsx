'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authStyles as s } from '@/components/auth/authStyles';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    expired ? 'Request a new link and open it in this browser.' : '',
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    setError('');
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      // Use the same receipt for address-specific failures and successful requests.
      if (error?.name === 'AuthRetryableFetchError') throw error;
      setSent(true);
    } catch {
      setError('We couldn’t process the request right now. Try again in a few minutes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" style={s.page}>
      <form className="auth-card" style={s.card} method="post" onSubmit={submit}>
        <h1 style={s.brand}>{sent ? 'Check your email' : 'Reset your password'}</h1>
        {error && (
          <p style={s.error} role="alert">
            {error}
          </p>
        )}
        {sent ? (
          <p style={s.subtitle} role="status">
            If your account can receive email, you’ll get a reset link. Open it in this browser.
          </p>
        ) : (
          <>
            <p style={s.subtitle}>Enter your account email to request a reset link.</p>
            <label htmlFor="email" style={s.label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="auth-input"
              style={s.input}
            />
            <button type="submit" className="auth-button" style={s.button} disabled={busy}>
              {busy ? 'Requesting…' : 'Request reset link'}
            </button>
          </>
        )}
        <div style={s.footer}>
          <Link href="/login" style={s.link}>
            Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
