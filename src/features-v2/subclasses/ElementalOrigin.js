/**
 * Elemental Origin subclass (Sorcerer) — SRD: daggerheart-srd/subclasses/Elemental Origin.md
 */

import { when, isActing, isTargeted } from '../engine/when.js';

const FS = 'ElementalOrigin';

function transcendence(table) {
  return table.source?.get?.('transcendence') ?? table.featureState?.[FS]?.transcendence;
}

function transcendenceActive(table) {
  const tr = transcendence(table);
  return tr?.active === true;
}

const TRAIT_IDS = [
  ['traitAgility', 'agility'],
  ['traitStrength', 'strength'],
  ['traitFinesse', 'finesse'],
  ['traitInstinct', 'instinct'],
  ['traitPresence', 'presence'],
  ['traitKnowledge', 'knowledge'],
];

function parseTranscendenceSelections(selectedIds) {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  let severe4 = false;
  let prof1 = false;
  let evasion2 = false;
  let traitKey = null;
  for (const id of ids) {
    if (id === 'severe4') severe4 = true;
    else if (id === 'prof1') prof1 = true;
    else if (id === 'evasion2') evasion2 = true;
    else {
      const pair = TRAIT_IDS.find(([tid]) => tid === id);
      if (pair && !traitKey) traitKey = pair[1];
    }
  }
  return { severe4, prof1, evasion2, traitKey };
}

export const Elementalist = {
  name: 'Elementalist',
  description:
    'Choose one of the following elements at character creation: air, earth, fire, lightning, water.\n\nYou can shape this element into harmless effects. Additionally, **spend a Hope** and describe how your control over this element helps an action roll you\'re about to make, then either gain a +2 bonus to the roll or a +3 bonus to the roll\'s damage.',
  chips: [
    {
      placements: ['create'],
      description: 'Choose your elemental affinity (character creation).',
      isSelect: () => [
        { id: 'air', name: 'Air' },
        { id: 'earth', name: 'Earth' },
        { id: 'fire', name: 'Fire' },
        { id: 'lightning', name: 'Lightning' },
        { id: 'water', name: 'Water' },
      ],
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (id === 'air' || id === 'earth' || id === 'fire' || id === 'lightning' || id === 'water') {
          table.source.set('element', id);
        }
      },
    },
    when(
      isActing,
      (table) => table.rolls?.action != null,
      {
        description:
          'Spend 1 Hope and describe how your element helps — +2 to this action roll.',
        placements: ['intent'],
        hopeCost: 1,
        onUse(table) {
          table.rolls?.action?.addStatic?.({ name: 'Elementalist', value: 2 });
        },
      }
    ),
    when(
      isActing,
      (table) => table.rolls?.damage != null,
      {
        description:
          'Spend 1 Hope and describe how your element helps — +3 to this damage roll.',
        placements: ['intent'],
        hopeCost: 1,
        onUse(table) {
          table.rolls?.damage?.addStatic?.({ name: 'Elementalist', value: 3 });
        },
      }
    ),
  ],
};

export const NaturalEvasion = {
  name: 'Natural Evasion',
  description:
    'You can call forth your element to protect you from harm. When an attack roll against you succeeds, you can **mark a Stress** and describe how you use your element to defend you. When you do, roll a **d6** and add its result to your Evasion against the attack.',
  chips: [
    when(
      isTargeted,
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: 'Mark 1 Stress, roll d6, and add it to your Evasion against this attack.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          const v = table.rollDie('d6');
          table.feature.set('naturalEvasionD6', v);
        },
        temporaryStatMods: {
          evasion: (table) => table.feature.get('naturalEvasionD6') ?? 0,
        },
      }
    ),
  ],
};

export const Transcendence = {
  name: 'Transcendence',
  description:
    'Once per long rest, you can transform into a physical manifestation of your element. When you do, describe your transformation and choose two of the following benefits to gain until your next rest:\n\n- +4 bonus to your Severe threshold\n- +1 bonus to a character trait of your choice\n- +1 bonus to your Proficiency\n- +2 bonus to your Evasion',
  passiveStatMods: when(transcendenceActive, {
    severeThreshold: (table) => (transcendence(table)?.severe4 ? 4 : 0),
    evasion: (table) => (transcendence(table)?.evasion2 ? 2 : 0),
    agility: (table) => (transcendence(table)?.traitKey === 'agility' ? 1 : 0),
    strength: (table) => (transcendence(table)?.traitKey === 'strength' ? 1 : 0),
    finesse: (table) => (transcendence(table)?.traitKey === 'finesse' ? 1 : 0),
    instinct: (table) => (transcendence(table)?.traitKey === 'instinct' ? 1 : 0),
    presence: (table) => (transcendence(table)?.traitKey === 'presence' ? 1 : 0),
    knowledge: (table) => (transcendence(table)?.traitKey === 'knowledge' ? 1 : 0),
  }),
  hooks: {
    onIntent: when(
      isActing,
      (table) => transcendenceActive(table) && transcendence(table)?.prof1 === true,
      (table) => {
        if (table.rolls?.damage) {
          table.rolls.damage.addStatic({ name: 'Transcendence (Proficiency)', value: 1 });
        }
      }
    ),
    onRest(table) {
      table.source.set('transcendence', null);
    },
  },
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      multiSelect: true,
      maxSelections: 2,
      description:
        'Transform; pick two benefits until your next rest (+4 Severe / +1 trait / +1 Proficiency on damage / +2 Evasion).',
      isSelect: () => [
        { id: 'severe4', name: '+4 Severe threshold' },
        { id: 'prof1', name: '+1 Proficiency (damage rolls)' },
        { id: 'evasion2', name: '+2 Evasion' },
        { id: 'traitAgility', name: '+1 Agility' },
        { id: 'traitStrength', name: '+1 Strength' },
        { id: 'traitFinesse', name: '+1 Finesse' },
        { id: 'traitInstinct', name: '+1 Instinct' },
        { id: 'traitPresence', name: '+1 Presence' },
        { id: 'traitKnowledge', name: '+1 Knowledge' },
      ],
      onUse(table, chip) {
        const selectedIds = chip.get('selectedIds') || [];
        const parsed = parseTranscendenceSelections(selectedIds);
        table.source.set('transcendence', {
          active: true,
          severe4: parsed.severe4,
          prof1: parsed.prof1,
          evasion2: parsed.evasion2,
          traitKey: parsed.traitKey,
        });
      },
    },
  ],
};
