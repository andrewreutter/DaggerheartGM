/**
 * Subclass feature video test suite — Sorcerer character data factories
 * (Elemental Origin + Primal Origin).
 *
 * Same shape/verification workflow as `test/helpers/subclass-cast.js`'s Bard/Rogue
 * factories — level 8, fully populated `advancements['2'..'8']` (two picks each), one
 * `subclass_upgrade` in Band B (level 5) and one in Band C (level 8) so
 * `deriveSubclassUnlockSteps` returns `2`, 5 named experiences, and a
 * `domainLoadoutIds` array of exactly 5 distinct owned ids.
 *
 * Verified with `scripts/_verify-sorcerer-throwaway.mjs`:
 * both characters `complete: true`, unlockSteps `2`, maxHp 7, maxStress 8, maxHope 6,
 * maxArmor 3, evasion 14, tier 4, spellcastTrait `instinct`.
 *
 * Dualstaff (Instinct, Far, `d6+3 mag`) matches the Sorcerer spellcast trait and produces
 * magic-damage sub-items for Volatile Magic / Arcane Charge discharge. Primal Origin's
 * `weaponDealsMagicDamage` only matches `/magic/i` or Otherworldly features — Dualstaff's
 * `"mag"` abbreviation does **not** qualify — so Manipulate Magic intent is exercised via
 * Spellcast rolls (`action.type === 'spellcast'`), not weapon attacks.
 */

const SORCERER_TRAITS = { agility: 0, strength: 0, finesse: 1, instinct: 2, presence: 1, knowledge: -1 };

const ARCANA_HEAVY_CARDS = [
  'srd-abl-cinder-grasp',
  'srd-abl-counterspell',
  'srd-abl-blink-out',
  'srd-abl-chain-lightning',
  'srd-abl-rift-walker',
  'srd-abl-arcana-touched',
  'srd-abl-confusing-aura',
];

const STARTING_ABILITIES = ['srd-abl-rune-ward', 'srd-abl-wall-walk'];

function buildSorcererAdvancements(cards) {
  return {
    2: {
      domainCardId: cards[0],
      picks: [
        { type: 'traits', traits: ['instinct', 'presence'] },
        { type: 'traits', traits: ['finesse', 'agility'] },
      ],
    },
    3: {
      domainCardId: cards[1],
      picks: [{ type: 'traits', traits: ['knowledge', 'strength'] }, { type: 'evasion' }],
    },
    4: {
      domainCardId: cards[2],
      picks: [{ type: 'experience', experienceIds: ['e1', 'e2'] }, { type: 'hp' }],
    },
    5: {
      domainCardId: cards[3],
      picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['instinct', 'presence'] }],
    },
    6: {
      domainCardId: cards[4],
      picks: [{ type: 'traits', traits: ['finesse', 'agility'] }, { type: 'evasion' }],
    },
    7: {
      domainCardId: cards[5],
      picks: [{ type: 'traits', traits: ['knowledge', 'strength'] }, { type: 'stress' }],
    },
    8: {
      domainCardId: cards[6],
      picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
    },
  };
}

function buildSorcererBase({ name, subclassId, overrides = {} }) {
  return {
    name,
    classId: 'srd-cls-sorcerer',
    subclassId,
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: SORCERER_TRAITS,
    advancements: buildSorcererAdvancements(ARCANA_HEAVY_CARDS),
    primaryWeaponId: 'srd-wpn-dualstaff',
    armorId: 'srd-arm-gambeson-armor',
    abilityIds: [...STARTING_ABILITIES],
    experiences: [
      { id: 'e1', name: 'Arcane Theory', score: 2 },
      { id: 'e2', name: 'Street Smarts', score: 2 },
      { id: 'e3', name: 'Steady Hands', score: 2 },
      { id: 'e4', name: 'Old Family Grimoire', score: 2 },
      { id: 'e5', name: 'Quick Study', score: 2 },
    ],
    domainLoadoutIds: [...STARTING_ABILITIES, ARCANA_HEAVY_CARDS[0], ARCANA_HEAVY_CARDS[1], ARCANA_HEAVY_CARDS[2]],
    // Hydrated loadout objects for V2 `table.me.domainLoadout` (Channel Raw Power). The Game
    // Table does not yet derive this array from `domainLoadoutIds`/`abilities` alone — see
    // docs/v2-game-table-cutover-remaining.md — so seed it explicitly. Primal Origin video
    // walks the Actions CustomSelect Hope path against this seed.
    domainLoadout: [
      { id: 'srd-abl-rune-ward', name: 'Rune Ward', level: 1 },
      { id: 'srd-abl-wall-walk', name: 'Wall Walk', level: 1 },
      { id: 'srd-abl-cinder-grasp', name: 'Cinder Grasp', level: 2 },
      { id: 'srd-abl-counterspell', name: 'Counterspell', level: 3 },
      { id: 'srd-abl-blink-out', name: 'Blink Out', level: 4 },
    ],
    advancementChoicesLockedThroughLevel: 8,
    // Informational only — derived by `recomputeCharacter` (verified: maxHp 7, maxStress 8,
    // maxHope 6, maxArmor 3, evasion 14, tier 4).
    maxHp: 7,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
    ...overrides,
  };
}

/**
 * Sorcerer / Elemental Origin at level 8 (Elementalist + Natural Evasion + Transcendence).
 * Element affinity is pre-seeded on the table element as
 * `featureState.ElementalOrigin.element` — the create-placement chip is not rendered on the
 * Game Table (character-creation-only).
 */
export function buildSorcererElementalOriginCharacterData({ name = 'Pyra', overrides = {} } = {}) {
  return buildSorcererBase({
    name,
    subclassId: 'srd-sub-elemental-origin',
    overrides,
  });
}

/**
 * Sorcerer / Primal Origin at level 8 (Manipulate Magic + Enchanted Aid + Arcane Charge).
 */
export function buildSorcererPrimalOriginCharacterData({ name = 'Vex', overrides = {} } = {}) {
  return buildSorcererBase({
    name,
    subclassId: 'srd-sub-primal-origin',
    overrides,
  });
}
