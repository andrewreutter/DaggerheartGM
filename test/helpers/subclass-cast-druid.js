/**
 * Subclass feature video test suite — Druid character data factories
 * (Warden of the Elements + Warden of Renewal).
 *
 * Standalone file (does not edit test/helpers/subclass-cast.js) so concurrent subclass
 * agents do not collide on the shared cast module. Same completeness requirements as
 * `buildBardTroubadourCharacterData` — level 8, fully populated `advancements['2'..'8']`,
 * one `subclass_upgrade` in Band B (level 5) and one in Band C (level 8), 5 named
 * experiences, `domainLoadoutIds` of exactly 5 owned ids.
 *
 * Verified with `scripts/_verify-druid-throwaway.mjs` (deleted after use): both characters
 * `complete: true`, unlockSteps `2`, maxHp 7, maxStress 8, maxHope 6, maxArmor 3,
 * evasion 13, tier 4, spellcastTrait `instinct`.
 *
 * SRD ids: `srd-cls-druid`, `srd-sub-warden-of-the-elements`, `srd-sub-warden-of-renewal`.
 * Domains: Sage + Arcana. Primary weapon Quarterstaff (Instinct, Melee) so adversary
 * tokens can sit in Melee for Elemental Incarnation Fire / Water splash demos.
 */

const STANDARD_TRAITS = { agility: 1, strength: 0, finesse: 0, instinct: 2, presence: 1, knowledge: -1 };

const DRUID_ADVANCEMENT_CARDS = [
  'srd-abl-conjure-swarm',
  'srd-abl-corrosive-projectile',
  'srd-abl-death-grip',
  'srd-abl-thorn-skin',
  'srd-abl-forager',
  'srd-abl-sage-touched',
  'srd-abl-forest-sprites',
];

const DRUID_STARTING_ABILITIES = ['srd-abl-gifted-tracker', 'srd-abl-rune-ward'];

function buildDruidAdvancements(expIds) {
  return {
    2: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[0],
      picks: [
        { type: 'traits', traits: ['instinct', 'presence'] },
        { type: 'traits', traits: ['agility', 'finesse'] },
      ],
    },
    3: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[1],
      picks: [{ type: 'traits', traits: ['knowledge', 'strength'] }, { type: 'evasion' }],
    },
    4: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[2],
      picks: [{ type: 'experience', experienceIds: expIds }, { type: 'hp' }],
    },
    5: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[3],
      picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['instinct', 'presence'] }],
    },
    6: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[4],
      picks: [{ type: 'traits', traits: ['agility', 'finesse'] }, { type: 'evasion' }],
    },
    7: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[5],
      picks: [{ type: 'traits', traits: ['knowledge', 'strength'] }, { type: 'stress' }],
    },
    8: {
      domainCardId: DRUID_ADVANCEMENT_CARDS[6],
      picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
    },
  };
}

function buildDruidBase({ name, subclassId, expPrefix }) {
  const expIds = [`${expPrefix}-e1`, `${expPrefix}-e2`];
  return {
    name,
    classId: 'srd-cls-druid',
    subclassId,
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-wildborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
    advancements: buildDruidAdvancements(expIds),
    primaryWeaponId: 'srd-wpn-quarterstaff',
    armorId: 'srd-arm-leather-armor',
    abilityIds: [...DRUID_STARTING_ABILITIES],
    experiences: [
      { id: `${expPrefix}-e1`, name: 'River Guide', score: 2 },
      { id: `${expPrefix}-e2`, name: 'Herbal Lore', score: 2 },
      { id: `${expPrefix}-e3`, name: 'Storm Watcher', score: 2 },
      { id: `${expPrefix}-e4`, name: 'Beast Kin', score: 2 },
      { id: `${expPrefix}-e5`, name: 'Campfire Tales', score: 2 },
    ],
    domainLoadoutIds: [
      ...DRUID_STARTING_ABILITIES,
      DRUID_ADVANCEMENT_CARDS[0],
      DRUID_ADVANCEMENT_CARDS[1],
      DRUID_ADVANCEMENT_CARDS[2],
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Informational only — derived by `recomputeCharacter` (verified: maxHp 7, maxStress 8,
    // maxHope 6, maxArmor 3, evasion 13, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
  };
}

/**
 * Druid / Warden of the Elements at level 8 (Foundation Elemental Incarnation +
 * Specialization Elemental Aura + Mastery Elemental Dominion all unlocked).
 */
export function buildDruidWardenOfTheElementsCharacterData({ name = 'Elm', overrides = {} } = {}) {
  return {
    ...buildDruidBase({
      name,
      subclassId: 'srd-sub-warden-of-the-elements',
      expPrefix: 'elm',
    }),
    ...overrides,
  };
}

/**
 * Druid / Warden of Renewal at level 8 (Clarity of Nature + Regeneration,
 * Regenerative Reach, Warden's Protection, Defender all unlocked).
 */
export function buildDruidWardenOfRenewalCharacterData({ name = 'Reed', overrides = {} } = {}) {
  return {
    ...buildDruidBase({
      name,
      subclassId: 'srd-sub-warden-of-renewal',
      expPrefix: 'reed',
    }),
    ...overrides,
  };
}
