'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { authStyles as s } from '@/components/auth/authStyles';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="auth-page" style={s.page}>
      <form className="auth-card" style={s.card} onSubmit={handleSubmit}>
        <Link href="/" className="auth-mark" style={s.mark} aria-label="ApplyIQ home">A</Link>
        <div className="auth-brand" style={s.brand}>Welcome back</div>
        <div className="auth-subtitle" style={s.subtitle}>Sign in to your ApplyIQ account</div>

        {error && (
          <div className="auth-error" style={s.error} role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <label style={s.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" required className="auth-input" style={s.input} value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          // Mobile keyboards: the email layout (with @ and .), no auto-capitalising
          // or autocorrecting an address, and a password manager that can fill it.
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={error ? true : undefined}
        />

        <label style={s.label} htmlFor="password">Password</label>
        <div className="auth-password" style={s.passwordWrap}>
          <input
            id="password" type={showPassword ? 'text' : 'password'} required className="auth-input"
            style={{ ...s.input, ...s.passwordInput }} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // Labels the keyboard's action key "Go" instead of "return".
            enterKeyHint="go"
            aria-invalid={error ? true : undefined}
          />
          {/* Typing a password blind on a phone keyboard is where most failed
              sign-ins come from — every mobile OS offers this, so users expect it. */}
          <button
            type="button"
            className="auth-reveal"
            style={s.reveal}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            // Without this the press steals focus from the field, which on a phone
            // closes the keyboard mid-typing. Keyboard users still reach it by Tab.
            onMouseDown={(e) => e.preventDefault()}
          >
            {showPassword ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        <button type="submit" className="auth-button" style={{ ...s.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={s.footer}>
          New to ApplyIQ? <Link href="/register" className="auth-link" style={s.link}>Create an account</Link>
        </div>
      </form>
    </main>
  );
}
