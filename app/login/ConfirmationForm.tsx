'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authStyles as s } from '@/components/auth/authStyles';
import { SIGNUP_CONFIRMATION_PATH } from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/client';

export default function ConfirmationForm({ confirmationFailed }: { confirmationFailed: boolean }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    try {
      await createClient().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}${SIGNUP_CONFIRMATION_PATH}` },
      });
    } catch {
      // Keep the same acknowledgement even if the provider throws.
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" style={s.page}>
      <form className="auth-card" style={s.card} method="post" onSubmit={submit}>
        <h1 style={s.brand}>{sent ? 'Check your email' : 'Resend confirmation email'}</h1>
        {sent ? (
          <p style={s.subtitle} role="status">
            If there’s an unconfirmed account for that address, you’ll receive a new link. Open it in this browser.
          </p>
        ) : (
          <>
            {confirmationFailed && (
              <p style={s.error} role="alert">
                This confirmation link may have expired or already been used. Request a new link and open it in this browser.
              </p>
            )}
            <label htmlFor="email" style={s.label}>Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="auth-input" style={s.input} />
            <button type="submit" className="auth-button" style={s.button} disabled={busy}>
              {busy ? 'Requesting…' : 'Request new confirmation link'}
            </button>
          </>
        )}
        <div style={s.footer}>
          <Link href="/login" className="auth-link" style={s.link}>Back to sign in</Link>
        </div>
      </form>
    </main>
  );
}
