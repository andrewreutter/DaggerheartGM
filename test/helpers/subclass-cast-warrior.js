/**
 * Subclass feature video suite — Warrior character factories (Call of the Brave +
 * Call of the Slayer).
 *
 * Standalone file so concurrent subclass-video agents do not collide on
 * test/helpers/subclass-cast.js. Same completeness conventions as
 * buildBardTroubadourCharacterData (level 8, two subclass_upgrade picks, 5
 * experiences, domainLoadoutIds of 5).
 *
 * Verified via scripts/_verify-warrior-throwaway.mjs: complete === true,
 * unlockSteps === 2, maxHp 7, maxStress 8, maxHope 6, maxArmor 4, evasion 13, tier 4.
 */

const WARRIOR_TRAITS = { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 };

function buildWarriorAdvancements(expPrefix) {
  return {
    2: {
      domainCardId: 'srd-abl-whirlwind',
      picks: [
        { type: 'traits', traits: ['agility', 'strength'] },
        { type: 'traits', traits: ['finesse', 'instinct'] },
      ],
    },
    3: {
      domainCardId: 'srd-abl-ferocity',
      picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
    },
    4: {
      domainCardId: 'srd-abl-scramble',
      picks: [{ type: 'experience', experienceIds: [`${expPrefix}-e1`, `${expPrefix}-e2`] }, { type: 'hp' }],
    },
    5: {
      domainCardId: 'srd-abl-boost',
      picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
    },
    6: {
      domainCardId: 'srd-abl-vitality',
      picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
    },
    7: {
      domainCardId: 'srd-abl-reckless',
      picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
    },
    8: {
      domainCardId: 'srd-abl-battle-cry',
      picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
    },
  };
}

function buildWarriorExperiences(expPrefix) {
  return [
    { id: `${expPrefix}-e1`, name: 'Battlefield Veteran', score: 2 },
    { id: `${expPrefix}-e2`, name: 'Weapon Drill', score: 2 },
    { id: `${expPrefix}-e3`, name: 'Guard Duty', score: 2 },
    { id: `${expPrefix}-e4`, name: 'Mercenary Contracts', score: 2 },
    { id: `${expPrefix}-e5`, name: 'Campfire Stories', score: 2 },
  ];
}

const WARRIOR_DOMAIN_LOADOUT = [
  'srd-abl-get-back-up',
  'srd-abl-deft-maneuvers',
  'srd-abl-whirlwind',
  'srd-abl-ferocity',
  'srd-abl-scramble',
];

/**
 * Warrior / Call of the Brave at level 8 — Foundation Courage + Battle Ritual,
 * Specialization Rise to the Challenge, Mastery Camaraderie (narrative).
 */
export function buildWarriorCallOfTheBraveCharacterData({ name = 'Kara', overrides = {} } = {}) {
  const expPrefix = 'kara';
  return {
    name,
    classId: 'srd-cls-warrior',
    subclassId: 'srd-sub-call-of-the-brave',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-orderborne',
    level: 8,
    baseTraits: WARRIOR_TRAITS,
    advancements: buildWarriorAdvancements(expPrefix),
    primaryWeaponId: 'srd-wpn-broadsword',
    secondaryWeaponId: 'srd-wpn-shortsword',
    armorId: 'srd-arm-chainmail-armor',
    abilityIds: ['srd-abl-get-back-up', 'srd-abl-deft-maneuvers'],
    experiences: buildWarriorExperiences(expPrefix),
    domainLoadoutIds: [...WARRIOR_DOMAIN_LOADOUT],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}

/**
 * Warrior / Call of the Slayer at level 8 — Foundation Slayer, Specialization
 * Weapon Specialist, Mastery Martial Preparation. One-handed primary + secondary
 * so Weapon Specialist's secondary damage die chip can appear.
 */
export function buildWarriorCallOfTheSlayerCharacterData({ name = 'Rex', overrides = {} } = {}) {
  const expPrefix = 'rex';
  return {
    name,
    classId: 'srd-cls-warrior',
    subclassId: 'srd-sub-call-of-the-slayer',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-orderborne',
    level: 8,
    baseTraits: WARRIOR_TRAITS,
    advancements: buildWarriorAdvancements(expPrefix),
    primaryWeaponId: 'srd-wpn-broadsword',
    secondaryWeaponId: 'srd-wpn-shortsword',
    armorId: 'srd-arm-chainmail-armor',
    abilityIds: ['srd-abl-get-back-up', 'srd-abl-deft-maneuvers'],
    experiences: buildWarriorExperiences(expPrefix),
    domainLoadoutIds: [...WARRIOR_DOMAIN_LOADOUT],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}
