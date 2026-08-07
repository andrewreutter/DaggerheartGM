import { getCollection, warmCache } from '../src/srd/index.js';
import { recomputeCharacter, isCharacterComplete } from '../src/client/lib/character-calc.js';
import { deriveSubclassUnlockSteps } from '../src/client/lib/advancement-rules.js';

const STANDARD_TRAITS = { agility: 0, strength: 2, finesse: 0, instinct: 1, presence: 1, knowledge: -1 };

function buildDivineWielder() {
  return {
    name: 'Kael',
    classId: 'srd-cls-seraph',
    subclassId: 'srd-sub-divine-wielder',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
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
  };
}

function buildWingedSentinel() {
  return {
    name: 'Elyra',
    classId: 'srd-cls-seraph',
    subclassId: 'srd-sub-winged-sentinel',
    ancestryIds: ['srd-anc-human'],
    communityId: 'srd-com-highborne',
    level: 8,
    baseTraits: STANDARD_TRAITS,
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
  };
}

async function main() {
  await warmCache();
  const srdData = {};
  for (const name of ['classes', 'subclasses', 'ancestries', 'communities', 'armor', 'weapons', 'abilities', 'domains', 'beastforms']) {
    const items = await getCollection(name);
    srdData[`${name}ById`] = Object.fromEntries(items.map((i) => [i.id, i]));
    srdData[name] = items;
  }

  for (const [label, builder] of [['Divine Wielder (Kael)', buildDivineWielder], ['Winged Sentinel (Elyra)', buildWingedSentinel]]) {
    const raw = builder();
    const computed = recomputeCharacter(raw, srdData);
    const merged = { ...raw, ...computed };
    const complete = isCharacterComplete(merged, { srdData });
    const unlockSteps = deriveSubclassUnlockSteps({ advancements: raw.advancements, level: raw.level, tier: computed.tier });
    console.log(`\n=== ${label} ===`);
    console.log('complete:', complete);
    console.log('unlockSteps:', unlockSteps);
    console.log('spellcastTrait:', computed.spellcastTrait);
    console.log('maxHp:', computed.maxHp, 'maxStress:', computed.maxStress, 'maxHope:', computed.maxHope, 'maxArmor:', computed.maxArmor);
    console.log('evasion:', computed.evasion, 'tier:', computed.tier);
    console.log('traits:', computed.traits);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
