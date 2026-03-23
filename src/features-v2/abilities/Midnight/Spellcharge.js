/**
 * Midnight domain — Spellcharge (Tier 3 / level 8)
 * SRD: daggerheart-srd/abilities/Spellcharge.md
 *
 * Tokens gained on magic HP loss use **Hit Points marked on this card** (recall track).
 * Hosts may persist `spellchargeCardHpMarked` in feature state; default **1** matches Recall Cost 1.
 */

import { when, isActing } from '../../engine/when.js';

function spellcastStorageCap(table) {
  const key = table.me?.spellcastTrait;
  if (!key) return 0;
  return Math.max(0, Math.floor(Number(table.me.traits?.[key] ?? 0)));
}

/** Pending HP loss in review-outcome may be `stat: 'currentHP'` or `type: 'damage'` (banner bridge). */
function isMagicHpLossToMe(e, meId) {
  const tid = e.target?.instanceId ?? e.target?.id;
  if (tid !== meId) return false;
  const amt = e.amount ?? 0;
  if (!(amt > 0)) return false;
  if (e.damageType !== 'magic') return false;
  if (e.stat === 'currentHP') return true;
  if (e.type === 'damage') return true;
  return false;
}

function hasIncomingMagicHp(table) {
  const me = table.me?.instanceId;
  if (!me) return false;
  return (table.action?.effects ?? []).some((e) => isMagicHpLossToMe(e, me));
}

function hpMarkedOnSpellchargeCard(table) {
  return Math.max(0, Math.floor(Number(table.feature.get('spellchargeCardHpMarked') ?? 1)) || 0);
}

function tokenSpendOptions(table) {
  const n = table.feature.get('spellchargeTokens') ?? 0;
  if (n < 1) return [];
  return Array.from({ length: n + 1 }, (_, i) => ({
    id: String(i),
    name: i === 0 ? 'Spend no tokens' : `Spend ${i} token${i === 1 ? '' : 's'} (+${i}d6)`,
    description:
      i === 0
        ? 'Do not add Spellcharge dice to this damage roll.'
        : `Add ${i}d6 to your damage roll and remove ${i} Spellcharge tokens.`,
  }));
}

function attackSucceededWithDamageRoll(table) {
  if (table.rolls?.action?.isSuccess !== true) return false;
  if (table.rolls?.damage == null) return false;
  const t = table.action?.type;
  return t === 'attack' || t === 'spellcast';
}

export const Spellcharge = {
  name: 'Spellcharge',
  description:
    'When you take magic damage, place tokens equal to the number of Hit Points you marked on this card. You can store a number of tokens equal to your Spellcast trait.\n\nWhen you make a successful attack against a target, you can spend any number of tokens to add a **d6** for each token spent to your damage roll.',
  chips: [
    when(isActing, attackSucceededWithDamageRoll, (t) => (t.feature.get('spellchargeTokens') ?? 0) > 0, {
      name: 'Spellcharge',
      placements: ['reviewAction'],
      isSelect: (table) => tokenSpendOptions(table),
      isDisabled: (table) =>
        tokenSpendOptions(table).length < 1 ? 'No Spellcharge tokens to spend on this roll.' : false,
      description:
        'Choose how many Spellcharge tokens to spend. Each token adds one d6 to your damage roll.',
      onUse(table, chipState) {
        const raw = chipState.get?.('selectedId');
        const spend = Math.max(0, Math.floor(Number(raw)) || 0);
        const cur = table.feature.get('spellchargeTokens') ?? 0;
        if (spend < 1 || spend > cur) return;
        if (!table.rolls?.damage) return;
        table.feature.set('spellchargeTokens', cur - spend);
        table.rolls.damage.addDie({ name: 'Spellcharge', die: `${spend}d6` });
      },
    }),
  ],
  hooks: {
    onReviewOutcome: when(
      hasIncomingMagicHp,
      (t) => spellcastStorageCap(t) > 0,
      (t) => hpMarkedOnSpellchargeCard(t) > 0,
      (table) => {
        const cap = spellcastStorageCap(table);
        const gain = hpMarkedOnSpellchargeCard(table);
        const cur = table.feature.get('spellchargeTokens') ?? 0;
        table.feature.set('spellchargeTokens', Math.min(cap, cur + gain));
      }
    ),
  },
};
