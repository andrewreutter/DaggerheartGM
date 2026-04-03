import { describe, it, expect } from 'vitest';
import {
  buildSessionStartBannerActionText,
  collectSessionStartHookLabels,
} from '../../src/client/lib/session-start-preview.js';

describe('collectSessionStartHookLabels', () => {
  it('returns empty when V2 data is missing', () => {
    expect(
      collectSessionStartHookLabels(
        [{ elementType: 'character', instanceId: 'a', name: 'Zed', activeFeatures: [{ type: 'class', name: 'Seraph' }] }],
        {
          v2Registry: null,
          srdData: null,
          v2ClassSubclassFeatureDescriptorsByName: {},
          getV2OriginFeatureDescriptor: () => undefined,
        }
      )
    ).toEqual([]);
  });
});

describe('buildSessionStartBannerActionText', () => {
  it('includes baseline bullets and hook placeholder', () => {
    const text = buildSessionStartBannerActionText([], {
      v2Registry: null,
      srdData: null,
      v2ClassSubclassFeatureDescriptorsByName: {},
      getV2OriginFeatureDescriptor: () => undefined,
    });
    expect(text).toContain('Nothing changes on the table until you press Acknowledge');
    expect(text).toContain('session-frequency');
    expect(text).toContain('No character session-start hooks');
  });
});
