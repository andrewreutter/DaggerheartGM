/**
 * Midnight domain — Mass Disguise (SRD level 6 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when } from '../../engine/when.js';

function closeBand(band) {
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

function targetsInCloseRange(table) {
  return (table.characters ?? []).filter((c) => closeBand(table.me.rangeFrom(c)));
}

function traitIsPresence(table) {
  return String(table.action?.trait ?? '').toLowerCase() === 'presence';
}

export const MassDisguise = {
  name: 'Mass Disguise',
  description:
    "When you have a few minutes of silence to focus, you can **mark a Stress** to change the appearance of all willing creatures within Close range. Their new forms must share a general body structure and size, and can be somebody or something you've seen before or entirely fabricated. A disguised creature has advantage on Presence Rolls to avoid scrutiny.\n\nActivate a Countdown (8). It ticks down as a consequence the GM chooses. When it triggers, the disguise drops.",
  hooks: {
    onIntent: when(
      (table) => {
        const targets = table.feature.get('massDisguiseTargets');
        const actorId = table.action?.actor?.instanceId;
        return (
          table.feature.get('massDisguiseActive') === true &&
          Array.isArray(targets) &&
          actorId != null &&
          targets.includes(actorId)
        );
      },
      traitIsPresence,
      (table) => {
        table.rolls?.action?.addAdvantageDie('Mass Disguise');
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Mass Disguise',
      stressCost: 1,
      description:
        'After a few minutes of silence to focus: mark 1 Stress. Choose one or more willing creatures within Close range on the map (including yourself). They share a mass disguise; each has advantage on Presence rolls to avoid scrutiny until the disguise ends. Start a Countdown (8) — the GM ticks it when they choose a consequence; at 0, use End Mass Disguise.',
      selectTargets: (table) => targetsInCloseRange(table),
      multiSelect: true,
      isDisabled: (table) =>
        targetsInCloseRange(table).length === 0
          ? 'No willing creature in Close range (including you).'
          : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        if (!Array.isArray(ids) || ids.length === 0) return;
        table.feature.set('massDisguiseActive', true);
        table.feature.set('massDisguiseTargets', ids);
        table.feature.set('massDisguiseCountdown', 8);
        table.me.actionLoop(
          'Mass Disguise',
          `You marked 1 Stress. ${ids.length} willing creature(s) within Close range take on coordinated disguises (same general body structure and size; appearances can be real or invented). Each has advantage on Presence rolls to avoid scrutiny. Activate a Countdown (8); the GM ticks it down when they choose a consequence. When it triggers, the disguises drop — or click "End Mass Disguise" on this card.`
        );
      },
    },
    {
      placements: ['card'],
      name: 'End Mass Disguise',
      description: 'When the Countdown reaches 0 or the disguises end — clears Mass Disguise tracking.',
      isDisabled: (table) =>
        table.feature.get('massDisguiseActive') !== true
          ? 'Mass Disguise is not active.'
          : false,
      onUse(table) {
        table.feature.set('massDisguiseActive', false);
        table.feature.set('massDisguiseTargets', null);
        table.feature.set('massDisguiseCountdown', null);
      },
    },
  ],
};
