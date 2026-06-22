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
    <main style={s.page}>
      <form style={s.card} onSubmit={handleSubmit}>
        <div style={s.brand}>Welcome back</div>
        <div style={s.subtitle}>Sign in to your ApplyIQ account</div>

        {error && <div style={s.error}>{error}</div>}

        <label style={s.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" required style={s.input} value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        />

        <label style={s.label} htmlFor="password">Password</label>
        <input
          id="password" type="password" required style={s.input} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
        />

        <button type="submit" style={{ ...s.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={s.footer}>
          New to ApplyIQ? <Link href="/register" style={s.link}>Create an account</Link>
        </div>
      </form>
    </main>
  );
}
