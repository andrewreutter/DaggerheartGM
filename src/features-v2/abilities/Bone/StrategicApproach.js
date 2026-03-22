/**
 * Bone domain — Strategic Approach (Tier 1)
 * SRD: After a long rest, tokens = Knowledge (min 1). First time you move within Close of an adversary
 * and attack them, spend a token: advantage on the attack, or clear a Stress on an ally in Melee of them.
 */

import { when, isActing } from '../../engine/when.js';

function knowledgeTokenCount(table) {
  const k = table.me?.traits?.knowledge ?? 0;
  return Math.max(1, Math.floor(Number(k)) || 0);
}

function attackVsAdversaryWithinClose(table) {
  if (table.action?.type !== 'attack' || table.action?.actor?.instanceId !== table.me?.instanceId) {
    return false;
  }
  const tgt = table.action?.target;
  if (!tgt || !(tgt.isAdversary === true || tgt.elementType === 'adversary')) return false;
  const b = table.me.rangeFrom(tgt);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function hasStrategicToken(table) {
  return (table.feature.get('strategicApproachTokens') ?? 0) > 0;
}

function notYetUsedOnThisAdversary(table) {
  const advId = table.action?.target?.instanceId;
  if (!advId) return false;
  const used = table.feature.get('strategicApproachUsedAdvIds') || {};
  return !used[advId];
}

export const StrategicApproach = {
  name: 'Strategic Approach',
  description:
    'After a long rest, place a number of tokens equal to your Knowledge on this card (minimum 1). The first time you move within Close range of an adversary and make an attack against them, you can spend one token to choose one of the following options:\n\n- You make the attack with advantage.\n- You clear a Stress on an ally within Melee range of the adversary.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('strategicApproachTokens', knowledgeTokenCount(table));
      table.feature.set('strategicApproachUsedAdvIds', {});
    },
  },
  chips: [
    when(
      isActing,
      attackVsAdversaryWithinClose,
      hasStrategicToken,
      notYetUsedOnThisAdversary,
      {
        name: 'Strategic Approach',
        placements: ['intent'],
        description:
          'Spend 1 token: advantage on this attack, or clear a Stress on an ally within Melee of this adversary (GM).',
        isSelect: () => [
          {
            id: 'advantage',
            name: 'Attack with advantage',
            description: 'You make this attack with advantage.',
          },
          {
            id: 'allyStress',
            name: 'Clear Stress on ally in Melee',
            description: 'Clear a Stress on an ally within Melee range of this adversary (GM chooses).',
          },
        ],
        onUse(table, chipState) {
          const advId = table.action?.target?.instanceId;
          if (!advId) return;
          const cur = table.feature.get('strategicApproachTokens') ?? 0;
          if (cur < 1) return;
          const id = chipState.get?.('selectedId');
          if (!id) return;
          table.feature.set('strategicApproachTokens', cur - 1);
          const used = { ...(table.feature.get('strategicApproachUsedAdvIds') || {}) };
          used[advId] = true;
          table.feature.set('strategicApproachUsedAdvIds', used);
          if (id === 'advantage') {
            table.rolls?.action?.addAdvantageDie('Strategic Approach');
          } else {
            table.me.actionLoop(
              'Strategic Approach',
              'Clear a Stress on an ally within Melee range of this adversary (GM applies).'
            );
          }
        },
      }
    ),
  ],
};
