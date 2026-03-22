import { Beastform, Evolution, Wildtouch } from './Druid.js';
import { MakeAScene, Rally } from './Bard.js';
import { FrontlineTank, Unstoppable } from './Guardian.js';
import { HoldThemOff, RangersFocus } from './Ranger.js';
import { RoguesDodge, Cloaked, SneakAttack } from './Rogue.js';
import { LifeSupport, PrayerDice } from './Seraph.js';
import { ArcaneSense, ChannelRawPower, MinorIllusion, VolatileMagic } from './Sorcerer.js';
import { NoMercy, AttackOfOpportunity, CombatTraining } from './Warrior.js';
import { NotThisTime, Prestidigitation, StrangePatterns } from './Wizard.js';

export default {
  'srd-cls-bard': {
    name: 'Bard',
    features: [MakeAScene, Rally],
  },
  'srd-cls-druid': {
    name: 'Druid',
    features: [Evolution, Beastform, Wildtouch],
  },
  'srd-cls-guardian': {
    name: 'Guardian',
    features: [FrontlineTank, Unstoppable],
  },
  'srd-cls-ranger': {
    name: 'Ranger',
    features: [HoldThemOff, RangersFocus],
  },
  'srd-cls-rogue': {
    name: 'Rogue',
    features: [RoguesDodge, Cloaked, SneakAttack],
  },
  'srd-cls-seraph': {
    name: 'Seraph',
    features: [LifeSupport, PrayerDice],
  },
  'srd-cls-sorcerer': {
    name: 'Sorcerer',
    features: [VolatileMagic, ArcaneSense, MinorIllusion, ChannelRawPower],
  },
  'srd-cls-warrior': {
    name: 'Warrior',
    features: [NoMercy, AttackOfOpportunity, CombatTraining],
  },
  'srd-cls-wizard': {
    name: 'Wizard',
    features: [NotThisTime, Prestidigitation, StrangePatterns],
  },
};
