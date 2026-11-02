// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'owned' } } }) },
  storage: { from: () => ({ download: async () => ({ data: new Blob(['synthetic']), error: null }) }) },
}) }));
vi.mock('mammoth', () => ({ default: { convertToHtml: async () => ({ value: '<h1>Resume</h1><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a><a href="https://example.com">safe</a><img src=x onerror=alert(1)>' }) } }));
import { GET } from '@/app/api/resume/file/route';
describe('resume preview isolation', () => {
  it('removes active content and serves the preview in a sandbox', async () => {
    const response = await GET(new Request('https://applyiq.example/api/resume/file?path=owned/test.docx'));
    const html = await response.text();
    expect(html).toContain('<h1>Resume</h1>');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toMatch(/javascript:|<script|onerror|<img/);
    expect(response.headers.get('content-security-policy')).toContain('sandbox;');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects another account folder before downloading', async () => {
    const response = await GET(new Request('https://applyiq.example/api/resume/file?path=someone-else/test.docx'));
    expect(response.status).toBe(403);
  });
});
