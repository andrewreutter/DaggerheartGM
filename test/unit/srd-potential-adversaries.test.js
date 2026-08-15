import { describe, it, expect } from 'vitest';
import { getCollection, parseSrdPotentialAdversaries } from '../../src/srd/parser.js';

describe('parseSrdPotentialAdversaries', () => {
  it('maps Chaos Realm group members to Outer Realms adversary names', () => {
    const parsed = parseSrdPotentialAdversaries(
      'Outer Realms Monstrosities (Abomination, Corruptor, Thrall)',
    );
    expect(parsed).toEqual([
      { adversaryId: 'srd-adv-outer-realms-abomination', name: 'Outer Realms Abomination' },
      { adversaryId: 'srd-adv-outer-realms-corruptor', name: 'Outer Realms Corruptor' },
      { adversaryId: 'srd-adv-outer-realms-thrall', name: 'Outer Realms Thrall' },
    ]);
  });

  it('keeps already-complete inner names (Beasts / Guards)', () => {
    const parsed = parseSrdPotentialAdversaries(
      'Beasts (Bear, Dire Wolf), Guards (Bladed Guard, Head Guard), Masked Thief',
    );
    expect(parsed.map((p) => p.adversaryId)).toEqual([
      'srd-adv-bear',
      'srd-adv-dire-wolf',
      'srd-adv-bladed-guard',
      'srd-adv-head-guard',
      'srd-adv-masked-thief',
    ]);
  });

  it('drops Any and see-"…" junk tokens', () => {
    expect(parseSrdPotentialAdversaries('Any')).toEqual([]);
    expect(parseSrdPotentialAdversaries('')).toEqual([]);
    const haunted = parseSrdPotentialAdversaries(
      'Ghosts (Spectral Archer, Spectral Captain, Spectral Guardian), ghostly versions of other adversaries (see "Ghostly Form")',
    );
    expect(haunted.map((p) => p.name)).toEqual([
      'Spectral Archer',
      'Spectral Captain',
      'Spectral Guardian',
    ]);
    expect(haunted.some((p) => /^see\b/i.test(p.name))).toBe(false);
  });
});

describe('Chaos Realm potential_adversaries (SRD collections)', () => {
  it('resolves to adversary ids that exist, including Outer Realms Abomination', async () => {
    const environments = await getCollection('environments');
    const adversaries = await getCollection('adversaries');
    expect(environments?.length).toBeGreaterThan(0);
    expect(adversaries?.length).toBeGreaterThan(0);

    const chaos = environments.find((e) => e.id === 'srd-env-chaos-realm' || e.name === 'Chaos Realm');
    expect(chaos).toBeTruthy();

    const ids = (chaos.potential_adversaries || []).map((p) => p.adversaryId).filter(Boolean);
    expect(ids).toContain('srd-adv-outer-realms-abomination');
    expect(ids).toContain('srd-adv-outer-realms-corruptor');
    expect(ids).toContain('srd-adv-outer-realms-thrall');

    const advById = new Map(adversaries.map((a) => [a.id, a]));
    for (const id of ids) {
      const adv = advById.get(id);
      expect(adv, `unresolved potential adversary ${id}`).toBeTruthy();
    }
    expect(advById.get('srd-adv-outer-realms-abomination').name).toBe('Outer Realms Abomination');
  });
});
