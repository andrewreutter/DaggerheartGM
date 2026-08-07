/**
 * Subclass feature video test suite — per-class character data factories.
 *
 * Produces raw library `characters` payloads (same shape `createLibraryCharacter` from
 * test/helpers/multi-auth.js PUTs to `/api/data/characters`) at a level where every subclass
 * tier is unlocked, plus a plain ally PC for multi-user coverage. Reuses the data shapes from
 * scripts/seed-v2-browser-test-characters.mjs.
 *
 * `recomputeCharacter` (client-side) derives everything else at render time — the server does
 * not need pre-computed stats, only the raw builder fields (classId, subclassId, level, etc.).
 *
 * Ranger factories live in `subclass-cast-ranger.js` and are re-exported below for discoverability.
 */

export {
  buildRangerBeastboundCharacterData,
  buildRangerWayfinderCharacterData,
} from './subclass-cast-ranger.js';

export { buildBardWordsmithCharacterData } from './subclass-cast-bard.js';

const STANDARD_TRAITS = { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 };

/**
 * A plain, class-less ally PC used for multi-user coverage (cross-sheet chips, targets, etc.)
 * when the subclass under test doesn't care what the ally's own class is.
 */
export function buildAllyCharacterData({ name = 'Ally PC', overrides = {} } = {}) {
  return {
    name,
    // `baseTraits` gives the ally a clickable trait score on the sheet — needed for tests that
    // trigger an action roll (e.g. to surface a `reviewAction` chip like Bard "Spend Rally Die").
    baseTraits: STANDARD_TRAITS,
    maxHp: 6,
    maxStress: 6,
    maxHope: 6,
    maxArmor: 0,
    ...overrides,
  };
}

/**
 * Bard / Troubadour at level 8 with **fully populated advancement rows** (levels 2–8, two picks
 * each + a per-row domain card) so `isCharacterComplete` returns `true` — an incomplete character
 * auto-opens the editor instead of the normal hover-card sheet when clicked on the Game Table
 * (see `src/client/lib/game-table-incomplete-character-auto-editor.js`), which breaks feature-chip
 * interaction in this suite.
 *
 * Advancement picks explicitly include one `subclass_upgrade` in Band B (level 5) and one in
 * Band C (level 8) so `deriveSubclassUnlockSteps` returns `2` (Foundation + Specialization +
 * Mastery all unlocked — Gifted Performer, Maestro, Virtuoso) — with rows filled in but *no*
 * `subclass_upgrade` picks, the legacy tier-based fallback is disabled and the subclass would be
 * capped at Foundation only. Generated with a throwaway script that calls `recomputeCharacter` /
 * `isCharacterComplete` / `deriveSubclassUnlockSteps` directly to verify completeness and derived
 * stats (maxHp 6, maxStress 8, maxHope 6, maxArmor 3, evasion 14, tier 4) before being pasted here.
 */
export function buildBardTroubadourCharacterData({ name = 'Brix', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-bard',
    subclassId: 'srd-sub-troubadour',
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
        picks: [{ type: 'experience', experienceIds: ['brix-e1', 'brix-e2'] }, { type: 'hp' }],
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
      { id: 'brix-e1', name: 'Court Intrigue', score: 2 },
      { id: 'brix-e2', name: 'Street Performance', score: 2 },
      { id: 'brix-e3', name: 'Silver Tongue', score: 2 },
      { id: 'brix-e4', name: 'Old Contacts', score: 2 },
      { id: 'brix-e5', name: 'Backstage Pass', score: 2 },
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
    // advancement picks (verified via the generator script: maxHp 6, maxStress 8, maxHope 6,
    // maxArmor 3 from Gambeson Armor's base_score). Keep these consistent with the derived
    // values so table-element seed data (`currentHp`, etc.) in the spec reads naturally
    // relative to them.
    maxHp: 6,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}

/**
 * Rogue / Nightwalker at level 8 with fully populated advancement rows (same completeness
 * requirements as {@link buildBardTroubadourCharacterData} — see that doc comment). Two
 * `subclass_upgrade` picks (levels 5 and 8) unlock all three Nightwalker tiers (Shadow
 * Stepper + Dark Cloud, Adrenaline, Fleeting Shadow + Vanishing Act).
 *
 * Verified with a throwaway script calling `isCharacterComplete` / `deriveSubclassUnlockSteps` /
 * `recomputeCharacter` directly: complete, unlockSteps 2, maxHp 7, maxStress 8, maxHope 6,
 * maxArmor 3, evasion 17, tier 4.
 */
export function buildRogueNightwalkerCharacterData({ name = 'Nyx', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-rogue',
    subclassId: 'srd-sub-nightwalker',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: { agility: 1, strength: -1, finesse: 2, instinct: 0, presence: 1, knowledge: 0 },
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
        picks: [{ type: 'experience', experienceIds: ['nyx-e1', 'nyx-e2'] }, { type: 'hp' }],
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
      { id: 'nyx-e1', name: 'Cat Burglar', score: 2 },
      { id: 'nyx-e2', name: 'Silver Tongue', score: 2 },
      { id: 'nyx-e3', name: 'Streetwise', score: 2 },
      { id: 'nyx-e4', name: 'Lock Picking', score: 2 },
      { id: 'nyx-e5', name: 'Underworld Contacts', score: 2 },
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
    // maxStress 8, maxHope 6, maxArmor 3, evasion 17, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}

/**
 * Guardian / Stalwart at level 8 with fully populated advancement rows (same completeness
 * requirements as {@link buildBardTroubadourCharacterData}). Two `subclass_upgrade` picks
 * unlock Unwavering + Iron Will (Foundation), Unrelenting + Partners-in-Arms (Specialization),
 * and Undaunted + Loyal Protector (Mastery), plus class features Frontline Tank / Unstoppable.
 *
 * Verified via throwaway `recomputeCharacter` / `isCharacterComplete` /
 * `deriveSubclassUnlockSteps`: complete, unlockSteps 2, maxHp 8, maxStress 8, maxHope 6,
 * maxArmor 4 (Chainmail), evasion 11, tier 4.
 */
export function buildGuardianStalwartCharacterData({ name = 'Dara', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-guardian',
    subclassId: 'srd-sub-stalwart',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-orderborne',
    level: 8,
    baseTraits: { agility: 1, strength: 2, finesse: 0, instinct: 1, presence: 0, knowledge: -1 },
    advancements: {
      2: {
        domainCardId: 'srd-abl-body-basher',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-lean-on-me',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-support-tank',
        picks: [{ type: 'experience', experienceIds: ['dara-e1', 'dara-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-rousing-strike',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-rise-up',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-shrug-it-off',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-full-surge',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-battleaxe',
    armorId: 'srd-arm-chainmail-armor',
    // Avoid I Am Your Shield — its ally-damage reviewAction chip would compete with
    // Partners-in-Arms / Loyal Protector on the same banner in the video suite.
    abilityIds: ['srd-abl-bare-bones', 'srd-abl-get-back-up'],
    experiences: [
      { id: 'dara-e1', name: 'Shield Wall Veteran', score: 2 },
      { id: 'dara-e2', name: 'Field Medic', score: 2 },
      { id: 'dara-e3', name: 'Hold the Gate', score: 2 },
      { id: 'dara-e4', name: 'Last Stand', score: 2 },
      { id: 'dara-e5', name: 'Orderbound Duty', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-bare-bones',
      'srd-abl-get-back-up',
      'srd-abl-body-basher',
      'srd-abl-lean-on-me',
      'srd-abl-support-tank',
    ],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 8,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}

/**
 * Guardian / Vengeance at level 8 — same advancement shape as Stalwart. Unlocks At Ease +
 * Revenge (Foundation), Act of Reprisal (Specialization), Nemesis (Mastery), plus Frontline
 * Tank / Unstoppable. At Ease adds +1 max Stress (verified: maxStress 9).
 */
export function buildGuardianVengeanceCharacterData({ name = 'Voss', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-guardian',
    subclassId: 'srd-sub-vengeance',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-orderborne',
    level: 8,
    baseTraits: { agility: 1, strength: 2, finesse: 0, instinct: 1, presence: 0, knowledge: -1 },
    advancements: {
      2: {
        domainCardId: 'srd-abl-body-basher',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-lean-on-me',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-support-tank',
        picks: [{ type: 'experience', experienceIds: ['voss-e1', 'voss-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-rousing-strike',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-rise-up',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-shrug-it-off',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-full-surge',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-battleaxe',
    armorId: 'srd-arm-chainmail-armor',
    abilityIds: ['srd-abl-bare-bones', 'srd-abl-get-back-up'],
    experiences: [
      { id: 'voss-e1', name: 'Blood Feud', score: 2 },
      { id: 'voss-e2', name: 'Street Brawler', score: 2 },
      { id: 'voss-e3', name: 'Hold the Gate', score: 2 },
      { id: 'voss-e4', name: 'Last Stand', score: 2 },
      { id: 'voss-e5', name: 'Orderbound Duty', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-bare-bones',
      'srd-abl-get-back-up',
      'srd-abl-body-basher',
      'srd-abl-lean-on-me',
      'srd-abl-support-tank',
    ],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 8,
    maxStress: 9,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}

/**
 * Seraph / Divine Wielder at level 8 with fully populated advancement rows (same completeness
 * requirements as {@link buildBardTroubadourCharacterData}). Two `subclass_upgrade` picks
 * (levels 5 and 8) unlock Spirit Weapon + Sparing Touch, Devout, and Sacred Resonance.
 *
 * Spellcast trait is Strength (subclass override). Verified via
 * `scripts/_verify-seraph-throwaway.mjs`: complete, unlockSteps 2, maxHp 8, maxStress 8,
 * maxHope 6, maxArmor 4, evasion 11, tier 4, strength 4 (→ 4 Prayer Dice at session start).
 */
export function buildSeraphDivineWielderCharacterData({ name = 'Kael', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-seraph',
    subclassId: 'srd-sub-divine-wielder',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: { agility: 0, strength: 2, finesse: 0, instinct: 1, presence: 1, knowledge: -1 },
    advancements: {
      2: {
        domainCardId: 'srd-abl-final-words',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-second-wind',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-divination',
        picks: [{ type: 'experience', experienceIds: ['kael-e1', 'kael-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-smite',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-restoration',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-healing-strike',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-shield-aura',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-broadsword',
    armorId: 'srd-arm-chainmail-armor',
    abilityIds: ['srd-abl-mending-touch', 'srd-abl-bare-bones'],
    experiences: [
      { id: 'kael-e1', name: 'Battlefield Medic', score: 2 },
      { id: 'kael-e2', name: 'Righteous Fury', score: 2 },
      { id: 'kael-e3', name: 'Unshakable Faith', score: 2 },
      { id: 'kael-e4', name: 'Blade Dancer', score: 2 },
      { id: 'kael-e5', name: 'Silver Tongue', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-mending-touch',
      'srd-abl-bare-bones',
      'srd-abl-final-words',
      'srd-abl-second-wind',
      'srd-abl-divination',
    ],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 8,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}

/**
 * Seraph / Winged Sentinel at level 8 with fully populated advancement rows. Two
 * `subclass_upgrade` picks unlock Wings of Light + Ethereal Visage, Ascendant, and
 * Power of the Gods. Same verified derived stats as Divine Wielder (spellcast Strength).
 */
export function buildSeraphWingedSentinelCharacterData({ name = 'Elyra', overrides = {} } = {}) {
  return {
    name,
    classId: 'srd-cls-seraph',
    subclassId: 'srd-sub-winged-sentinel',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: { agility: 0, strength: 2, finesse: 0, instinct: 1, presence: 1, knowledge: -1 },
    advancements: {
      2: {
        domainCardId: 'srd-abl-healing-hands',
        picks: [
          { type: 'traits', traits: ['agility', 'strength'] },
          { type: 'traits', traits: ['finesse', 'instinct'] },
        ],
      },
      3: {
        domainCardId: 'srd-abl-voice-of-reason',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'evasion' }],
      },
      4: {
        domainCardId: 'srd-abl-life-ward',
        picks: [{ type: 'experience', experienceIds: ['elyra-e1', 'elyra-e2'] }, { type: 'hp' }],
      },
      5: {
        domainCardId: 'srd-abl-shape-material',
        picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['agility', 'strength'] }],
      },
      6: {
        domainCardId: 'srd-abl-zone-of-protection',
        picks: [{ type: 'traits', traits: ['finesse', 'instinct'] }, { type: 'evasion' }],
      },
      7: {
        domainCardId: 'srd-abl-splendor-touched',
        picks: [{ type: 'traits', traits: ['presence', 'knowledge'] }, { type: 'stress' }],
      },
      8: {
        domainCardId: 'srd-abl-stunning-sunlight',
        picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
      },
    },
    primaryWeaponId: 'srd-wpn-broadsword',
    armorId: 'srd-arm-chainmail-armor',
    abilityIds: ['srd-abl-bolt-beacon', 'srd-abl-reassurance'],
    experiences: [
      { id: 'elyra-e1', name: 'Skyward Sentinel', score: 2 },
      { id: 'elyra-e2', name: 'Righteous Fury', score: 2 },
      { id: 'elyra-e3', name: 'Unshakable Faith', score: 2 },
      { id: 'elyra-e4', name: 'Blade Dancer', score: 2 },
      { id: 'elyra-e5', name: 'Silver Tongue', score: 2 },
    ],
    domainLoadoutIds: [
      'srd-abl-bolt-beacon',
      'srd-abl-reassurance',
      'srd-abl-healing-hands',
      'srd-abl-voice-of-reason',
      'srd-abl-life-ward',
    ],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 8,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 4,
    ...overrides,
  };
}
