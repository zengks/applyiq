'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { authStyles as s } from '@/components/auth/authStyles';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="auth-page" style={s.page}>
        <div className="auth-card" style={s.card}>
          <div style={s.brand}>Check your email</div>
          <div style={s.subtitle}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then sign in.
          </div>
          <Link href="/login" style={{ ...s.button, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page" style={s.page}>
      <form className="auth-card" style={s.card} onSubmit={handleSubmit}>
        <div style={s.brand}>Create your account</div>
        <div style={s.subtitle}>Track applications free, or try Pro for 14 days</div>

        <div style={s.notice}>
          The Free plan needs no card. If you choose Pro, your first 14 days are free after
          adding a card. Your selected monthly or annual plan then renews automatically;
          cancel before the trial ends to avoid a charge.
        </div>

        {error && <div style={s.error}>{error}</div>}

        <label style={s.label} htmlFor="fullName">Full name</label>
        <input
          id="fullName" type="text" required className="auth-input" autoComplete="name" style={s.input} value={fullName}
          onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera"
        />

        <label style={s.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" required className="auth-input" autoComplete="email" inputMode="email" style={s.input} value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        />

        <label style={s.label} htmlFor="password">Password</label>
        <input
          id="password" type="password" required minLength={12} className="auth-input" autoComplete="new-password" style={s.input} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters"
        />

        <button type="submit" className="auth-button" style={{ ...s.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <div style={s.footer}>
          Already have an account? <Link href="/login" style={s.link}>Sign in</Link>
        </div>
      </form>
    </main>
  );
}
