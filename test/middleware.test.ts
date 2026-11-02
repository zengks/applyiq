import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest } from 'next/server';

const reqFor = (path: string) => new NextRequest(`http://localhost${path}`);
const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null } });

describe('updateSession (auth middleware)', () => {
  beforeEach(() => getUser.mockReset());

  it('redirects signed-out users from protected pages to /login', async () => {
    signedOut();
    const res = await updateSession(reqFor('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('lets signed-out users reach public auth pages', async () => {
    signedOut();
    const res = await updateSession(reqFor('/login'));
    expect(res.headers.get('location')).toBeNull(); // NextResponse.next(), no redirect
  });

  it('returns JSON 401 for an unauthenticated API request', async () => {
    signedOut();
    const res = await updateSession(reqFor('/api/analyze'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated.' });
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets signed-out users reach the landing page', async () => {
    signedOut();
    const res = await updateSession(reqFor('/'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('sends signed-in users off the marketing page to /dashboard', async () => {
    signedIn();
    const res = await updateSession(reqFor('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('sends signed-in users off /login and /register to /dashboard', async () => {
    signedIn();
    for (const p of ['/login', '/register']) {
      const res = await updateSession(reqFor(p));
      expect(res.headers.get('location')).toContain('/dashboard');
    }
  });

  it('lets signed-in users reach the app', async () => {
    signedIn();
    const res = await updateSession(reqFor('/dashboard'));
    expect(res.headers.get('location')).toBeNull();
  });
});
