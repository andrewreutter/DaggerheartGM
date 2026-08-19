import { describe, it, expect } from 'vitest';
import {
  buildV2ReviewChipBannerPatch,
  resolveBannerActionDominant,
  consumedActivationKeysFromBanner,
  extractActionRollOutcomeFromDisplayMutations,
} from '../../src/client/lib/v2-banner-review-meta.js';
import { partitionV2BannerChipMutations } from '../../src/client/lib/table-ops.js';
import { applyMutations } from '../../src/features-v2/engine/table.js';
import { runReviewAction, mockTable, mockChipState, mockCharacter, mockAdversary } from './features-v2/helpers.js';
import { Fearless } from '../../src/features-v2/ancestries/Infernis.js';
import { MidnightTouched } from '../../src/features-v2/abilities/Midnight/MidnightTouched.js';
import { StealthExpertise } from '../../src/features-v2/abilities/Midnight/StealthExpertise.js';

// ---------------------------------------------------------------------------
// buildV2ReviewChipBannerPatch
// ---------------------------------------------------------------------------
describe('buildV2ReviewChipBannerPatch', () => {
  it('returns empty patch when no opts supplied', () => {
    expect(buildV2ReviewChipBannerPatch({}, {})).toEqual({});
    expect(buildV2ReviewChipBannerPatch(null, {})).toEqual({});
    expect(buildV2ReviewChipBannerPatch(undefined, undefined)).toEqual({});
  });

  it('sets _v2ActionRollOutcome for valid outcomes', () => {
    expect(buildV2ReviewChipBannerPatch({}, { outcome: 'hope' })).toEqual({
      _v2ActionRollOutcome: 'hope',
    });
    expect(buildV2ReviewChipBannerPatch({}, { outcome: 'fear' })).toEqual({
      _v2ActionRollOutcome: 'fear',
    });
  });

  it('ignores invalid outcomes', () => {
    expect(buildV2ReviewChipBannerPatch({}, { outcome: 'critical' })).toEqual({});
    expect(buildV2ReviewChipBannerPatch({}, { outcome: '' })).toEqual({});
    expect(buildV2ReviewChipBannerPatch({}, { outcome: null })).toEqual({});
  });

  it('last-write-wins for outcome (replaces previous value)', () => {
    const existing = { _v2ActionRollOutcome: 'fear' };
    const patch = buildV2ReviewChipBannerPatch(existing, { outcome: 'hope' });
    expect(patch._v2ActionRollOutcome).toBe('hope');
  });

  it('adds consumedActivationKey to empty array', () => {
    const patch = buildV2ReviewChipBannerPatch({}, { consumedActivationKey: 'pc-1::Fearless::reviewAction' });
    expect(patch._v2ReviewChipsConsumed).toEqual(['pc-1::Fearless::reviewAction']);
  });

  it('appends consumedActivationKey to existing array', () => {
    const existing = { _v2ReviewChipsConsumed: ['pc-1::Fearless::reviewAction'] };
    const patch = buildV2ReviewChipBannerPatch(existing, { consumedActivationKey: 'pc-2::Stealth::reviewAction' });
    expect(patch._v2ReviewChipsConsumed).toEqual([
      'pc-1::Fearless::reviewAction',
      'pc-2::Stealth::reviewAction',
    ]);
  });

  it('does not duplicate consumedActivationKey', () => {
    const existing = { _v2ReviewChipsConsumed: ['pc-1::Fearless::reviewAction'] };
    const patch = buildV2ReviewChipBannerPatch(existing, { consumedActivationKey: 'pc-1::Fearless::reviewAction' });
    // No change — patch should be empty for consumed keys
    expect(patch._v2ReviewChipsConsumed).toBeUndefined();
  });

  it('can set both outcome and consumedActivationKey in one call', () => {
    const patch = buildV2ReviewChipBannerPatch({}, {
      outcome: 'hope',
      consumedActivationKey: 'pc-1::Fearless::reviewAction',
    });
    expect(patch._v2ActionRollOutcome).toBe('hope');
    expect(patch._v2ReviewChipsConsumed).toEqual(['pc-1::Fearless::reviewAction']);
  });
});

// ---------------------------------------------------------------------------
// resolveBannerActionDominant
// ---------------------------------------------------------------------------
describe('resolveBannerActionDominant', () => {
  it('returns undefined for null roll', () => {
    expect(resolveBannerActionDominant(null)).toBeUndefined();
    expect(resolveBannerActionDominant(undefined)).toBeUndefined();
  });

  it('falls back to roll.dominant when no override', () => {
    expect(resolveBannerActionDominant({ dominant: 'fear' })).toBe('fear');
    expect(resolveBannerActionDominant({ dominant: 'hope' })).toBe('hope');
    expect(resolveBannerActionDominant({ dominant: 'critical' })).toBe('critical');
  });

  it('returns the override outcome when set', () => {
    expect(resolveBannerActionDominant({ dominant: 'fear', _v2ActionRollOutcome: 'hope' })).toBe('hope');
    expect(resolveBannerActionDominant({ dominant: 'hope', _v2ActionRollOutcome: 'fear' })).toBe('fear');
  });

  it('preserves "critical" when override is "hope" (a crit is still a crit)', () => {
    const roll = { dominant: 'critical', _v2ActionRollOutcome: 'hope' };
    expect(resolveBannerActionDominant(roll)).toBe('critical');
  });

  it('downgrades "critical" to "fear" when override is "fear"', () => {
    // An explicit fear override from a feature overrides even a critical
    const roll = { dominant: 'critical', _v2ActionRollOutcome: 'fear' };
    expect(resolveBannerActionDominant(roll)).toBe('fear');
  });

  it('ignores invalid _v2ActionRollOutcome values', () => {
    const roll = { dominant: 'fear', _v2ActionRollOutcome: 'bogus' };
    expect(resolveBannerActionDominant(roll)).toBe('fear');
  });
});

// ---------------------------------------------------------------------------
// consumedActivationKeysFromBanner
// ---------------------------------------------------------------------------
describe('consumedActivationKeysFromBanner', () => {
  it('returns empty Set for null/missing roll', () => {
    expect(consumedActivationKeysFromBanner(null).size).toBe(0);
    expect(consumedActivationKeysFromBanner({}).size).toBe(0);
    expect(consumedActivationKeysFromBanner({ _v2ReviewChipsConsumed: [] }).size).toBe(0);
  });

  it('returns Set of consumed keys from the banner field', () => {
    const roll = { _v2ReviewChipsConsumed: ['pc-1::Fearless::reviewAction', 'pc-2::Stealth::reviewAction'] };
    const s = consumedActivationKeysFromBanner(roll);
    expect(s.has('pc-1::Fearless::reviewAction')).toBe(true);
    expect(s.has('pc-2::Stealth::reviewAction')).toBe(true);
    expect(s.size).toBe(2);
  });

  it('filters out non-string entries', () => {
    const roll = { _v2ReviewChipsConsumed: ['valid-key', null, 42, '', 'another-key'] };
    const s = consumedActivationKeysFromBanner(roll);
    expect(s.size).toBe(2);
    expect(s.has('valid-key')).toBe(true);
    expect(s.has('another-key')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractActionRollOutcomeFromDisplayMutations
// ---------------------------------------------------------------------------
describe('extractActionRollOutcomeFromDisplayMutations', () => {
  it('returns null for empty/null input', () => {
    expect(extractActionRollOutcomeFromDisplayMutations(null)).toBeNull();
    expect(extractActionRollOutcomeFromDisplayMutations([])).toBeNull();
    expect(extractActionRollOutcomeFromDisplayMutations(undefined)).toBeNull();
  });

  it('extracts "hope" from a setRollOutcome(action) mutation', () => {
    const muts = [{ type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'hope' } }];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBe('hope');
  });

  it('extracts "fear" from a setRollOutcome(action) mutation', () => {
    const muts = [{ type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'fear' } }];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBe('fear');
  });

  it('ignores non-action rollKey', () => {
    const muts = [{ type: 'setRollOutcome', payload: { rollKey: 'damage', outcome: 'hope' } }];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBeNull();
  });

  it('ignores invalid outcome values', () => {
    const muts = [{ type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'critical' } }];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBeNull();
  });

  it('returns null for other mutation types', () => {
    const muts = [{ type: 'setDie', payload: { rollKey: 'action', outcome: 'hope' } }];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBeNull();
  });

  it('returns the first matching mutation', () => {
    const muts = [
      { type: 'addNarration', payload: {} },
      { type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'hope' } },
      { type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'fear' } },
    ];
    expect(extractActionRollOutcomeFromDisplayMutations(muts)).toBe('hope');
  });
});

// ---------------------------------------------------------------------------
// Sibling feature pipeline verification
// Confirms Fearless, Midnight-Touched, and Stealth Expertise all produce
// setRollOutcome in engineRollDisplayOnly, and that the patch builder
// correctly converts that to _v2ActionRollOutcome — with no changes needed
// in any feature module.
// ---------------------------------------------------------------------------

const FEAR_DOMINANT_ROLL_OVERRIDES = {
  rolls: {
    action: {
      fearDie: { value: 8 },
      hopeDie: { value: 4 },
      dice: [],
      statics: [],
      isSuccess: true,
    },
  },
};

/**
 * Use runReviewAction to collect chips through the engine (condition-filtered),
 * then run the first chip's onUse, partition mutations, and build the banner patch.
 * chipIndex selects which collected chip to use (default 0).
 */
function runChipOnUsePipeline(feature, tableOverrides = {}, chipIndex = 0) {
  const mergedOverrides = { ...FEAR_DOMINANT_ROLL_OVERRIDES, ...tableOverrides };
  const result = runReviewAction(feature, mergedOverrides);
  const chip = result.chips[chipIndex];
  if (!chip) {
    throw new Error(
      `No chip at index ${chipIndex} for ${feature.name}; got ${result.chips.length} chips. Did conditions pass?`
    );
  }
  const table = mockTable(mergedOverrides);
  chip.onUse(table, mockChipState());
  const mutations = applyMutations(table);
  const { engineRollDisplayOnly } = partitionV2BannerChipMutations(mutations);
  const outcome = extractActionRollOutcomeFromDisplayMutations(engineRollDisplayOnly);
  const patch = buildV2ReviewChipBannerPatch({}, { outcome });
  return { chips: result.chips, mutations, engineRollDisplayOnly, outcome, patch };
}

describe('setOutcome siblings — full pipeline (feature → mutation → partition → patch)', () => {
  describe('Fearless (Infernis)', () => {
    it('setOutcome("hope") lands in engineRollDisplayOnly after partitioning', () => {
      const { engineRollDisplayOnly } = runChipOnUsePipeline(Fearless);
      expect(engineRollDisplayOnly).toContainEqual(
        expect.objectContaining({
          type: 'setRollOutcome',
          payload: { rollKey: 'action', outcome: 'hope' },
        })
      );
    });

    it('patch builder produces _v2ActionRollOutcome: "hope"', () => {
      const { patch } = runChipOnUsePipeline(Fearless);
      expect(patch._v2ActionRollOutcome).toBe('hope');
    });
  });

  describe('Midnight-Touched (Hope instead of GM Fear chip)', () => {
    // Midnight-Touched requires: isActing (char-1 is actor), ≥4 Midnight domain cards,
    // me.hope === 0, and fearDie > hopeDie. We satisfy the last two via FEAR_DOMINANT_ROLL_OVERRIDES
    // and hope:0. The domainLoadout check requires a properly constructed character element.
    const midnightChar = mockCharacter({
      instanceId: 'char-1',
      hope: 0,
      maxHope: 6,
      domainLoadout: [
        { domain: 'midnight' },
        { domain: 'midnight' },
        { domain: 'midnight' },
        { domain: 'midnight' },
      ],
    });
    const midnightOverrides = {
      activeElements: [midnightChar, mockAdversary()],
    };

    it('setOutcome("hope") lands in engineRollDisplayOnly', () => {
      const { engineRollDisplayOnly } = runChipOnUsePipeline(MidnightTouched, midnightOverrides);
      expect(engineRollDisplayOnly).toContainEqual(
        expect.objectContaining({
          type: 'setRollOutcome',
          payload: { rollKey: 'action', outcome: 'hope' },
        })
      );
    });

    it('patch builder produces _v2ActionRollOutcome: "hope"', () => {
      const { patch } = runChipOnUsePipeline(MidnightTouched, midnightOverrides);
      expect(patch._v2ActionRollOutcome).toBe('hope');
    });
  });

  describe('Stealth Expertise (self chip)', () => {
    it('setOutcome("hope") lands in engineRollDisplayOnly', () => {
      const { engineRollDisplayOnly } = runChipOnUsePipeline(StealthExpertise);
      expect(engineRollDisplayOnly).toContainEqual(
        expect.objectContaining({
          type: 'setRollOutcome',
          payload: { rollKey: 'action', outcome: 'hope' },
        })
      );
    });

    it('patch builder produces _v2ActionRollOutcome: "hope"', () => {
      const { patch } = runChipOnUsePipeline(StealthExpertise);
      expect(patch._v2ActionRollOutcome).toBe('hope');
    });
  });

  describe('Stealth Expertise — Ally chip (showOnOtherSheets, cross-sheet)', () => {
    // The Ally chip calls setOutcome on the roll — the roll belongs to the actor,
    // not the Stealth Expertise owner. The mutation type is roll-scoped regardless
    // of who clicked the chip, so the banner patch targets _rollDbId correctly.
    // when() stores the raw chip spec in ._value. We call onUse directly on the spec to
    // verify the mutation pipeline without needing to satisfy the complex range-check condition.
    it('setOutcome("hope") mutation is produced when onUse is called (._value access)', () => {
      const allyChipSpec = StealthExpertise.chips[1]._value;
      expect(typeof allyChipSpec?.onUse).toBe('function');

      const table = mockTable(FEAR_DOMINANT_ROLL_OVERRIDES);
      allyChipSpec.onUse(table, mockChipState());
      const mutations = applyMutations(table);
      const { engineRollDisplayOnly } = partitionV2BannerChipMutations(mutations);
      const outcome = extractActionRollOutcomeFromDisplayMutations(engineRollDisplayOnly);
      expect(outcome).toBe('hope');
    });

    it('patch builder produces _v2ActionRollOutcome: "hope" for the Ally chip', () => {
      const allyChipSpec = StealthExpertise.chips[1]._value;
      const table = mockTable(FEAR_DOMINANT_ROLL_OVERRIDES);
      allyChipSpec.onUse(table, mockChipState());
      const mutations = applyMutations(table);
      const { engineRollDisplayOnly } = partitionV2BannerChipMutations(mutations);
      const outcome = extractActionRollOutcomeFromDisplayMutations(engineRollDisplayOnly);
      const patch = buildV2ReviewChipBannerPatch({}, { outcome });
      expect(patch._v2ActionRollOutcome).toBe('hope');
    });
  });
});
