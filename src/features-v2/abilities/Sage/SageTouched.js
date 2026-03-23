/**
 * Sage domain — Sage-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Sage-Touched.md
 */

import { when, isActing } from '../../engine/when.js';

function sageDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'sage').length;
}

function sageTouchedActive(table) {
  return sageDomainCardsInLoadout(table) >= 4;
}

function traitSpellcastBonus(table, traitKey) {
  const sk = table.me?.spellcastTrait;
  if (!sk) return 0;
  if (String(sk).toLowerCase() !== traitKey) return 0;
  return 2;
}

export const SageTouched = {
  name: 'Sage-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Sage domain, gain the following benefits:\n\n- While you\'re in a natural environment, you gain a +2 bonus to your Spellcast Rolls.\n- Once per rest, you can double your Agility or Instinct when making a roll that uses that trait. You must choose to do this before you roll.',
  passiveStatMods: when(
    (table) => sageTouchedActive(table) && table.feature.get('naturalEnvironment') === true,
    {
      agility: (table) => traitSpellcastBonus(table, 'agility'),
      strength: (table) => traitSpellcastBonus(table, 'strength'),
      finesse: (table) => traitSpellcastBonus(table, 'finesse'),
      instinct: (table) => traitSpellcastBonus(table, 'instinct'),
      presence: (table) => traitSpellcastBonus(table, 'presence'),
      knowledge: (table) => traitSpellcastBonus(table, 'knowledge'),
    }
  ),
  chips: [
    when(sageTouchedActive, {
      placements: ['card'],
      name: 'Natural environment',
      description:
        'Toggle on while you are in a natural environment (forests, rivers, caves, etc.—GM). Required for the +2 Spellcast bonus.',
      isToggle: true,
      onUse(table, chipState) {
        table.feature.set('naturalEnvironment', chipState.isOn);
      },
    }),
    when(
      isActing,
      sageTouchedActive,
      (table) => {
        const t = String(table.action?.trait || '').toLowerCase();
        return t === 'agility' || t === 'instinct';
      },
      {
        name: 'Sage-Touched — Double trait',
        placements: ['intent'],
        frequency: 'rest',
        description:
          'Once per rest, add your Agility or Instinct score again to this roll (the trait this roll uses). Choose before rolling.',
        onUse(table) {
          const t = String(table.action?.trait || '').toLowerCase();
          const traits = table.me?.traits || {};
          const bonus =
            t === 'agility'
              ? Number(traits.agility) || 0
              : t === 'instinct'
                ? Number(traits.instinct) || 0
                : 0;
          table.rolls?.action?.addStatic?.({ name: 'Sage-Touched (double trait)', value: bonus });
        },
      }
    ),
  ],
};
