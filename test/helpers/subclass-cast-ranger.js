/**
 * Subclass feature video test suite — Ranger character data factories
 * (Beastbound + Wayfinder).
 *
 * Same shape/verification workflow as `test/helpers/subclass-cast.js`'s Bard/Rogue factories
 * (see that file's doc comment) — level 8, fully populated `advancements['2'..'8']` (two picks
 * each), one `subclass_upgrade` pick in Band B (level 5) and one in Band C (level 8) so
 * `deriveSubclassUnlockSteps` returns `2` (Foundation + Specialization + Mastery all unlocked),
 * 5 named experiences, and a `domainLoadoutIds` array of exactly 5 distinct owned ids (9 owned
 * domain cards total > 5).
 *
 * Verified with a throwaway script (`scripts/_verify-ranger-throwaway.mjs`, deleted after use)
 * calling `isCharacterComplete` / `deriveSubclassUnlockSteps` / `recomputeCharacter` directly:
 * both characters `complete: true`, unlockSteps `2`, maxHp 7, maxStress 8, maxHope 6, maxArmor 3,
 * evasion 15, tier 4, spellcastTrait 'agility' (derived from the subclass's `spellcast_trait:
 * "Agility"` — used by Beastbound's Companion "Take an action" chip).
 *
 * Primary/secondary weapons are both Melee (Dagger / Small Dagger) rather than the class's
 * suggested Shortbow so every adversary in the walkthrough can be placed within Melee range of
 * the Ranger for Ranger's Focus / Hold Them Off / Apex Predator without needing a large map.
 */

const STANDARD_TRAITS = { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: -1, knowledge: 0 };

/**
 * Ranger / Beastbound at level 8 with a fully populated `companion` object (per the declarative
 * Companion schema in `src/features-v2/subclasses/Beastbound.js` — `name`, `species`, `evasion`,
 * `attackName`, `maxStress`/`currentStress`, `experiences` (>= 2 entries)).
 */
export function buildRangerBeastboundCharacterData({ name = 'Kest', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-ranger',
    subclassId: 'srd-sub-beastbound',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
    advancements: {
      2: {
        domainCardId: 'srd-abl-ferocity',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-corrosive-projectile',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-death-grip',
        picks: [{ type: 'experience', experienceIds: ['kest-e1', 'kest-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-know-thy-enemy',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-recovery',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-sage-touched',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-wrangle',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-dagger',
    secondaryWeaponId: 'srd-wpn-small-dagger',
    armorId: 'srd-arm-leather-armor',
    abilityIds: ['srd-abl-deft-maneuvers', 'srd-abl-gifted-tracker'],
    experiences: [
      { id: 'kest-e1', name: 'Beast Whisperer', score: 2 },
      { id: 'kest-e2', name: 'Tracker', score: 2 },
      { id: 'kest-e3', name: 'Survivalist', score: 2 },
      { id: 'kest-e4', name: 'Quick Reflexes', score: 2 },
      { id: 'kest-e5', name: 'Keen Eye', score: 2 },
    ],
    // 9 owned domain cards total (2 starting + 7 advancement rows) > 5, so a `domainLoadoutIds`
    // pick of exactly 5 distinct owned ids is required for completeness.
    domainLoadoutIds: [
      'srd-abl-deft-maneuvers',
      'srd-abl-gifted-tracker',
      'srd-abl-ferocity',
      'srd-abl-corrosive-projectile',
      'srd-abl-death-grip',
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Beastbound Companion declarative shape (src/features-v2/subclasses/Beastbound.js
    // `companionShape`) — `name`/`species`/`experiences` are `required`.
    companion: {
      name: 'Fang',
      species: 'Wolf',
      evasion: 12,
      attackName: 'Bite',
      maxStress: 3,
      currentStress: 0,
      experiences: [
        { id: 'fang-e1', name: 'Scent Tracking', score: 2 },
        { id: 'fang-e2', name: 'Pack Tactics', score: 2 },
      ],
      tokenSizeWidth: 1,
      tokenSizeLength: 1,
      tokenSizeLinked: true,
    },
    // Informational only — `recomputeCharacter` derives the real values from SRD data +
    // advancement picks (verified via the generator script: maxHp 7, maxStress 8, maxHope 6,
    // maxArmor 3, evasion 15, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}

/**
 * Ranger / Wayfinder at level 8 — same completeness requirements as
 * {@link buildRangerBeastboundCharacterData}. No `companion` field (Wayfinder does not grant one).
 */
export function buildRangerWayfinderCharacterData({ name = 'Ashra', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-ranger',
    subclassId: 'srd-sub-wayfinder',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
    advancements: {
      2: {
        domainCardId: 'srd-abl-strategic-approach',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-towering-stalk',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-boost',
        picks: [{ type: 'experience', experienceIds: ['ashra-e1', 'ashra-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-signature-move',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-rapid-riposte',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-bone-touched',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-breaking-blow',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-dagger',
    secondaryWeaponId: 'srd-wpn-small-dagger',
    armorId: 'srd-arm-leather-armor',
    abilityIds: ['srd-abl-deft-maneuvers', 'srd-abl-gifted-tracker'],
    experiences: [
      { id: 'ashra-e1', name: 'Cold Blooded', score: 2 },
      { id: 'ashra-e2', name: 'Deadeye', score: 2 },
      { id: 'ashra-e3', name: 'Pathfinder', score: 2 },
      { id: 'ashra-e4', name: 'Patient Stalker', score: 2 },
      { id: 'ashra-e5', name: 'Silent Step', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-deft-maneuvers',
      'srd-abl-gifted-tracker',
      'srd-abl-strategic-approach',
      'srd-abl-towering-stalk',
      'srd-abl-boost',
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Informational only — derived by `recomputeCharacter` at render time (verified: maxHp 7,
    // maxStress 8, maxHope 6, maxArmor 3, evasion 15, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}
