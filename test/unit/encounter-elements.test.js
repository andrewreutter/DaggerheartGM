import { describe, it, expect } from 'vitest';
import { groupEncounterElements } from '../../src/client/lib/encounter-elements.js';

describe('groupEncounterElements', () => {
  it('keeps characters, notes, and environments as one row each', () => {
    const grouped = groupEncounterElements([
      { instanceId: 'c1', elementType: 'character', name: 'Rook' },
      { instanceId: 'n1', elementType: 'note', name: 'Trap' },
      { instanceId: 'e1', elementType: 'environment', name: 'Grove' },
    ]);
    expect(grouped.map((g) => g.kind)).toEqual(['character', 'note', 'environment']);
    expect(grouped[0].element.instanceId).toBe('c1');
    expect(grouped[1].element.instanceId).toBe('n1');
    expect(grouped[2].element.instanceId).toBe('e1');
  });

  it('collapses adversaries that share a library id', () => {
    const grouped = groupEncounterElements([
      { instanceId: 'a1', elementType: 'adversary', id: 'srd-adv-bear', name: 'Bear' },
      { instanceId: 'a2', elementType: 'adversary', id: 'srd-adv-bear', name: 'Bear' },
      { instanceId: 'a3', elementType: 'adversary', id: 'srd-adv-wolf', name: 'Wolf' },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].kind).toBe('adversary-group');
    expect(grouped[0].instances.map((i) => i.instanceId)).toEqual(['a1', 'a2']);
    expect(grouped[1].instances).toHaveLength(1);
    expect(grouped[1].baseElement.id).toBe('srd-adv-wolf');
  });

  it('skips map dressing and board tokens', () => {
    const grouped = groupEncounterElements([
      { instanceId: 'm1', elementType: 'mapImage' },
      { instanceId: 'd1', elementType: 'drawShape' },
      { instanceId: 'b1', elementType: 'boardToken' },
    ]);
    expect(grouped).toEqual([]);
  });

  it('treats missing input as empty', () => {
    expect(groupEncounterElements()).toEqual([]);
    expect(groupEncounterElements(null)).toEqual([]);
  });
});
