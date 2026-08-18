import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MIME_TO_EXT,
  parseDataUrl,
  uploadBufferToMapStorage,
  uploadDataUrlToMapStorageIfNeeded,
} from '../../src/server/map-storage.js';

describe('map-storage', () => {
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

  describe('parseDataUrl', () => {
    it('parses a base64 data URL into mimetype + buffer', () => {
      const parsed = parseDataUrl('data:image/png;base64,QUJD');
      expect(parsed).not.toBeNull();
      expect(parsed.mimetype).toBe('image/png');
      expect(parsed.buffer.toString()).toBe('ABC');
    });

    it('returns null for a plain https URL', () => {
      expect(parseDataUrl('https://example.com/map.png')).toBeNull();
    });

    it('returns null for non-string values', () => {
      expect(parseDataUrl(null)).toBeNull();
      expect(parseDataUrl(undefined)).toBeNull();
      expect(parseDataUrl(42)).toBeNull();
    });
  });

  describe('uploadBufferToMapStorage', () => {
    it('returns null when supabase is not configured', async () => {
      const url = await uploadBufferToMapStorage(null, 'gm-1', Buffer.from('x'), 'image/png', 'map-images');
      expect(url).toBeNull();
    });

    it('uploads to the whiteboard-assets bucket under {folder}/{ownerUid}/ and returns the public URL', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/x.png' } });
      const fromMock = vi.fn().mockReturnValue({ upload: uploadMock, getPublicUrl: getPublicUrlMock });
      const supabase = { storage: { from: fromMock } };

      const buffer = Buffer.from('fake-png-bytes');
      const url = await uploadBufferToMapStorage(supabase, 'gm-1', buffer, 'image/png', 'map-images');

      expect(url).toBe('https://cdn/x.png');
      expect(fromMock).toHaveBeenCalledWith('whiteboard-assets');
      const [storagePath, uploadedBuffer, opts] = uploadMock.mock.calls[0];
      expect(storagePath).toMatch(/^map-images\/gm-1\/[0-9a-f-]+\.png$/);
      expect(uploadedBuffer).toBe(buffer);
      expect(opts).toEqual({ contentType: 'image/png', upsert: false });
    });

    it('uses a stable fileName and upsert when replacing a table preview', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/preview.png' } });
      const fromMock = vi.fn().mockReturnValue({ upload: uploadMock, getPublicUrl: getPublicUrlMock });
      const supabase = { storage: { from: fromMock } };

      const url = await uploadBufferToMapStorage(
        supabase,
        'gm-1',
        Buffer.from('png'),
        'image/png',
        'table-previews',
        { fileName: 'tbl-1.png', upsert: true },
      );
      expect(url).toBe('https://cdn/preview.png');
      expect(uploadMock.mock.calls[0][0]).toBe('table-previews/gm-1/tbl-1.png');
      expect(uploadMock.mock.calls[0][2]).toEqual({ contentType: 'image/png', upsert: true });
    });

    it('picks the extension from MIME_TO_EXT and falls back to "bin"', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn/x' } }),
      });
      const supabase = { storage: { from: fromMock } };

      await uploadBufferToMapStorage(supabase, 'gm-1', Buffer.from('x'), 'image/webp', 'map-overlays');
      expect(uploadMock.mock.calls[0][0]).toMatch(/\.webp$/);

      await uploadBufferToMapStorage(supabase, 'gm-1', Buffer.from('x'), 'application/octet-stream', 'map-overlays');
      expect(uploadMock.mock.calls[1][0]).toMatch(/\.bin$/);

      expect(MIME_TO_EXT['image/jpeg']).toBe('jpg');
    });

    it('throws when the Storage upload reports an error', async () => {
      const supabase = {
        storage: {
          from: () => ({
            upload: vi.fn().mockResolvedValue({ error: new Error('bucket full') }),
            getPublicUrl: vi.fn(),
          }),
        },
      };
      await expect(
        uploadBufferToMapStorage(supabase, 'gm-1', Buffer.from('x'), 'image/png', 'map-images'),
      ).rejects.toThrow('bucket full');
    });
  });

  describe('uploadDataUrlToMapStorageIfNeeded', () => {
    it('passes through non-data-URL values unchanged (already a URL, null, undefined)', async () => {
      const supabase = { storage: { from: vi.fn() } };
      await expect(uploadDataUrlToMapStorageIfNeeded(supabase, 'gm-1', 'https://cdn/existing.png', 'map-images')).resolves.toBe(
        'https://cdn/existing.png',
      );
      await expect(uploadDataUrlToMapStorageIfNeeded(supabase, 'gm-1', null, 'map-images')).resolves.toBeNull();
      await expect(uploadDataUrlToMapStorageIfNeeded(supabase, 'gm-1', undefined, 'map-images')).resolves.toBeUndefined();
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });

    it('uploads an inline data URL and returns the Storage URL', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn/uploaded.png' } }),
      });
      const supabase = { storage: { from: fromMock } };

      const dataUrl = 'data:image/png;base64,QUJD';
      const result = await uploadDataUrlToMapStorageIfNeeded(supabase, 'gm-1', dataUrl, 'map-images');

      expect(result).toBe('https://cdn/uploaded.png');
      expect(fromMock).toHaveBeenCalledWith('whiteboard-assets');
      expect(uploadMock.mock.calls[0][0]).toMatch(/^map-images\/gm-1\//);
    });

    it('falls back to the original data URL and warns when supabase is not configured', async () => {
      const dataUrl = 'data:image/png;base64,QUJD';
      const result = await uploadDataUrlToMapStorageIfNeeded(null, 'gm-1', dataUrl, 'map-images');
      expect(result).toBe(dataUrl);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/Supabase not configured/);
    });

    it('falls back to the original data URL and logs an error when the upload fails', async () => {
      const supabase = {
        storage: {
          from: () => ({
            upload: vi.fn().mockResolvedValue({ error: new Error('network down') }),
            getPublicUrl: vi.fn(),
          }),
        },
      };
      const dataUrl = 'data:image/png;base64,QUJD';
      const result = await uploadDataUrlToMapStorageIfNeeded(supabase, 'gm-1', dataUrl, 'map-images');
      expect(result).toBe(dataUrl);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
