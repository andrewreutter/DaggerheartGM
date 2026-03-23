import { describe, it, expect } from 'vitest';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { Wings } from '../../../../src/features-v2/ancestries/Faerie.js';

const annotatedWings = { ...Wings, _ownerInstanceId: 'char-1' };

describe('Wings', () => {
  describe('card chip (flying toggle)', () => {
    it('has a card chip that is a toggle', () => {
      const table = mockTable();
      const chips = collectChips([annotatedWings], 'card', table);
      expect(chips).toHaveLength(1);
      expect(chips[0].isToggle).toBe(true);
      expect(chips[0].placements).toContain('card');
    });

    it('sets feature state flying=true when toggled on', () => {
      const table = mockTable({ _featureKey: 'Wings' });
      const chips = collectChips([annotatedWings], 'card', table);
      const chipState = mockChipState({ _isOn: false });
      const mutations = activateChip(chips[0], table, chipState);
      expect(mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: '_v2t:Wings::Wings::card', value: true }),
        })
      );
    });

    it('sets feature state flying=false when toggled off', () => {
      const table = mockTable({
        _featureKey: 'Wings',
        featureState: { Wings: { '_v2t:Wings::Wings::card': true } },
      });
      const chips = collectChips([annotatedWings], 'card', table);
      const chipState = mockChipState({ _isOn: true });
      const mutations = activateChip(chips[0], table, chipState);
      expect(mutations).toContainEqual(
        expect.objectContaining({
          type: 'setFeatureState',
          payload: expect.objectContaining({ key: '_v2t:Wings::Wings::card', value: false }),
        })
      );
    });
  });

  describe('review chip (evasion reaction)', () => {
    it('shows chip when targeted by attack while flying', () => {
      const result = runReviewAction(Wings, {
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        },
        featureState: {
          Wings: {
            '_v2t:Wings::Wings::card': true,
          },
        },
      });

      expect(result.chips).toHaveLength(1);
      expect(result.chips[0].name).toBe('Wings');
      expect(result.chips[0].stressCost).toBe(1);
    });

    it('does not show chip when not flying', () => {
      const result = runReviewAction(Wings, {
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        },
        featureState: {
          Wings: {
            '_v2t:Wings::Wings::card': false,
          },
        },
      });

      expect(result.chips).toHaveLength(0);
    });

    it('does not show chip when not targeted', () => {
      const result = runReviewAction(Wings, {
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-2'],
        },
        featureState: {
          Wings: {
            '_v2t:Wings::Wings::card': true,
          },
        },
      });

      expect(result.chips).toHaveLength(0);
    });

    it('queues a temporary stat mod when chip is used', () => {
      const table = mockTable({
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [],
        },
        featureState: { Wings: { '_v2t:Wings::Wings::card': true } },
        _featureKey: 'Wings',
      });
      const chips = collectChips([annotatedWings], 'reviewAction', table);
      expect(chips).toHaveLength(1);
      const mutations = activateChip(chips[0], table);
      expect(mutations).toContainEqual(
        expect.objectContaining({ type: 'addTemporaryStatMod', payload: expect.objectContaining({ instanceId: 'char-1', stat: 'evasion', value: 2 }) })
      );
    });
  });
});
