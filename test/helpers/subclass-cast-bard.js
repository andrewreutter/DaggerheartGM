/**
 * Subclass feature video test suite — Bard/Wordsmith character factory.
 *
 * New file (does not edit test/helpers/subclass-cast.js, which is shared/owned by other
 * concurrent work). Mirrors the shape and completeness requirements of
 * `buildBardTroubadourCharacterData` in subclass-cast.js — see that file's doc comment for
 * why every advancement row must be fully populated with two picks each, and why one
 * `subclass_upgrade` pick must land in Band B (level 5) and one in Band C (level 8).
 */

const STANDARD_TRAITS = { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 };

/**
 * Bard / Wordsmith at level 8 with fully populated advancement rows (levels 2-8, two picks
 * each + a per-row domain card) so `isCharacterComplete` returns `true`. Advancement picks
 * explicitly include one `subclass_upgrade` in Band B (level 5) and one in Band C (level 8)
 * so `deriveSubclassUnlockSteps` returns `2` (Foundation + Specialization + Mastery all
 * unlocked — Rousing Speech + Heart of a Poet, Eloquent, Epic Poetry).
 *
 * Verified with a throwaway script (scripts/_verify-wordsmith-throwaway.mjs, deleted after
 * verification — see repo policy) calling `isCharacterComplete` / `deriveSubclassUnlockSteps` /
 * `recomputeCharacter` directly: complete: true, missing: [], unlock steps: 2, derived stats
 * maxHp 6, maxStress 7, maxHope 6, maxArmor 3, evasion 14, tier 4.
 */
export function buildBardWordsmithCharacterData({ name = 'Callie', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-bard',
    subclassId: 'srd-sub-wordsmith',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
    advancements: {
      2: {
        domainCardId: 'srd-abl-tell-no-lies',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-book-of-korvax',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-soothing-speech',
        picks: [{ type: 'experience', experienceIds: ['callie-e1', 'callie-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-manifest-wall',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-never-upstaged',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-book-of-homet',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-mass-enrapture',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-rapier',
    secondaryWeaponId: 'srd-wpn-shortsword',
    armorId: 'srd-arm-gambeson-armor',
    abilityIds: ['srd-abl-inspirational-words', 'srd-abl-book-of-ava'],
    experiences: [
      { id: 'callie-e1', name: 'Court Intrigue', score: 2 },
      { id: 'callie-e2', name: 'Street Performance', score: 2 },
      { id: 'callie-e3', name: 'Silver Tongue', score: 2 },
      { id: 'callie-e4', name: 'Old Contacts', score: 2 },
      { id: 'callie-e5', name: 'Backstage Pass', score: 2 },
    ],
    // 9 owned domain cards total (2 starting + 7 advancement rows) > 5, so a `domainLoadoutIds`
    // pick of exactly 5 distinct owned ids is required for completeness.
    domainLoadoutIds: [
      'srd-abl-inspirational-words',
      'srd-abl-book-of-ava',
      'srd-abl-tell-no-lies',
      'srd-abl-book-of-korvax',
      'srd-abl-soothing-speech',
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Informational only — `recomputeCharacter` derives the real values from SRD data +
    // advancement picks (verified via the generator script: maxHp 6, maxStress 7, maxHope 6,
    // maxArmor 3 from Gambeson Armor's base_score). Keep these consistent with the derived
    // values so table-element seed data (`currentHp`, etc.) in the spec reads naturally
    // relative to them.
    maxHp: 6,
    maxStress: 7,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}
