import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { isPrivateHost, safeFetchUrl, MAX_BODY_BYTES } from '@/lib/postingCheck';

export class UnsafePostingUrl extends Error {}

export async function publicAddresses(host: string) {
  const hostname = host.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => isPrivateHost(a.address))) {
    throw new UnsafePostingUrl('Non-public destination');
  }
  return addresses;
}

/** Resolve and pin each connection; redirects never bypass destination checks. */
export async function fetchPosting(raw: string, timeoutMs = 12_000): Promise<{ status: number; html: string }> {
  let destination = raw;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const url = safeFetchUrl(destination);
    if (!url) throw new UnsafePostingUrl('Unsafe posting URL');
    const addresses = await new Promise<Awaited<ReturnType<typeof publicAddresses>>>((resolve, reject) => {
      const aborted = () => reject(signal.reason);
      signal.addEventListener('abort', aborted, { once: true });
      publicAddresses(url.hostname).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    });
    signal.throwIfAborted();
    const address = addresses[0];
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        signal,
        family: address.family,
        agent: false,
        // Keep the original Host and TLS server name while connecting only to
        // the address we validated, preventing a second DNS lookup/rebinding.
        lookup: (_hostname, options, callback) => options.all
          ? callback(null, [address])
          : callback(null, address.address, address.family),
        headers: { 'User-Agent': 'ApplyIQ/1.0 (job posting availability check)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      }, resolve);
      request.on('error', reject);
      request.end();
    });
    const status = response.statusCode ?? 502;
    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
      response.destroy();
      destination = new URL(response.headers.location, url).href;
      continue;
    }
    if (status < 200 || status >= 300 || !(response.headers['content-type'] ?? '').includes('html') || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
      response.destroy();
      return { status, html: '' };
    }
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of response) {
        const bytes = Buffer.from(chunk);
        const remaining = MAX_BODY_BYTES - length;
        chunks.push(bytes.subarray(0, remaining));
        length += Math.min(bytes.length, remaining);
        if (length >= MAX_BODY_BYTES) break;
      }
    } finally { response.destroy(); }
    return { status, html: Buffer.concat(chunks).toString('utf8') };
  }
  throw new UnsafePostingUrl('Too many redirects');
}
