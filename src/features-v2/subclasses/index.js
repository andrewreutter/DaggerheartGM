import { GiftedPerformer, Maestro, Virtuoso } from './Troubadour.js';
import { Courage, BattleRitual, RiseToTheChallenge, Camaraderie } from './CallOfTheBrave.js';
import { RousingSpeech, HeartOfAPoet, Eloquent, EpicPoetry } from './Wordsmith.js';
import {
  Unwavering,
  Unrelenting,
  Undaunted,
  IronWill,
  PartnersInArms,
  LoyalProtector,
} from './Stalwart.js';
import { AtEase, Revenge, ActOfReprisal, Nemesis } from './Vengeance.js';
import {
  ShadowStepper,
  DarkCloud,
  Adrenaline,
  FleetingShadow,
  VanishingAct,
} from './Nightwalker.js';
import {
  ClarityOfNature,
  Regeneration,
  RegenerativeReach,
  WardensProtection,
  Defender,
} from './WardenOfRenewal.js';
import { WARDEN_OF_THE_ELEMENTS_SCOPE_KEY } from '../engine/feature-scope-keys.js';
import { ElementalIncarnation, ElementalAura, ElementalDominion } from './WardenOfTheElements.js';
import { WellConnected, ContactsEverywhere, ReliableBackup } from './Syndicate.js';
import {
  Companion,
  ExpertTraining,
  BattleBonded,
  AdvancedTraining,
  LoyalFriend,
} from './Beastbound.js';
import { RuthlessPredator, PathForward, ElusivePredator, ApexPredator } from './Wayfinder.js';
import { SpiritWeapon, SparingTouch, Devout, SacredResonance } from './DivineWielder.js';
import { Elementalist, NaturalEvasion, Transcendence } from './ElementalOrigin.js';
import { ManipulateMagic, EnchantedAid, ArcaneCharge } from './PrimalOrigin.js';
import { WingsOfLight, EtherealVisage, Ascendant, PowerOfTheGods } from './WingedSentinel.js';
import { Slayer, WeaponSpecialist, MartialPreparation } from './CallOfTheSlayer.js';
import {
  Prepared,
  Adept,
  Accomplished,
  PerfectRecall,
  Brilliant,
  HonedExpertise,
} from './SchoolOfKnowledge.js';
import {
  Battlemage,
  FaceYourFear,
  ConjureShield,
  FueledByFear,
  ThriveInChaos,
  HaveNoFear,
} from './SchoolOfWar.js';

export default {
  'srd-sub-troubadour': {
    name: 'Troubadour',
    features: [GiftedPerformer, Maestro, Virtuoso],
  },
  'srd-sub-call-of-the-brave': {
    name: 'Call of the Brave',
    features: [Courage, BattleRitual, RiseToTheChallenge, Camaraderie],
  },
  'srd-sub-wordsmith': {
    name: 'Wordsmith',
    features: [RousingSpeech, HeartOfAPoet, Eloquent, EpicPoetry],
  },
  'srd-sub-stalwart': {
    name: 'Stalwart',
    features: [Unwavering, Unrelenting, Undaunted, IronWill, PartnersInArms, LoyalProtector],
  },
  'srd-sub-nightwalker': {
    name: 'Nightwalker',
    sourceScopeKey: 'Nightwalker',
    features: [ShadowStepper, DarkCloud, Adrenaline, FleetingShadow, VanishingAct],
  },
  'srd-sub-vengeance': {
    name: 'Vengeance',
    features: [AtEase, Revenge, ActOfReprisal, Nemesis],
  },
  'srd-sub-warden-of-renewal': {
    name: 'Warden of Renewal',
    features: [ClarityOfNature, Regeneration, RegenerativeReach, WardensProtection, Defender],
  },
  'srd-sub-warden-of-the-elements': {
    name: 'Warden of the Elements',
    // Shared featureState bag: table.source.get / table.source.set in features
    sourceScopeKey: WARDEN_OF_THE_ELEMENTS_SCOPE_KEY,
    features: [ElementalIncarnation, ElementalAura, ElementalDominion],
  },
  'srd-sub-syndicate': {
    name: 'Syndicate',
    features: [WellConnected, ContactsEverywhere, ReliableBackup],
  },
  'srd-sub-beastbound': {
    name: 'Beastbound',
    features: [Companion, ExpertTraining, BattleBonded, AdvancedTraining, LoyalFriend],
  },
  'srd-sub-wayfinder': {
    name: 'Wayfinder',
    features: [RuthlessPredator, PathForward, ElusivePredator, ApexPredator],
  },
  'srd-sub-divine-wielder': {
    name: 'Divine Wielder',
    features: [SpiritWeapon, SparingTouch, Devout, SacredResonance],
  },
  'srd-sub-elemental-origin': {
    name: 'Elemental Origin',
    sourceScopeKey: 'ElementalOrigin',
    features: [Elementalist, NaturalEvasion, Transcendence],
  },
  'srd-sub-primal-origin': {
    name: 'Primal Origin',
    sourceScopeKey: 'PrimalOrigin',
    features: [ManipulateMagic, EnchantedAid, ArcaneCharge],
  },
  'srd-sub-winged-sentinel': {
    name: 'Winged Sentinel',
    sourceScopeKey: 'WingedSentinel',
    features: [WingsOfLight, EtherealVisage, Ascendant, PowerOfTheGods],
  },
  'srd-sub-call-of-the-slayer': {
    name: 'Call of the Slayer',
    sourceScopeKey: 'CallOfTheSlayer',
    features: [Slayer, WeaponSpecialist, MartialPreparation],
  },
  'srd-sub-school-of-knowledge': {
    name: 'School of Knowledge',
    sourceScopeKey: 'SchoolOfKnowledge',
    features: [Prepared, Adept, Accomplished, PerfectRecall, Brilliant, HonedExpertise],
  },
  'srd-sub-school-of-war': {
    name: 'School of War',
    sourceScopeKey: 'SchoolOfWar',
    features: [Battlemage, FaceYourFear, ConjureShield, FueledByFear, ThriveInChaos, HaveNoFear],
  },
};
