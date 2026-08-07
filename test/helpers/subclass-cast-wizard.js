/**
 * Subclass feature video test suite — Wizard character factories.
 *
 * Separate from `subclass-cast.js` so concurrent class-spec agents do not collide.
 * Completeness / unlock requirements match `buildBardTroubadourCharacterData` (level 8,
 * full advancements, one `subclass_upgrade` in Band B and one in Band C).
 *
 * Verified via `scripts/_verify-wizard-throwaway.mjs`: complete, unlockSteps 2,
 * spellcastTrait knowledge, maxHp 6, maxStress 8, maxHope 6, maxArmor 3, evasion 14,
 * proficiency 4, tier 4. (School of War **Battlemage** +1 max HP is applied via the
 * V2 declarative sheet overlay at table render time — `recomputeCharacter` alone may
 * still report base 6 when the `maxHP` key casing is not normalized on that path.)
 */

const WIZARD_TRAITS = { agility: 0, strength: -1, finesse: 1, instinct: 1, presence: 0, knowledge: 2 };

const WIZARD_ADVANCEMENT_CARDS = [
  'srd-abl-book-of-sitil',
  'srd-abl-final-words',
  'srd-abl-book-of-korvax',
  'srd-abl-second-wind',
  'srd-abl-book-of-exota',
  'srd-abl-divination',
  'srd-abl-manifest-wall',
];

const WIZARD_STARTING = ['srd-abl-book-of-ava', 'srd-abl-bolt-beacon'];

function buildWizardAdvancements(expIds) {
  const cards = WIZARD_ADVANCEMENT_CARDS;
  return {
    2: {
      domainCardId: cards[0],
      picks: [
        { type: 'traits', traits: ['knowledge', 'finesse'] },
        { type: 'traits', traits: ['instinct', 'agility'] },
      ],
    },
    3: {
      domainCardId: cards[1],
      picks: [{ type: 'traits', traits: ['presence', 'strength'] }, { type: 'evasion' }],
    },
    4: {
      domainCardId: cards[2],
      picks: [{ type: 'experience', experienceIds: expIds }, { type: 'hp' }],
    },
    5: {
      domainCardId: cards[3],
      picks: [{ type: 'subclass_upgrade' }, { type: 'traits', traits: ['knowledge', 'finesse'] }],
    },
    6: {
      domainCardId: cards[4],
      picks: [{ type: 'traits', traits: ['instinct', 'agility'] }, { type: 'evasion' }],
    },
    7: {
      domainCardId: cards[5],
      picks: [{ type: 'traits', traits: ['presence', 'strength'] }, { type: 'stress' }],
    },
    8: {
      domainCardId: cards[6],
      picks: [{ type: 'subclass_upgrade' }, { type: 'evasion' }],
    },
  };
}

function buildWizardBase({ name, subclassId, expPrefix }) {
  const e1 = `${expPrefix}-e1`;
  const e2 = `${expPrefix}-e2`;
  return {
    name,
    classId: 'srd-cls-wizard',
    subclassId,
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: WIZARD_TRAITS,
    advancements: buildWizardAdvancements([e1, e2]),
    primaryWeaponId: 'srd-wpn-greatstaff',
    armorId: 'srd-arm-leather-armor',
    abilityIds: WIZARD_STARTING,
    experiences: [
      { id: e1, name: 'Arcane Theory', score: 2 },
      { id: e2, name: 'Library Stacks', score: 2 },
      { id: `${expPrefix}-e3`, name: 'Quick Study', score: 2 },
      { id: `${expPrefix}-e4`, name: 'Old Grimoire', score: 2 },
      { id: `${expPrefix}-e5`, name: 'Rival Academy', score: 2 },
    ],
    domainLoadoutIds: [
      ...WIZARD_STARTING,
      WIZARD_ADVANCEMENT_CARDS[0],
      WIZARD_ADVANCEMENT_CARDS[1],
      WIZARD_ADVANCEMENT_CARDS[2],
    ],
    advancementChoicesLockedThroughLevel: 8,
    maxHp: 6,
    maxStress: 8,
    maxHope: 6,
    maxArmor: 3,
  };
}

/**
 * Wizard / School of Knowledge at level 8 — Prepared, Adept, Perfect Recall,
 * Accomplished, Brilliant, Honed Expertise (+ Wizard class features).
 */
export function buildWizardSchoolOfKnowledgeCharacterData({ name = 'Quill', overrides = {} } = {}) {
  return {
    ...buildWizardBase({
      name,
      subclassId: 'srd-sub-school-of-knowledge',
      expPrefix: 'quill',
    }),
    ...overrides,
  };
}

/**
 * Wizard / School of War at level 8 — Battlemage, Face Your Fear, Conjure Shield,
 * Fueled by Fear, Thrive in Chaos, Have No Fear (+ Wizard class features).
 */
export function buildWizardSchoolOfWarCharacterData({ name = 'Hex', overrides = {} } = {}) {
  return {
    ...buildWizardBase({
      name,
      subclassId: 'srd-sub-school-of-war',
      expPrefix: 'hex',
    }),
    ...overrides,
  };
}
