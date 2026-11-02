import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';
import { readBodyBytes } from '@/lib/server/requestBody';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Parses an uploaded resume (PDF/DOCX/TXT) to text and stores the file in the user's bucket folder. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let form: FormData;
  try {
    const body = await readBodyBytes(req, MAX_BYTES + 65536);
    form = await new Response(new Uint8Array(body), { headers: { 'Content-Type': req.headers.get('content-type') ?? '' } }).formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload or request too large (max 10 MB).' }, { status: 413 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const lower = file.name.toLowerCase();

  let text = '';
  try {
    if (lower.endsWith('.pdf')) {
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        text = result.text ?? '';
      } finally { await parser.destroy(); }
    } else if (lower.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value ?? '';
    } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      text = new TextDecoder().decode(bytes);
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' }, { status: 400 });
    }
  } catch (err) {
    console.error('Resume parse error:', err);
    return NextResponse.json({ error: 'Could not read that file.' }, { status: 422 });
  }

  if (text.length > 60000) return NextResponse.json({ error: 'Resume text is too long (max 60,000 characters).' }, { status: 413 });
  if (form.get('store') === 'false') return NextResponse.json({ text: text.trim(), name: file.name });

  // Store the original file under the user's folder so RLS scopes access to them.
  const name = file.name.replace(/[/\\\x00-\x1f\x7f]/g, '_').slice(-180);
  const path = `${user.id}/${crypto.randomUUID()}-${name}`;
  const { error: upErr } = await supabase.storage
    .from('resumes')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (upErr) {
    console.error('Resume storage upload error:', upErr);
    return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 });
  }

  return NextResponse.json({ text: text.trim(), filePath: path, name: file.name });
}
