import { describe, it, expect } from 'vitest';
import {
  isAttackRollMeta,
  requiresGmFinalizedDifficulty,
  resolveFinalizedIntentDifficulty,
} from '../../src/client/lib/action-roll-difficulty.js';

describe('action-roll-difficulty', () => {
  describe('isAttackRollMeta', () => {
    it('detects weapon attacks via _weaponRangeFt', () => {
      expect(isAttackRollMeta({ _weaponRangeFt: 30 })).toBe(true);
    });

    it('detects feature-with-target attacks via _featureNeedsTarget', () => {
      expect(isAttackRollMeta({ _featureNeedsTarget: true })).toBe(true);
    });

    it('is false for a plain trait/spellcast roll', () => {
      expect(isAttackRollMeta({ _traitKey: 'instinct' })).toBe(false);
      expect(isAttackRollMeta({})).toBe(false);
    });
  });

  describe('requiresGmFinalizedDifficulty', () => {
    it('is true for a player action roll that is not an attack or reaction', () => {
      expect(requiresGmFinalizedDifficulty({ _intentPanelForActionRoll: true })).toBe(true);
    });

    it('excludes rolls that never opened the intent panel', () => {
      expect(requiresGmFinalizedDifficulty({})).toBe(false);
      expect(requiresGmFinalizedDifficulty({ _traitKey: 'instinct' })).toBe(false);
    });

    it('excludes attack rolls even when the intent panel flag is set', () => {
      expect(requiresGmFinalizedDifficulty({ _intentPanelForActionRoll: true, _weaponRangeFt: 30 })).toBe(false);
      expect(requiresGmFinalizedDifficulty({ _intentPanelForActionRoll: true, _featureNeedsTarget: true })).toBe(false);
    });

    it('excludes GM-called reaction rolls', () => {
      expect(requiresGmFinalizedDifficulty({ _intentPanelForActionRoll: true, _reactionCallRollDbId: 42 })).toBe(false);
    });
  });

  describe('resolveFinalizedIntentDifficulty', () => {
    const banner = { requiresGmDifficulty: true, intentId: 'abc-123' };

    it('returns null when the banner does not require GM difficulty', () => {
      expect(resolveFinalizedIntentDifficulty({ requiresGmDifficulty: false, intentId: 'abc-123' }, { intentId: 'abc-123', difficultyFinalized: true, difficulty: 15 })).toBeNull();
    });

    it('returns null when there is no intent update yet', () => {
      expect(resolveFinalizedIntentDifficulty(banner, null)).toBeNull();
    });

    it('returns null when the intent update is for a different intentId', () => {
      expect(resolveFinalizedIntentDifficulty(banner, { intentId: 'other', difficultyFinalized: true, difficulty: 15 })).toBeNull();
    });

    it('returns null when the matching intent has not been finalized yet', () => {
      expect(resolveFinalizedIntentDifficulty(banner, { intentId: 'abc-123', difficultyFinalized: false, difficulty: 15 })).toBeNull();
    });

    it('returns the finalized difficulty when intentId matches and it is finalized', () => {
      expect(resolveFinalizedIntentDifficulty(banner, { intentId: 'abc-123', difficultyFinalized: true, difficulty: 20 })).toBe(20);
    });

    it('returns null when the finalized difficulty is not a finite number', () => {
      expect(resolveFinalizedIntentDifficulty(banner, { intentId: 'abc-123', difficultyFinalized: true, difficulty: 'nope' })).toBeNull();
    });
  });
});
