import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
};

/**
 * Streams a stored resume back to the browser.
 * - `path`: the resume's storage path (must live under the caller's own folder).
 * - `download`: when present, forces a download with the given filename; otherwise served inline.
 *
 * We stream (rather than redirect to a signed URL) so we can set an accurate Content-Type
 * and `Content-Disposition: inline` — files were uploaded as octet-stream, which makes
 * browsers download instead of render them.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'Missing path.' }, { status: 400 });

  // Files are stored as `${user.id}/...`; reject anything outside the caller's folder.
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase.storage.from('resumes').download(path);
  if (error || !data) {
    console.error('Resume download error:', error);
    return NextResponse.json({ error: 'Could not access that file.' }, { status: 404 });
  }

  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const downloadName = searchParams.get('download');

  // Browsers can't render .docx inline, so for an inline view we convert it to HTML.
  if (ext === 'docx' && !downloadName) {
    const buffer = Buffer.from(await data.arrayBuffer());
    const { value: body } = await mammoth.convertToHtml({ buffer });
    const title = path.split('/').pop()?.replace(/^[0-9a-f-]{36}-/i, '') ?? 'Resume';
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
      + `<title>${escapeHtml(title)}</title>`
      + `<style>body{max-width:820px;margin:40px auto;padding:0 24px;`
      + `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;`
      + `line-height:1.6;color:#1a1917;}h1,h2,h3{line-height:1.3;}table{border-collapse:collapse;}`
      + `td,th{border:1px solid #ddd;padding:4px 8px;}</style></head><body>${body}</body></html>`;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' },
    });
  }

  const disposition = downloadName
    ? `attachment; filename="${encodeURIComponent(downloadName)}"`
    : 'inline';

  return new NextResponse(data.stream(), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=60',
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
