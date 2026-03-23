/**
 * Arcana domain — Cloaking Blast (Tier 2 / SRD level 7 spell)
 * SRD: daggerheart-srd/abilities/Cloaking Blast.md
 */

import { when, isActing } from '../../engine/when.js';

export const CloakingBlast = {
  name: 'Cloaking Blast',
  description:
    'When you make a successful **Spellcast Roll** to cast a different spell, you can **spend a Hope** to become _Cloaked_. While _Cloaked_, you remain unseen if you are stationary when an adversary moves to where they would normally see you. When you move into or within an adversary\'s line of sight or make an attack, you are no longer _Cloaked_.',
  hooks: {
    onIntent: when(
      isActing,
      (table) => {
        if (table.feature.get('cloakingBlastPendingHope') === true) {
          table.feature.set('cloakingBlastPendingHope', false);
        }
        if (table.action?.type === 'attack' && table.me.hasCondition('Cloaked')) {
          table.me.removeCondition('Cloaked');
        }
      }
    ),
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'spellcast',
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set(
          'cloakingBlastPendingHope',
          table.rolls.action.isSuccess === true
        );
      }
    ),
    onTokenMove: when(
      (table) => table.tokenMove?.mover?.instanceId === table.me?.instanceId,
      (table) => table.me.hasCondition('Cloaked'),
      (table) => {
        table.me.removeCondition('Cloaked');
      }
    ),
  },
  chips: [
    when(
      isActing,
      (table) => table.feature.get('cloakingBlastPendingHope') === true,
      {
        placements: ['reviewAction'],
        name: 'Cloaking Blast — become Cloaked',
        hopeCost: 1,
        description:
          'Spend 1 Hope to become Cloaked after this successful Spellcast of another spell. While Cloaked, you stay unseen if you remain still when an adversary would otherwise see you (GM). You lose Cloaked when you move, when you enter an adversary\'s line of sight, or when you make an attack.',
        onUse(table) {
          table.feature.set('cloakingBlastPendingHope', false);
          table.me.addCondition('Cloaked');
        },
      }
    ),
  ],
};
