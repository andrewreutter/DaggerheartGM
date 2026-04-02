import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateImage, editImage, isConfigured } from '../../src/xai-image.js';

describe('xai-image', () => {
  const origFetch = globalThis.fetch;
  let origKey;
  let origBase;
  let origModel;
  let origAspect;
  let origRes;

  beforeEach(() => {
    origKey = process.env.XAI_API_KEY;
    origBase = process.env.XAI_API_BASE;
    origModel = process.env.XAI_IMAGE_MODEL;
    origAspect = process.env.XAI_IMAGE_ASPECT_RATIO;
    origRes = process.env.XAI_IMAGE_RESOLUTION;
    process.env.XAI_API_KEY = 'test-key';
    process.env.XAI_API_BASE = 'https://api.x.ai/v1';
    delete process.env.XAI_IMAGE_MODEL;
    delete process.env.XAI_IMAGE_ASPECT_RATIO;
    delete process.env.XAI_IMAGE_RESOLUTION;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = origKey;
    if (origBase === undefined) delete process.env.XAI_API_BASE;
    else process.env.XAI_API_BASE = origBase;
    if (origModel === undefined) delete process.env.XAI_IMAGE_MODEL;
    else process.env.XAI_IMAGE_MODEL = origModel;
    if (origAspect === undefined) delete process.env.XAI_IMAGE_ASPECT_RATIO;
    else process.env.XAI_IMAGE_ASPECT_RATIO = origAspect;
    if (origRes === undefined) delete process.env.XAI_IMAGE_RESOLUTION;
    else process.env.XAI_IMAGE_RESOLUTION = origRes;
    vi.restoreAllMocks();
  });

  it('isConfigured is false without XAI_API_KEY', () => {
    delete process.env.XAI_API_KEY;
    expect(isConfigured()).toBe(false);
  });

  it('isConfigured is true when XAI_API_KEY is set', () => {
    expect(isConfigured()).toBe(true);
  });

  it('generateImage POSTs /images/generations and returns a data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'Zm9v', mime_type: 'image/png' }],
      }),
    });
    globalThis.fetch = fetchMock;

    const out = await generateImage('a castle');
    expect(out.imageUrl).toBe('data:image/png;base64,Zm9v');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.ai/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('grok-imagine-image');
    expect(body.prompt).toBe('a castle');
    expect(body.response_format).toBe('b64_json');
  });

  it('generateImage forwards optional aspect_ratio and resolution from env', async () => {
    process.env.XAI_IMAGE_ASPECT_RATIO = '16:9';
    process.env.XAI_IMAGE_RESOLUTION = '2k';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'eA==', mime_type: 'image/webp' }],
      }),
    });
    globalThis.fetch = fetchMock;

    await generateImage('x');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.aspect_ratio).toBe('16:9');
    expect(body.resolution).toBe('2k');
  });

  it('generateImage throws with API error detail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'bad key' } }),
    });

    await expect(generateImage('p')).rejects.toThrow(/401/);
    await expect(generateImage('p')).rejects.toThrow(/bad key/);
  });

  it('editImage POSTs /images/edits with data URI in image.url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'YmFy', mime_type: 'image/jpeg' }],
      }),
    });
    globalThis.fetch = fetchMock;

    const dataUrl = 'data:image/png;base64,QUJD';
    const out = await editImage(dataUrl, 'make darker');
    expect(out.imageUrl).toBe('data:image/jpeg;base64,YmFy');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.ai/v1/images/edits',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.image.url).toBe(dataUrl);
    expect(body.image.type).toBe('image_url');
    expect(body.prompt).toBe('make darker');
    expect(body.response_format).toBe('b64_json');
  });
});
