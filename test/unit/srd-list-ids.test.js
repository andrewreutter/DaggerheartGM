import { describe, it, expect } from 'vitest';
import { makeSrdListId, slugifySrdListName } from '../../src/srd/srd-list-ids.js';

describe('makeSrdListId', () => {
  it('matches SRD list slug for apostrophe names (registry id can differ)', () => {
    expect(makeSrdListId('abilities', "A Soldier's Bond")).toBe('srd-abl-a-soldier-s-bond');
    expect(slugifySrdListName("A Soldier's Bond")).toBe('a-soldier-s-bond');
  });
});
