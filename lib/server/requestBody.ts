/** Bound bytes before JSON parsing; Content-Length is not trusted. */
export async function readBodyBytes(request: Request, maximum: number): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('Request too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

export async function readJsonBody(request: Request, maximum = 150_000): Promise<unknown> {
  return JSON.parse((await readBodyBytes(request, maximum)).toString('utf8'));
}
