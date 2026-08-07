/**
 * Subclass feature video test suite — Rogue / Syndicate character factory.
 *
 * Deliberately a standalone file (not an addition to test/helpers/subclass-cast.js) so this
 * agent's work does not collide with concurrent edits to that shared file (e.g. the human's
 * Rogue/Nightwalker work). Same shape/conventions as `buildBardTroubadourCharacterData` /
 * `buildRogueNightwalkerCharacterData` in subclass-cast.js.
 *
 * Verified with a throwaway script (deleted) calling `isCharacterComplete` /
 * `deriveSubclassUnlockSteps` / `recomputeCharacter` directly against real SRD data
 * (`src/server/load-srd-engine-data.js`): complete === true, unlockSteps === 2, maxHp 7,
 * maxStress 8, maxHope 6, maxArmor 3, evasion 16, tier 4.
 */

const STANDARD_TRAITS = { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: 0, knowledge: -1 };

/**
 * Rogue / Syndicate at level 8 with fully populated advancement rows (same completeness
 * requirements documented in subclass-cast.js's Bard/Troubadour and Rogue/Nightwalker builders).
 * Two `subclass_upgrade` picks (levels 5 and 8) unlock all three Syndicate tiers: Well-Connected
 * (Foundation), Contacts Everywhere (Foundation — SRD lists it at Foundation alongside
 * Well-Connected), and Reliable Backup (Mastery).
 */
export function buildRogueSyndicateCharacterData({ name = 'Vex', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-rogue',
    subclassId: 'srd-sub-syndicate',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-underborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
    advancements: {
      2: {
        domainCardId: 'srd-abl-rain-of-blades',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-uncanny-disguise',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-enrapture',
        picks: [{ type: 'experience', experienceIds: ['vex-e1', 'vex-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-tell-no-lies',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-troublemaker',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-midnight-spirit',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-shadowbind',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-dagger',
    secondaryWeaponId: 'srd-wpn-small-dagger',
    armorId: 'srd-arm-gambeson-armor',
    abilityIds: ['srd-abl-deft-deceiver', 'srd-abl-pick-and-pull'],
    experiences: [
      { id: 'vex-e1', name: 'Fence for Stolen Goods', score: 2 },
      { id: 'vex-e2', name: 'Silver Tongue', score: 2 },
      { id: 'vex-e3', name: 'Underworld Contacts', score: 2 },
      { id: 'vex-e4', name: 'Read a Room', score: 2 },
      { id: 'vex-e5', name: 'Escape Artist', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-deft-deceiver',
      'srd-abl-pick-and-pull',
      'srd-abl-rain-of-blades',
      'srd-abl-uncanny-disguise',
      'srd-abl-enrapture',
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Informational only — derived by `recomputeCharacter` at render time (verified: maxHp 7,
    // maxStress 8, maxHope 6, maxArmor 3, evasion 16, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}
