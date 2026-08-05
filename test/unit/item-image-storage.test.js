import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeImageFields, sanitizeItemImageDataUrlsDeep } from '../../src/server/item-image-storage.js';

const DATA_URL = 'data:image/png;base64,QUJD';
const HOSTED_URL = 'https://cdn.example.com/item-images/uid/abc.png';

function makeMockSupabase(publicUrl = HOSTED_URL) {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl } });
  const fromMock = vi.fn().mockReturnValue({ upload: uploadMock, getPublicUrl: getPublicUrlMock });
  return { storage: { from: fromMock }, _fromMock: fromMock, _uploadMock: uploadMock };
}

describe('item-image-storage', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // sanitizeImageFields
  // ---------------------------------------------------------------------------
  describe('sanitizeImageFields', () => {
    it('uploads a data-URL imageUrl and returns the hosted URL', async () => {
      const supabase = makeMockSupabase();
      const result = await sanitizeImageFields(supabase, 'uid1', { imageUrl: DATA_URL });
      expect(result.imageUrl).toBe(HOSTED_URL);
      expect(supabase._fromMock).toHaveBeenCalledWith('whiteboard-assets');
      expect(supabase._uploadMock.mock.calls[0][0]).toMatch(/^item-images\/uid1\//);
    });

    it('uploads each data-URL entry in _additionalImages', async () => {
      const supabase = makeMockSupabase();
      const result = await sanitizeImageFields(supabase, 'uid1', {
        _additionalImages: [DATA_URL, DATA_URL],
      });
      expect(result._additionalImages).toHaveLength(2);
      expect(result._additionalImages[0]).toBe(HOSTED_URL);
      expect(result._additionalImages[1]).toBe(HOSTED_URL);
      expect(supabase._uploadMock).toHaveBeenCalledTimes(2);
    });

    it('passes through already-hosted imageUrl unchanged', async () => {
      const supabase = makeMockSupabase();
      const result = await sanitizeImageFields(supabase, 'uid1', { imageUrl: HOSTED_URL });
      expect(result.imageUrl).toBe(HOSTED_URL);
      expect(supabase._fromMock).not.toHaveBeenCalled();
    });

    it('falls back to the data URL and warns when supabase is null', async () => {
      const result = await sanitizeImageFields(null, 'uid1', { imageUrl: DATA_URL });
      expect(result.imageUrl).toBe(DATA_URL);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not include undefined keys when only one field is provided', async () => {
      const supabase = makeMockSupabase();
      const result = await sanitizeImageFields(supabase, 'uid1', { imageUrl: HOSTED_URL });
      expect('_additionalImages' in result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sanitizeItemImageDataUrlsDeep
  // ---------------------------------------------------------------------------
  describe('sanitizeItemImageDataUrlsDeep', () => {
    it('fast-paths when there are no data: URLs (supabase.storage.from never called)', async () => {
      const supabase = makeMockSupabase();
      const item = { name: 'Goblin', imageUrl: HOSTED_URL, _additionalImages: [HOSTED_URL] };
      const result = await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', item);
      expect(result).toBe(item);
      expect(supabase._fromMock).not.toHaveBeenCalled();
    });

    it('sanitizes top-level imageUrl', async () => {
      const supabase = makeMockSupabase();
      const item = { name: 'Goblin', imageUrl: DATA_URL };
      const result = await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', item);
      expect(result.imageUrl).toBe(HOSTED_URL);
      expect(result.name).toBe('Goblin');
    });

    it('sanitizes top-level _additionalImages entries', async () => {
      const supabase = makeMockSupabase();
      const item = { imageUrl: HOSTED_URL, _additionalImages: [DATA_URL, HOSTED_URL] };
      const result = await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', item);
      expect(result._additionalImages[0]).toBe(HOSTED_URL);
      expect(result._additionalImages[1]).toBe(HOSTED_URL);
      expect(supabase._uploadMock).toHaveBeenCalledTimes(1);
    });

    it('sanitizes nested scene shape: adversaries[].data.imageUrl', async () => {
      const supabase = makeMockSupabase();
      const item = {
        name: 'Forest Ambush',
        adversaries: [
          { adversaryId: 'srd-1', count: 2 },
          { data: { name: 'Wolf', imageUrl: DATA_URL }, count: 1 },
        ],
      };
      const result = await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', item);
      expect(result.adversaries[1].data.imageUrl).toBe(HOSTED_URL);
      expect(result.adversaries[0].adversaryId).toBe('srd-1');
    });

    it('fast-paths when value is a plain string without data: prefix', async () => {
      const supabase = makeMockSupabase();
      const result = await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', HOSTED_URL);
      expect(result).toBe(HOSTED_URL);
      expect(supabase._fromMock).not.toHaveBeenCalled();
    });

    it('returns null/undefined/primitive values unchanged', async () => {
      const supabase = makeMockSupabase();
      expect(await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', null)).toBeNull();
      expect(await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', undefined)).toBeUndefined();
      expect(await sanitizeItemImageDataUrlsDeep(supabase, 'uid1', 42)).toBe(42);
      expect(supabase._fromMock).not.toHaveBeenCalled();
    });

    it('falls back to the data URL and warns when supabase is null', async () => {
      const item = { imageUrl: DATA_URL };
      const result = await sanitizeItemImageDataUrlsDeep(null, 'uid1', item);
      expect(result.imageUrl).toBe(DATA_URL);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
