import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/callback/route';
import ForgotPasswordForm from '@/app/forgot-password/ForgotPasswordForm';
import ResetPasswordPage from '@/app/reset-password/page';

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

beforeEach(() => vi.resetAllMocks());

const callback = (query: string) =>
  GET(new NextRequest(`https://example.test/auth/callback?${query}`));

describe('password recovery', () => {
  it('exchanges the recovery code with its matching browser flow ID and strips the code from the redirect', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await callback(
      'next=/reset-password&code=example-code&sb_flow_id=example-flow',
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('example-code', {
      flowId: 'example-flow',
    });
    expect(response.headers.get('location')).toBe('/reset-password');
  });

  it('returns invalid recovery links to the request form and preserves signup routing', async () => {
    auth.exchangeCodeForSession
      .mockResolvedValueOnce({ error: Error('Invalid code') })
      .mockResolvedValueOnce({ error: null });
    expect((await callback('next=/reset-password&code=expired')).headers.get('location')).toBe(
      '/forgot-password?error=callback',
    );
    expect((await callback('next=/dashboard&code=signup')).headers.get('location')).toBe(
      '/dashboard',
    );
  });

  it('does not expose address-specific provider errors on the reset request form', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'Email address not authorized', status: 500 },
    });
    render(<ForgotPasswordForm expired={false} />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'sample@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request reset link' }));
    await screen.findByRole('status');
    expect(screen.queryByText('Email address not authorized')).toBeNull();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('sample@example.invalid', {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
  });

  it('requires the password confirmation before requesting an update', async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('New password', { exact: true }), {
      target: { value: 'Synthetic-password#286' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Different-password#286' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('matching passwords');
    expect(auth.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Synthetic-password#286' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('Password updated'));
    expect(auth.updateUser).toHaveBeenCalledOnce();
  });
});
