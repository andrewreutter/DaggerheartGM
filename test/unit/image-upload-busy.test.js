import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginImageUpload,
  endImageUpload,
  getImageUploadInflight,
  resetImageUploadBusyForTests,
  subscribeImageUploadBusy,
  withImageUploadBusy,
} from '../../src/client/lib/image-upload-busy.js';

afterEach(() => {
  resetImageUploadBusyForTests();
});

describe('image-upload-busy', () => {
  it('notifies subscribers when the first upload starts and the last upload ends', () => {
    const seen = [];
    const unsub = subscribeImageUploadBusy((busy) => seen.push(busy));
    expect(seen).toEqual([false]);

    beginImageUpload();
    beginImageUpload();
    expect(getImageUploadInflight()).toBe(2);
    expect(seen).toEqual([false, true, true]);

    endImageUpload();
    expect(seen).toEqual([false, true, true, true]);
    endImageUpload();
    expect(seen).toEqual([false, true, true, true, false]);
    expect(getImageUploadInflight()).toBe(0);

    unsub();
    beginImageUpload();
    expect(seen).toEqual([false, true, true, true, false]);
  });

  it('keeps the overlay busy across nested withImageUploadBusy calls', async () => {
    const seen = [];
    subscribeImageUploadBusy((busy) => seen.push(busy));

    await withImageUploadBusy(async () => {
      expect(getImageUploadInflight()).toBe(1);
      await withImageUploadBusy(async () => {
        expect(getImageUploadInflight()).toBe(2);
      });
      expect(getImageUploadInflight()).toBe(1);
    });

    expect(getImageUploadInflight()).toBe(0);
    expect(seen).toEqual([false, true, true, true, false]);
  });

  it('ends the busy count when the wrapped function rejects', async () => {
    await expect(withImageUploadBusy(async () => {
      throw new Error('upload failed');
    })).rejects.toThrow('upload failed');
    expect(getImageUploadInflight()).toBe(0);
  });

  it('does not go negative when end is called extra times', () => {
    const listener = vi.fn();
    subscribeImageUploadBusy(listener);
    endImageUpload();
    expect(getImageUploadInflight()).toBe(0);
    expect(listener).toHaveBeenLastCalledWith(false);
  });
});
