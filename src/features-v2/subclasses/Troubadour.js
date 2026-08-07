/**
 * Troubadour subclass features — SRD: daggerheart-srd/subclasses/Troubadour.md
 */

import { queueInternalMutation } from '../engine/table.js';
import { RALLY_FEATURE_STATE_BAG_KEY } from '../classes/Bard.js';

/** Subclass feature name — `featureState` bag for Virtuoso. */
const VIRTUOSO_FEATURE_BAG_KEY = 'Virtuoso';

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
  return table.featureState?.[VIRTUOSO_FEATURE_BAG_KEY]?.doublesGiftedPerformer === true ? 2 : 1;
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
      // NOTE: no `frequency` field here — the generic engine tracks per-feature (not
      // per-chip) "used this cycle" state in `element.featureUsage`, keyed by the
      // feature's guide key. Gifted Performer has three siblings chips that each need
      // an *independent* per-long-rest cap (doubled by Virtuoso), so using `frequency`
      // would make using any one song incorrectly grey out the other two. Each song
      // tracks its own use count via `table.feature.get/set` (scoped to this feature)
      // instead; `giftedPerformerUseCap`/`isDisabled` below fully replicate the cap
      // semantics (including Virtuoso's doubling) without the generic mechanism.
      description: 'You and all allies within Close range clear a Hit Point.',
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('relaxingUses') ?? 0;
        if (uses >= cap) return `Relaxing Song already used (${cap} per long rest).`;
        if (
          selfAndAlliesInClose(table).every((c) => {
            const hp = c.currentHP;
            const max = c.maxHP;
            if (hp == null || max == null) return true;
            return hp >= max;
          })
        ) {
          return 'You and allies in Close range have no marked HP to clear.';
        }
        return false;
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
      // See "Relaxing Song" note above — no `frequency` here on purpose.
      description: 'Make a target within Close range temporarily Vulnerable.',
      selectTargets: (table) => adversariesInClose(table),
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('epicUses') ?? 0;
        if (uses >= cap) return `Epic Song already used (${cap} per long rest).`;
        if (adversariesInClose(table).length === 0) return 'No adversary in Close range.';
        return false;
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
      // See "Relaxing Song" note above — no `frequency` here on purpose.
      description: 'You and all allies within Close range gain a Hope.',
      isDisabled: (table) => {
        const cap = giftedPerformerUseCap(table);
        const uses = table.feature.get('heartbreakingUses') ?? 0;
        if (uses >= cap) return `Heartbreaking Song already used (${cap} per long rest).`;
        if (
          selfAndAlliesInClose(table).every((c) => {
            const h = c.hope;
            const max = c.maxHope;
            if (h == null || max == null) return true;
            return h >= max;
          })
        ) {
          return 'You and allies in Close range are at max Hope.';
        }
        return false;
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
      // Cross-feature: state lives on the Bard **Rally** bag, not the Troubadour subclass scope — use setFeatureState.
      queueInternalMutation(table, 'setFeatureState', {
        featureKey: RALLY_FEATURE_STATE_BAG_KEY,
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
        if (!id) return 'No character.';
        const row = table.featureState?.[RALLY_FEATURE_STATE_BAG_KEY]?.maestroRallyChoices;
        if (!row || typeof row !== 'object') return 'Maestro choices are not available yet (after Bard Rally).';
        if (!Object.prototype.hasOwnProperty.call(row, id)) return 'You were not part of this Rally.';
        if (row[id] !== null) return 'You already chose Hope or Stress for this Rally.';
        return false;
      },
      onUse(table, chip) {
        const meId = table.me?.instanceId;
        if (!meId) return;
        const sel = chip.get('selectedId');
        if (sel !== 'hope' && sel !== 'stress') return;
        const prev = table.featureState?.[RALLY_FEATURE_STATE_BAG_KEY]?.maestroRallyChoices;
        if (!prev || typeof prev !== 'object' || prev[meId] !== null) return;
        const next = { ...prev, [meId]: sel };
        queueInternalMutation(table, 'setFeatureState', {
          featureKey: RALLY_FEATURE_STATE_BAG_KEY,
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
