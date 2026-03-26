import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postDebugLog, DEBUG_LOG_DEFAULT_INGEST } from '../../src/client/lib/debug-log.js';

describe('debug-log', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('postDebugLog POSTs to /api/debug-log with _debugUrl and payload', () => {
    postDebugLog({ location: 't.js:1', message: 'x', _debugSessionId: 'abc' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/debug-log',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body._debugUrl).toBe(DEBUG_LOG_DEFAULT_INGEST);
    expect(body.location).toBe('t.js:1');
    expect(body._debugSessionId).toBe('abc');
  });
});
