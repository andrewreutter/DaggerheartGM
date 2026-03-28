import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/client/lib/page-layout-load.js', () => ({
  cropLayoutRegionToPngDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,QUJDRA=='),
  cropLayoutRegionToPngBlob: vi.fn(),
}));

vi.mock('../../src/client/lib/api.js', () => ({
  getAuthToken: vi.fn().mockResolvedValue('t'),
  postEncounterParseText: vi.fn().mockResolvedValue({
    item: {
      id: 'parsed-1',
      name: 'Parsed',
      tier: 2,
      role: 'standard',
      imageUrl: 'https://should-strip.example/x.png',
    },
  }),
}));

import {
  buildDraftForImportSlice,
  resolveAttachPrimary,
} from '../../src/client/lib/unified-import-resolve.js';
import { postEncounterParseText } from '../../src/client/lib/api.js';

describe('resolveAttachPrimary', () => {
  it('returns the target row for attach slices', () => {
    const text = { id: 'txt:a', imageTarget: 'library' };
    const attach = { id: 'img:b', imageTarget: 'attach', attachToSliceId: 'txt:a' };
    expect(resolveAttachPrimary(attach, [text, attach])).toBe(text);
  });
});

describe('buildDraftForImportSlice — default Note + hotwords', () => {
  it('text asset: adversary hotwords route to adversary parse (not forced note)', async () => {
    vi.mocked(postEncounterParseText).mockClear();
    const row = {
      source: 'text',
      textBody: 'HP 10\nAttack +3\nThresholds Major 4 / Severe 7',
      libraryCollection: 'notes',
      userPickedSliceTarget: false,
      imageTarget: 'library',
    };
    const res = await buildDraftForImportSlice(row, []);
    expect(postEncounterParseText).toHaveBeenCalledWith(expect.stringContaining('HP'), 'adversary');
    expect(res.draftCollection).toBe('adversaries');
  });

  it('text asset: no stat signals keeps note parse', async () => {
    vi.mocked(postEncounterParseText).mockClear();
    const row = {
      source: 'text',
      textBody: 'Reminders for next session: buy snacks.',
      libraryCollection: 'notes',
      userPickedSliceTarget: false,
      imageTarget: 'library',
    };
    await buildDraftForImportSlice(row, []);
    expect(postEncounterParseText).toHaveBeenCalledWith(
      expect.stringContaining('Reminders'),
      'note',
    );
  });

  it('text asset: user picked Note in dropdown — ignore adversary hotwords', async () => {
    vi.mocked(postEncounterParseText).mockClear();
    const row = {
      source: 'text',
      textBody: 'HP 10\nAttack +3',
      libraryCollection: 'notes',
      userPickedSliceTarget: true,
      imageTarget: 'library',
    };
    await buildDraftForImportSlice(row, []);
    expect(postEncounterParseText).toHaveBeenCalledWith(expect.stringContaining('HP'), 'note');
  });

  it('image slice set to Note + OCR: environment hotwords use environment parse', async () => {
    vi.mocked(postEncounterParseText).mockClear();
    const row = {
      source: 'image',
      imageTarget: 'library',
      libraryCollection: 'notes',
      preferTextForParse: true,
      ocrHasText: true,
      ocrText: 'The Haunted Mill\nImpulses\nPotential Adversaries: spirits',
      ocrPending: false,
      userPickedSliceTarget: false,
      layout: { width: 100, height: 100, dataUrl: 'data:image/png;base64,AA' },
      rect: { x0: 0, y0: 0, x1: 50, y1: 50 },
    };
    const res = await buildDraftForImportSlice(row, []);
    expect(postEncounterParseText).toHaveBeenCalledWith(expect.stringContaining('Impulses'), 'environment');
    expect(res.draftCollection).toBe('environments');
  });
});

describe('buildDraftForImportSlice — text-as-OCR', () => {
  it('does not attach crop image to adversary when parsing from OCR text', async () => {
    const row = {
      source: 'image',
      imageTarget: 'library',
      libraryCollection: 'adversaries',
      preferTextForParse: true,
      ocrHasText: true,
      ocrText: 'Some stat block',
      ocrPending: false,
      layout: { width: 100, height: 100, dataUrl: 'data:image/png;base64,AA' },
      rect: { x0: 0, y0: 0, x1: 50, y1: 50 },
    };
    const res = await buildDraftForImportSlice(row, []);
    expect(res.draftCollection).toBe('adversaries');
    expect(res.draft?.imageUrl).toBeFalsy();
    expect(res.draft?.name).toBe('Parsed');
  });
});

describe('buildDraftForImportSlice — attach merge', () => {
  it('merges multiple attach crops into text adversary draft', async () => {
    const layout = { width: 10, height: 10, dataUrl: 'data:image/png;base64,AA' };
    const rect = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const textRow = {
      id: 'txt:1',
      source: 'text',
      structuralKey: 'txt|1',
      textBody: 'stat block',
      libraryCollection: 'adversaries',
      imageTarget: 'library',
      attachToSliceId: null,
    };
    const attach1 = {
      id: 'img:img1:r1',
      source: 'image',
      imageTarget: 'attach',
      attachToSliceId: 'txt:1',
      layout,
      rect,
      ocrPending: false,
    };
    const attach2 = { ...attach1, id: 'img:img1:r2' };
    const all = [textRow, attach1, attach2];
    const res = await buildDraftForImportSlice(textRow, all);
    expect(res.draft?.imageUrl).toBeTruthy();
    expect(res.draft?._additionalImages?.length).toBe(1);
  });

  it('attach slice resolves to the same draft as its primary', async () => {
    const layout = { width: 10, height: 10, dataUrl: 'data:image/png;base64,AA' };
    const rect = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const textRow = {
      id: 'txt:1',
      source: 'text',
      structuralKey: 'txt|1',
      textBody: 'stat block',
      libraryCollection: 'adversaries',
      imageTarget: 'library',
      attachToSliceId: null,
    };
    const attach1 = {
      id: 'img:a',
      source: 'image',
      imageTarget: 'attach',
      attachToSliceId: 'txt:1',
      layout,
      rect,
      ocrPending: false,
    };
    const all = [textRow, attach1];
    const primary = await buildDraftForImportSlice(textRow, all);
    const delegated = await buildDraftForImportSlice(attach1, all);
    expect(delegated.draftCollection).toBe(primary.draftCollection);
    expect(delegated.draft).toEqual(primary.draft);
  });
});
