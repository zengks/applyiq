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
      <main style={s.page}>
        <div style={s.card}>
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
    <main style={s.page}>
      <form style={s.card} onSubmit={handleSubmit}>
        <div style={s.brand}>Create your account</div>
        <div style={s.subtitle}>Start your 14-day free trial</div>

        <div style={s.notice}>
          Your trial is free for 14 days. To begin, you&apos;ll add a card after confirming your
          email — <strong>you won&apos;t be charged during the trial</strong>, and we&apos;ll email
          you before it ends. After day 14 your card is charged the monthly fee automatically;
          cancel anytime before then.
        </div>

        {error && <div style={s.error}>{error}</div>}

        <label style={s.label} htmlFor="fullName">Full name</label>
        <input
          id="fullName" type="text" required style={s.input} value={fullName}
          onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera"
        />

        <label style={s.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" required style={s.input} value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        />

        <label style={s.label} htmlFor="password">Password</label>
        <input
          id="password" type="password" required minLength={6} style={s.input} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
        />

        <button type="submit" style={{ ...s.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <div style={s.footer}>
          Already have an account? <Link href="/login" style={s.link}>Sign in</Link>
        </div>
      </form>
    </main>
  );
}
