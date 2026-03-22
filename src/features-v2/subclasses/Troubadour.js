/**
 * Troubadour subclass features — SRD: daggerheart-srd/subclasses/Troubadour.md
 */

import { queueInternalMutation } from '../engine/table.js';

/**
 * "Close range" for Gifted Performer songs: Melee, Very Close, or Close (≤30 ft).
 */
function inCloseRangeBand(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function selfAndAlliesInClose(table) {
  return table.characters.filter((c) => inCloseRangeBand(table, c));
}

function adversariesInClose(table) {
  return table.adversaries.filter((a) => inCloseRangeBand(table, a));
}

/** Virtuoso doubles each song’s per–long-rest uses (tracked on Virtuoso feature state). */
function giftedPerformerUseCap(table) {
  return table.featureState?.Virtuoso?.doublesGiftedPerformer === true ? 2 : 1;
}

export const GiftedPerformer = {
  name: 'Gifted Performer',
  description:
    'You can play three different types of songs, once each per long rest; describe how you perform for others to gain the listed benefit:\n\n- Relaxing Song: You and all allies within Close range clear a Hit Point.\n- Epic Song: Make a target within Close range temporarily Vulnerable.\n- Heartbreaking Song: You and all allies within Close range gain a Hope.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('relaxingUses', 0);
      table.feature.set('epicUses', 0);
      table.feature.set('heartbreakingUses', 0);
    },
  },
  chips: [
    {
      name: 'Relaxing Song',
      placements: ['card'],
      frequency: 'longRest',
      description: 'You and all allies within Close range clear a Hit Point.',
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('relaxingUses') ?? 0;
        if (uses >= cap) return true;
        return selfAndAlliesInClose(table).every((c) => {
          const hp = c.currentHP;
          const max = c.maxHP;
          if (hp == null || max == null) return true;
          return hp >= max;
        });
      },
      onUse(table) {
        for (const c of selfAndAlliesInClose(table)) {
          const hp = c.currentHP;
          const max = c.maxHP;
          if (hp != null && max != null && hp < max) c.clearHP(1);
        }
        table.feature.set('relaxingUses', (table.feature.get('relaxingUses') ?? 0) + 1);
      },
    },
    {
      name: 'Epic Song',
      placements: ['card'],
      frequency: 'longRest',
      description: 'Make a target within Close range temporarily Vulnerable.',
      selectTargets: (table) => adversariesInClose(table),
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('epicUses') ?? 0;
        if (uses >= cap) return true;
        return adversariesInClose(table).length === 0;
      },
      onUse(table, chip) {
        const ids = chip.get('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const adv = table.adversaries.find((a) => a.instanceId === id);
        adv?.addCondition('Vulnerable');
        table.feature.set('epicUses', (table.feature.get('epicUses') ?? 0) + 1);
      },
    },
    {
      name: 'Heartbreaking Song',
      placements: ['card'],
      frequency: 'longRest',
      description: 'You and all allies within Close range gain a Hope.',
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('heartbreakingUses') ?? 0;
        if (uses >= cap) return true;
        return selfAndAlliesInClose(table).every((c) => {
          const h = c.hope;
          const max = c.maxHope;
          if (h == null || max == null) return true;
          return h >= max;
        });
      },
      onUse(table) {
        for (const c of selfAndAlliesInClose(table)) {
          const h = c.hope;
          const max = c.maxHope;
          if (h != null && max != null && h < max) c.gainHope(1);
        }
        table.feature.set('heartbreakingUses', (table.feature.get('heartbreakingUses') ?? 0) + 1);
      },
    },
  ],
};

/**
 * When the Troubadour uses **Rally** (`classes/Bard.js`), each **ally** (not the Bard) may once pick Hope or Stress.
 * Pending keys live on **`featureState.Rally.maestroRallyChoices`**; this feature’s card + `showOnOtherSheets` exposes the choice to allies.
 */
export const Maestro = {
  name: 'Maestro',
  description:
    'Your rallying songs steel the courage of those who listen. When you give a Rally Die to an ally, they can gain a Hope or clear a Stress.',
  hooks: {
    onSessionStart(table) {
      queueInternalMutation(table, 'setFeatureState', {
        featureKey: 'Rally',
        key: 'maestroRallyChoices',
        value: null,
      });
    },
  },
  chips: [
    {
      name: 'Maestro — after Rally',
      placements: ['card'],
      showOnOtherSheets: true,
      description:
        'After this session’s Rally from the Troubadour, choose one: gain 1 Hope, or clear 1 Stress.',
      isSelect: () => [
        { id: 'hope', name: 'Gain 1 Hope', description: 'Gain 1 Hope.' },
        { id: 'stress', name: 'Clear 1 Stress', description: 'Clear 1 Stress.' },
      ],
      isDisabled: (table) => {
        const id = table.me?.instanceId;
        if (!id) return true;
        const row = table.featureState?.Rally?.maestroRallyChoices;
        if (!row || typeof row !== 'object') return true;
        if (!Object.prototype.hasOwnProperty.call(row, id)) return true;
        return row[id] !== null;
      },
      onUse(table, chip) {
        const meId = table.me?.instanceId;
        if (!meId) return;
        const sel = chip.get('selectedId');
        if (sel !== 'hope' && sel !== 'stress') return;
        const prev = table.featureState?.Rally?.maestroRallyChoices;
        if (!prev || typeof prev !== 'object' || prev[meId] !== null) return;
        const next = { ...prev, [meId]: sel };
        queueInternalMutation(table, 'setFeatureState', {
          featureKey: 'Rally',
          key: 'maestroRallyChoices',
          value: next,
        });
        if (sel === 'hope') table.me.gainHope(1);
        else table.me.clearStress(1);
      },
    },
  ],
};

/**
 * Doubles per-song long-rest caps on Gifted Performer (see `giftedPerformerUseCap`).
 * **Maestro** integration remains a separate subclass implementation task.
 */
export const Virtuoso = {
  name: 'Virtuoso',
  description:
    'You are among the greatest of your craft and your skill is boundless. You can perform each of your “Gifted Performer” feature’s songs twice per long rest (instead of once).',
  hooks: {
    onSessionStart(table) {
      table.feature.set('doublesGiftedPerformer', true);
    },
  },
};
