import { fireEvent, render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { GET as callback } from '@/app/auth/callback/route';
import { GET as confirm } from '@/app/auth/confirm/route';
import LoginPage from '@/app/login/page';

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

beforeEach(() => vi.resetAllMocks());

it.each([
  [callback, '/auth/callback?code=expired', 'callback'],
  [confirm, '/auth/confirm?type=email&token_hash=expired', 'confirm'],
] as const)('offers a new link after a failed signup request to %s', async (route, path, error) => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') });
  auth.verifyOtp.mockResolvedValue({ error: new Error('Invalid token') });
  const response = await route(new NextRequest(`https://applyiq.example${path}`));
  const location = new URL(response.headers.get('location')!, 'https://applyiq.example');
  expect(location.pathname + location.search).toBe(`/login?error=${error}`);

  render(await LoginPage({ searchParams: Promise.resolve({ error: location.searchParams.get('error')! }) }));
  expect(screen.getByRole('alert')).toHaveTextContent('may have expired or already been used');
  expect(screen.getByRole('button', { name: 'Request new confirmation link' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
});

it.each([
  { error: null },
  { error: { message: 'Account does not exist' } },
  { error: { message: 'Confirmation already sent' } },
])('uses the same receipt for every provider response', async (result) => {
  auth.resend.mockResolvedValue(result);
  render(await LoginPage({ searchParams: Promise.resolve({ resend: 'confirmation' }) }));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' qa@example.invalid ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Request new confirmation link' }));

  expect(await screen.findByRole('status')).toHaveTextContent('If there’s an unconfirmed account for that address');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(auth.resend).toHaveBeenCalledExactlyOnceWith({
    type: 'signup',
    email: 'qa@example.invalid',
    options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
  });
});

it('retains ordinary sign-in and a path to request a confirmation link', async () => {
  render(await LoginPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Resend confirmation email' })).toHaveAttribute('href', '/login?resend=confirmation');
});

it('confirms a fresh PKCE link with its flow ID and only redirects within ApplyIQ', async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const url = new URL('https://applyiq.example/auth/callback?code=fresh&sb_flow_id=fresh-flow');
  url.searchParams.set('next', 'https://elsewhere.example/');
  const response = await callback(new NextRequest(url));
  expect(response.headers.get('location')).toBe('/dashboard');
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('fresh', { flowId: 'fresh-flow' });
});
