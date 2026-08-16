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

  it('maps Jagged Knife Bandits short names to full adversary names', () => {
    const parsed = parseSrdPotentialAdversaries(
      'Beasts (Bear, Glass Snake), Jagged Knife Bandits (Hexer, Kneebreaker, Lackey, Lieutenant, Shadow, Sniper)',
    );
    expect(parsed).toEqual([
      { adversaryId: 'srd-adv-bear', name: 'Bear' },
      { adversaryId: 'srd-adv-glass-snake', name: 'Glass Snake' },
      { adversaryId: 'srd-adv-jagged-knife-hexer', name: 'Jagged Knife Hexer' },
      { adversaryId: 'srd-adv-jagged-knife-kneebreaker', name: 'Jagged Knife Kneebreaker' },
      { adversaryId: 'srd-adv-jagged-knife-lackey', name: 'Jagged Knife Lackey' },
      { adversaryId: 'srd-adv-jagged-knife-lieutenant', name: 'Jagged Knife Lieutenant' },
      { adversaryId: 'srd-adv-jagged-knife-shadow', name: 'Jagged Knife Shadow' },
      { adversaryId: 'srd-adv-jagged-knife-sniper', name: 'Jagged Knife Sniper' },
    ]);
  });

  it('maps Fallen Shock Troops plural to Fallen Shock Troop', () => {
    const parsed = parseSrdPotentialAdversaries(
      'Arch-Necromancer, Fallen Shock Troops, Mortal Hunter, Oracle of Doom, Perfected Zombie',
    );
    expect(parsed.map((p) => p.adversaryId)).toEqual([
      'srd-adv-arch-necromancer',
      'srd-adv-fallen-shock-troop',
      'srd-adv-mortal-hunter',
      'srd-adv-oracle-of-doom',
      'srd-adv-perfected-zombie',
    ]);
  });

  it('resolves un-aliased group shorthand via the adversary catalog', () => {
    const parsed = parseSrdPotentialAdversaries(
      'Foo Bar Bazes (Qux), Tiny Green Oozes',
      ['Foo Bar Qux', 'Tiny Green Ooze'],
    );
    expect(parsed).toEqual([
      { adversaryId: 'srd-adv-foo-bar-qux', name: 'Foo Bar Qux' },
      { adversaryId: 'srd-adv-tiny-green-ooze', name: 'Tiny Green Ooze' },
    ]);
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

describe('SRD environment potential_adversaries resolve against the adversary catalog', () => {
  it('every linked name exists, including Jagged Knife and Fallen Shock Troop', async () => {
    const environments = await getCollection('environments');
    const adversaries = await getCollection('adversaries');
    const advById = new Map(adversaries.map((a) => [a.id, a]));

    const unresolved = [];
    for (const env of environments) {
      for (const entry of env.potential_adversaries || []) {
        if (!entry.adversaryId || !advById.has(entry.adversaryId)) {
          unresolved.push(`${env.name}: ${entry.name} (${entry.adversaryId})`);
        }
      }
    }
    expect(unresolved).toEqual([]);

    const raging = environments.find((e) => e.id === 'srd-env-raging-river');
    expect(raging.potential_adversaries.map((p) => p.adversaryId)).toEqual([
      'srd-adv-bear',
      'srd-adv-glass-snake',
      'srd-adv-jagged-knife-hexer',
      'srd-adv-jagged-knife-kneebreaker',
      'srd-adv-jagged-knife-lackey',
      'srd-adv-jagged-knife-lieutenant',
      'srd-adv-jagged-knife-shadow',
      'srd-adv-jagged-knife-sniper',
    ]);

    const outpost = environments.find((e) => e.id === 'srd-env-outpost-town');
    expect(outpost.potential_adversaries.map((p) => p.adversaryId)).toContain('srd-adv-jagged-knife-hexer');
    expect(outpost.potential_adversaries.map((p) => p.adversaryId)).toContain('srd-adv-masked-thief');

    const divine = environments.find((e) => e.id === 'srd-env-divine-usurpation');
    expect(divine.potential_adversaries.map((p) => p.adversaryId)).toContain('srd-adv-fallen-shock-troop');
  });
});
