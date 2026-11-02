// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { safeFetchUrl } from '@/lib/postingCheck';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));
import { fetchPosting, publicAddresses } from '@/lib/server/postingFetch';

beforeEach(() => {
  mocks.lookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mocks.request.mockReset();
});

function response(status: number, headers: Record<string, string>, chunks: string[] = []) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const result = Object.assign(Readable.from(chunks), { statusCode: status, headers });
    return Object.assign(new EventEmitter(), { end: () => queueMicrotask(() => callback(result)) });
  });
}

describe('posting fetch destination protection', () => {
  it.each(['http://127.0.0.1/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/', 'http://[fc00::1]/', 'https://user:secret@example.com/'])('rejects %s', async url => {
    expect(safeFetchUrl(url)).toBeNull();
    await expect(fetchPosting(url)).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('allows normal host names beginning with fd or fc', () => {
    expect(safeFetchUrl('https://fda.gov/jobs')).not.toBeNull();
  });
  it('blocks DNS names resolving to a private address, including mixed answers', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    await expect(publicAddresses('jobs.example.com')).rejects.toThrow('Non-public');
    await expect(fetchPosting('https://jobs.example.com')).rejects.toThrow('Non-public');
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('revalidates redirects before making the next request', async () => {
    response(302, { location: 'http://[::ffff:127.0.0.1]/' });
    await expect(fetchPosting('https://jobs.example.com')).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('pins the connection to the validated address rather than resolving again', async () => {
    response(200, { 'content-type': 'text/html' }, ['<h1>Job</h1>']);
    expect(await fetchPosting('https://jobs.example.com')).toMatchObject({ status: 200, html: '<h1>Job</h1>' });
    const callback = vi.fn();
    mocks.request.mock.calls[0][1].lookup('jobs.example.com', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it('caps bytes even when the final stream chunk exceeds the limit', async () => {
    response(200, { 'content-type': 'text/html' }, ['a'.repeat(300000), 'b'.repeat(300000)]);
    expect((await fetchPosting('https://jobs.example.com')).html.length).toBe(400000);
  });
});
