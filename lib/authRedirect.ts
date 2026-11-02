export function safeAuthRedirect(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/dashboard';
  return next;
}
