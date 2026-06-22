import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Parses an uploaded resume (PDF/DOCX/TXT) to text and stores the file in the user's bucket folder. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const lower = file.name.toLowerCase();

  let text = '';
  try {
    if (lower.endsWith('.pdf')) {
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      text = result.text ?? '';
      await parser.destroy();
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

  // Store the original file under the user's folder so RLS scopes access to them.
  const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from('resumes')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (upErr) {
    console.error('Resume storage upload error:', upErr);
    return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 });
  }

  return NextResponse.json({ text: text.trim(), filePath: path, name: file.name });
}
