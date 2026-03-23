import { describe, it, expect } from 'vitest';
import {
  inferAffectedPartiesFromV2Mutations,
  resolveCanonicalInstanceId,
} from '../../src/client/lib/v2-mutation-affected-parties.js';
import { mockCharacter } from './features-v2/helpers.js';

describe('resolveCanonicalInstanceId', () => {
  it('matches instanceId or library id', () => {
    const c = mockCharacter({ instanceId: 'pc-1', id: 'lib-char-9' });
    const els = [c];
    expect(resolveCanonicalInstanceId('pc-1', els)).toBe('pc-1');
    expect(resolveCanonicalInstanceId('lib-char-9', els)).toBe('pc-1');
  });
});

describe('inferAffectedPartiesFromV2Mutations', () => {
  it('groups clearStress by amount: different totals become separate phrases', () => {
    const bard = mockCharacter({ instanceId: 'b1', name: 'Ria' });
    const allyA = mockCharacter({ instanceId: 'a1', name: 'Milo', currentStress: 2 });
    const allyB = mockCharacter({ instanceId: 'a2', name: 'Zed', currentStress: 1 });
    const els = [bard, allyA, allyB];
    const mutations = [
      { type: 'spendHope', payload: { instanceId: 'b1', amount: 2 } },
      { type: 'clearStress', payload: { instanceId: 'a1', amount: 2 } },
      { type: 'clearStress', payload: { instanceId: 'a2', amount: 1 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'b1', els);
    expect(out.otherPartyIds.sort()).toEqual(['a1', 'a2']);
    expect(out.otherPartyNames).toEqual(['Milo', 'Zed']);
    expect(out.affectedSummary).toBe(
      'Also affected: cleared 1 Stress each from Zed; cleared 2 Stress each from Milo'
    );
  });

  it('groups same clearHP amount as "N HP each" across multiple allies', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Leader' });
    const v1 = mockCharacter({ instanceId: 'v1', name: 'Vodalus', currentHp: 4, maxHp: 6 });
    const v2 = mockCharacter({ instanceId: 'v2', name: 'Vivius', currentHp: 4, maxHp: 6 });
    const els = [owner, v1, v2];
    const mutations = [
      { type: 'clearHP', payload: { instanceId: 'v1', amount: 2 } },
      { type: 'clearHP', payload: { instanceId: 'v2', amount: 2 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.affectedSummary).toBe('Also affected: 2 HP each to Vivius and Vodalus');
  });

  it('splits clearHP when amounts differ per target', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Leader' });
    const v1 = mockCharacter({ instanceId: 'v1', name: 'Vodalus', currentHp: 4, maxHp: 6 });
    const v2 = mockCharacter({ instanceId: 'v2', name: 'Vivius', currentHp: 3, maxHp: 6 });
    const els = [owner, v1, v2];
    const mutations = [
      { type: 'clearHP', payload: { instanceId: 'v1', amount: 2 } },
      { type: 'clearHP', payload: { instanceId: 'v2', amount: 3 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.affectedSummary).toBe(
      'Also affected: 2 HP each to Vodalus; 3 HP each to Vivius'
    );
  });

  it('returns empty others when only the owner is mutated', () => {
    const pc = mockCharacter({ instanceId: 'o1', name: 'Solo' });
    const els = [pc];
    const mutations = [
      { type: 'markStress', payload: { instanceId: 'o1', amount: 1 } },
      { type: 'spendHope', payload: { instanceId: 'o1', amount: 1 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.otherPartyIds).toEqual([]);
    expect(out.otherPartyNames).toEqual([]);
    expect(out.affectedSummary).toBe('');
  });

  it('merges multiple clearStress on the same ally into one total', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Lead' });
    const ally = mockCharacter({ instanceId: 'x1', name: 'Friend', currentStress: 2 });
    const els = [owner, ally];
    const mutations = [
      { type: 'clearStress', payload: { instanceId: 'x1', amount: 1 } },
      { type: 'clearStress', payload: { instanceId: 'x1', amount: 1 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.otherPartyIds).toEqual(['x1']);
    expect(out.otherPartyNames).toEqual(['Friend']);
    expect(out.affectedSummary).toBe('Also affected: cleared 2 Stress each from Friend');
  });

  it('uses applied clearStress amount when request exceeds marked stress', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Lead' });
    const ally = mockCharacter({ instanceId: 'x1', name: 'Friend', currentStress: 1 });
    const els = [owner, ally];
    const mutations = [{ type: 'clearStress', payload: { instanceId: 'x1', amount: 2 } }];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.affectedSummary).toBe('Also affected: cleared 1 Stress each from Friend');
  });

  it('ignores adversary markHP and runtimeStatMod difficulty', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Hero' });
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', maxHp: 10, currentHp: 10 };
    const els = [owner, adv];
    const mutations = [
      { type: 'markHP', payload: { instanceId: 'adv1', amount: 2 } },
      { type: 'runtimeStatMod', payload: { instanceId: 'adv1', stat: 'difficulty', delta: 1 } },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.otherPartyIds).toEqual([]);
    expect(out.affectedSummary).toBe('');
  });

  it('ignores setFeatureState and actionLoop rows', () => {
    const owner = mockCharacter({ instanceId: 'o1', name: 'Hero' });
    const ally = mockCharacter({ instanceId: 'a1', name: 'Ally' });
    const els = [owner, ally];
    const mutations = [
      { type: 'setFeatureState', payload: { featureKey: 'Rally', key: 'partyDice', value: {} } },
      {
        type: 'actionLoop',
        payload: { instanceId: 'o1', title: 'X', description: 'Y' },
      },
    ];
    const out = inferAffectedPartiesFromV2Mutations(mutations, 'o1', els);
    expect(out.otherPartyIds).toEqual([]);
  });
});
