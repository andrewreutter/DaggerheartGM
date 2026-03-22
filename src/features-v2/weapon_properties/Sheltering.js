import { when, isTargeted } from '../engine/when.js';

const ARMOR_HP_REDUCTION = 1;

/**
 * Owner is taking HP damage and committed to using armor for this hit
 * (`useArmorByTargetId` / per-effect `useArmor`). See Feature Authoring Guide §C.3.
 */
function hasArmorCommitmentForMe(table) {
  const id = table.me?.instanceId;
  if (!id || !table.action?.effects) return false;
  const incoming = table.action.effects.filter(
    (e) =>
      e.target?.instanceId === id &&
      e.amount > 0 &&
      (e.stat === 'currentHP' || e.type === 'damage')
  );
  if (!incoming.length) return false;
  if (table.action.useArmorByTargetId?.[id] === true) return true;
  return incoming.some((e) => e.useArmor === true);
}

function sourceAttackerId(effect) {
  const s = effect?.source;
  if (s && typeof s === 'object' && s.instanceId != null) return s.instanceId;
  return null;
}

function isAllyHpIncoming(e) {
  return (
    e &&
    e.amount > 0 &&
    !e.armorSlotReductionDisallowed &&
    (e.stat === 'currentHP' || e.type === 'damage')
  );
}

/**
 * Same hit as the owner's incoming damage: same attacker source when known;
 * otherwise same action + attacker actor when effects omit `source`.
 */
function buildSameHitAttackerIds(myIncoming, actorInstanceId) {
  const ids = new Set();
  for (const e of myIncoming) {
    const sid = sourceAttackerId(e);
    if (sid) ids.add(sid);
  }
  return { ids, useLooseCohort: ids.size === 0, actorInstanceId: actorInstanceId ?? null };
}

function effectMatchesSameHit(e, cohort) {
  const eAtt = sourceAttackerId(e);
  if (cohort.ids.size > 0) {
    return eAtt != null && cohort.ids.has(eAtt);
  }
  if (!cohort.actorInstanceId) return false;
  if (eAtt != null) return eAtt === cohort.actorInstanceId;
  return true;
}

function applyShelteringSpread(table) {
  const meId = table.me?.instanceId;
  const effects = table.action?.effects ?? [];
  const myIncoming = effects.filter(
    (e) =>
      e.target?.instanceId === meId &&
      e.amount > 0 &&
      (e.stat === 'currentHP' || e.type === 'damage')
  );
  if (!myIncoming.length) return;

  const cohort = buildSameHitAttackerIds(myIncoming, table.action.actor?.instanceId);
  const allyNames = [];

  for (const e of effects) {
    if (!isAllyHpIncoming(e)) continue;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) continue;

    const ally = table.characters.find((c) => c.instanceId === tid);
    if (!ally) continue;

    if (table.me.rangeFrom(ally) !== 'melee') continue;
    if (!effectMatchesSameHit(e, cohort)) continue;

    const before = e.amount;
    e.amount = Math.max(0, e.amount - ARMOR_HP_REDUCTION);
    if (e.amount < before) allyNames.push(ally.name);
  }

  if (allyNames.length) {
    table.action.addNarration(
      `Sheltering: ${table.me.name} uses armor and shields ${allyNames.join(', ')} from the same hit (Melee).`
    );
  } else {
    table.action.addNarration(
      `Sheltering: ${table.me.name} uses armor against this hit.`
    );
  }
}

export const Sheltering = {
  name: 'Sheltering',
  description:
    'When you mark an Armor Slot, it reduces damage for you and all allies within Melee range of you who took the same damage.',
  hooks: {
    onReviewOutcome: when(isTargeted, hasArmorCommitmentForMe, (table) => {
      applyShelteringSpread(table);
    }),
  },
};
