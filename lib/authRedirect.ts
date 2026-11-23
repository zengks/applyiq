export const SIGNUP_CONFIRMATION_PATH = '/auth/callback?next=/dashboard';

export function safeAuthRedirect(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.includes('\\') || /\p{Cc}/u.test(next)) {
    return '/dashboard';
  }
  const { pathname, search, hash } = new URL(next, 'https://applyiq.invalid');
  return pathname.startsWith('//') ? '/dashboard' : `${pathname}${search}${hash}`;
}
