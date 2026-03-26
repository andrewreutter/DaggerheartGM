/**
 * Beastbound Ranger subclass — SRD: daggerheart-srd/subclasses/Beastbound.md
 */

import { when, isTargeted } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

/** File-local shape bundle (not exported; engine discovers via `Companion.cards[].shape` only). */
const companionShape = {
  id: 'dh.shape.rangerCompanion',
  version: 1,
  bind: { kind: 'character', path: 'companion' },
  anchors: { afterSelector: 'subclassId' },
  jsonSchema: {
    required: ['name', 'species', 'attackName', 'experiences'],
    properties: {
      name: { type: 'string', minLength: 1, title: 'Name' },
      species: { type: 'string', minLength: 1, title: 'Species' },
      evasion: {
        type: 'integer',
        minimum: 0,
        maximum: 30,
        default: 10,
        title: 'Evasion',
      },
      attackName: {
        type: 'attack',
        minLength: 1,
        title: 'Attack name',
        description: 'd6 Melee in play',
      },
      maxStress: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 3,
        title: 'Max stress',
      },
      currentStress: {
        type: 'trackedState',
        minimum: 0,
        title: 'Stress (marked)',
      },
      experiences: {
        type: 'array',
        minItems: 2,
        title: 'Experiences',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string', minLength: 1, title: 'Experience name' },
            score: {
              type: 'integer',
              minimum: 1,
              default: 2,
              title: 'Score',
            },
          },
        },
      },
    },
  },
};

/**
 * Maps persisted `element.companion` into display data for declarative `cards` leaves.
 *
 * @param {object|null|undefined} companion
 * @returns {object|null}
 */
export function srdifyRangerCompanion(companion) {
  if (companion == null || typeof companion !== 'object') return null;
  const experiences = Array.isArray(companion.experiences) ? companion.experiences : [];
  return {
    shapeId: companionShape.id,
    name: companion.name != null ? String(companion.name) : 'Companion',
    species: companion.species != null ? String(companion.species) : '',
    evasion: typeof companion.evasion === 'number' ? companion.evasion : 10,
    attackName: companion.attackName != null ? String(companion.attackName) : '',
    maxStress: typeof companion.maxStress === 'number' ? companion.maxStress : 3,
    currentStress: typeof companion.currentStress === 'number' ? companion.currentStress : 0,
    experiences: experiences.map((exp, i) => ({
      id: exp?.id ?? `exp-${i}`,
      name: exp?.name != null ? String(exp.name) : '',
      score: typeof exp?.score === 'number' ? exp.score : typeof exp?.modifier === 'number' ? exp.modifier : 0,
    })),
  };
}

/**
 * Adversary attack vs the ranger where the adversary is in **Melee** range of the ranger’s position.
 * Treats the companion as sharing the ranger’s space when the companion has no separate map token
 * (see **Battle-Bonded** SRD: attacker must be within the companion’s Melee range).
 */
function adversaryInMeleeOfSharedCompanionSpace(table) {
  const actor = table.action?.actor;
  if (!actor || actor.isAdversary !== true) return false;
  return table.me?.rangeFrom(actor) === 'melee';
}

export const Companion = {
  name: 'Companion',
  description:
    "You have an animal companion of your choice (at the GM's discretion). They stay by your side unless you tell them otherwise.\n\nTake the Ranger Companion sheet. When you level up your character, choose a level-up option for your companion from this sheet as well.",
  /** Declarative cards: sheet (runtime data) + editor (bind-only shell). */
  cards: [
    {
      placement: 'sheet',
      shape: companionShape,
      resolve: when(
        (t) => t.me?.companion != null,
        (table) => srdifyRangerCompanion(table.me.companion),
      ),
    },
    {
      placement: 'editor',
      shape: companionShape,
      resolve: when(() => true, () => ({})),
    },
  ],
  /**
   * Sheet UI below the companion template — `placements` uses the **same object reference** as
   * `companionShape` (see `collectChipsForShapePlacement`).
   */
  chips: [
    {
      placements: [companionShape],
      name: 'Take an action',
      description: 'Companion Act — Spellcast roll',
      onUse: (table) => {
        const me = table.me;
        if (!me) return;
        const charName = me.name != null ? String(me.name) : 'Character';
        const spellcastKey = (me.spellcastTrait || 'presence').toLowerCase();
        const spellcastScore = me.traits?.[spellcastKey] ?? 0;
        const parts = [`${charName} Companion Act Hope [d12] Fear [d12]`];
        if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
        table.sheet.actionRoll({
          rollText: parts.join(' '),
          displayName: `${charName} Companion Act`,
          rollMeta: {
            _attackerInstanceId: me.instanceId,
            _traitKey: spellcastKey,
            _intentPanelForActionRoll: true,
            _deferExperienceToPreRoll: true,
            _companionExperienceForRoll: true,
            _isSpellcastRoll: true,
          },
        });
      },
    },
  ],
};

export const ExpertTraining = {
  name: 'Expert Training',
  description: 'Choose an additional level-up option for your companion.',
};

export const BattleBonded = {
  name: 'Battle-Bonded',
  description:
    "When an adversary attacks you while they're within your companion's Melee range, you gain a +2 bonus to your Evasion against the attack.",
  hooks: {
    onIntent: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      adversaryInMeleeOfSharedCompanionSpace,
      (table) => {
        queueInternalMutation(table, 'addTemporaryStatMod', {
          instanceId: table.me.instanceId,
          stat: 'evasion',
          value: 2,
        });
      }
    ),
  },
};

export const AdvancedTraining = {
  name: 'Advanced Training',
  description: 'Choose two additional level-up options for your companion.',
};

export const LoyalFriend = {
  name: 'Loyal Friend',
  description:
    "Once per long rest, when the damage from an attack would mark your companion's last Stress or your last Hit Point and you're within Close range of each other, you or your companion can rush to the other's side and take that damage instead.",
};
