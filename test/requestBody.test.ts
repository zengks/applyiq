// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readBodyBytes, readJsonBody } from '@/lib/server/requestBody';

describe('bounded request bodies', () => {
  it('accepts an exactly sized body and parses JSON', async () => {
    const body = JSON.stringify({ name: 'résumé' });
    const request = new Request('https://example.com', { method: 'POST', body });
    expect(await readJsonBody(request, Buffer.byteLength(body))).toEqual({ name: 'résumé' });
  });

  it('counts bytes rather than characters', async () => {
    const request = new Request('https://example.com', { method: 'POST', body: 'éé' });
    await expect(readBodyBytes(request, 3)).rejects.toThrow('Request too large');
  });

  it('rejects and cancels an oversized stream despite a smaller Content-Length', async () => {
    const cancel = vi.fn();
    let chunk = 0;
    const body = new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(++chunk === 1 ? 3 : 4)); },
      cancel,
    });
    const request = new Request('https://example.com', {
      method: 'POST', body, headers: { 'Content-Length': '1' }, duplex: 'half',
    } as RequestInit);
    await expect(readBodyBytes(request, 5)).rejects.toThrow('Request too large');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects malformed JSON and absent bodies', async () => {
    await expect(readJsonBody(new Request('https://example.com', { method: 'POST', body: '{' }))).rejects.toThrow();
    await expect(readBodyBytes(new Request('https://example.com'), 10)).rejects.toThrow('Missing request body');
  });
});
