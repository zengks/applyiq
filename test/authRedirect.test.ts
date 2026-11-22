import { describe, expect, it } from 'vitest';
import { safeAuthRedirect } from '@/lib/authRedirect';
describe('confirmation redirect safety', () => {
  it.each([null, '//evil.example', '/\t/evil.example', '/a/..//evil.example', '@evil.example', 'https://evil.example', '/\\evil.example'])('rejects external destination %s', value => {
    expect(safeAuthRedirect(value)).toBe('/dashboard');
  });
  it('preserves an internal path and query', () => {
    expect(safeAuthRedirect('/dashboard?checkout=success')).toBe('/dashboard?checkout=success');
    expect(safeAuthRedirect('/dashboard?label=café')).toBe('/dashboard?label=caf%C3%A9');
  });
});
