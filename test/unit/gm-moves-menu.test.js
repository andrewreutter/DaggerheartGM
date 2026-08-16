import { describe, it, expect } from 'vitest';
import {
  buildConsolidatedGmMovesMenu,
  emptyGmMovesMenu,
  gmMovesMenuCount,
} from '../../src/client/lib/gm-moves-menu.js';

function bear(overrides = {}) {
  return {
    elementType: 'adversary',
    id: 'srd-adv-bear',
    instanceId: 'bear-1',
    name: 'Bear',
    role: 'bruiser',
    currentHp: 4,
    hp_max: 4,
    attack: { name: 'Claw', modifier: 2, range: 'Melee', damage: 'd8+2', trait: 'phy' },
    features: [
      { name: 'Rampage', type: 'action', description: 'The Bear makes an attack.' },
      { name: 'Thick Hide', type: 'passive', description: 'When the Bear is hit, reduce damage.' },
      { name: 'Terrifying Roar', type: 'action', description: 'Spend 1 Fear to roar.' },
    ],
    ...overrides,
  };
}

describe('buildConsolidatedGmMovesMenu', () => {
  it('includes attack, categorized features, and a role move', () => {
    const menu = buildConsolidatedGmMovesMenu([bear()], 4);
    expect(menu.Actions.map((row) => row.name)).toEqual(
      expect.arrayContaining(['Claw', 'Rampage', 'Bruiser Move']),
    );
    expect(menu.Passives.map((row) => row.name)).toContain('Thick Hide');
    expect(menu['Fear Actions'].map((row) => row.name)).toContain('Terrifying Roar');
    expect(menu.Actions.find((row) => row.name === 'Claw')?._rollData).toMatchObject({
      modifier: 2,
      range: 'Melee',
      damage: 'd8+2',
      trait: 'phy',
    });
    expect(menu.Actions.find((row) => row.name === 'Bruiser Move')?._isRoleMove).toBe(true);
  });

  it('omits reserved N+ and defeated adversary types', () => {
    const reserved = bear({
      id: 'srd-adv-ogre',
      instanceId: 'ogre-1',
      name: 'Ogre',
      minPartySize: 5,
    });
    const defeated = bear({
      id: 'srd-adv-wolf',
      instanceId: 'wolf-1',
      name: 'Wolf',
      currentHp: 0,
      hp_max: 4,
    });
    const menu = buildConsolidatedGmMovesMenu([reserved, defeated], 3);
    expect(menu).toEqual(emptyGmMovesMenu());
  });

  it('collapses duplicate adversary types to one board row set', () => {
    const menu = buildConsolidatedGmMovesMenu([
      bear(),
      bear({ instanceId: 'bear-2' }),
    ], 4);
    expect(menu.Actions.filter((row) => row.name === 'Claw')).toHaveLength(1);
    expect(menu.Actions.filter((row) => row.name === 'Bruiser Move')).toHaveLength(1);
  });

  it('includes environment features', () => {
    const grove = {
      elementType: 'environment',
      instanceId: 'env-1',
      name: 'Abandoned Grove',
      features: [
        { name: 'Overgrowth', type: 'passive', description: 'When a creature enters the grove, vines tighten.' },
      ],
    };
    const menu = buildConsolidatedGmMovesMenu([grove], 4);
    expect(menu.Passives).toHaveLength(1);
    expect(menu.Passives[0]).toMatchObject({
      name: 'Overgrowth',
      sourceName: 'Abandoned Grove',
      cardKey: 'env-1',
    });
  });

  it('counts all categorized rows', () => {
    const menu = buildConsolidatedGmMovesMenu([bear()], 4);
    expect(gmMovesMenuCount(menu)).toBe(
      menu.Passives.length + menu.Reactions.length + menu['Fear Actions'].length + menu.Actions.length,
    );
    expect(gmMovesMenuCount(menu)).toBeGreaterThan(0);
  });
});
