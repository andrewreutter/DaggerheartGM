/**
 * SRD consumable — Blinding Orb (common roll table 57).
 * daggerheart-srd/consumables/Blinding Orb.md
 */

import { when } from '../engine/when.js';

const FS = 'Blinding Orb';
const SCOPE = 'consumables:srd-cns-blinding-orb';

function getAffectedInstanceIds(table) {
  const scoped = table.source?.get?.('affectedInstanceIds');
  if (scoped !== undefined) return scoped;
  return table.featureState?.[SCOPE]?.affectedInstanceIds ?? table.featureState?.[FS]?.affectedInstanceIds;
}

/** SRD "within Close range": Melee, Very Close, or Close. */
function isWithinCloseRange(activator, other) {
  const b = activator?.rangeFrom?.(other);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function hasTrackedVulnerableTargets(table) {
  const ids = getAffectedInstanceIds(table);
  return Array.isArray(ids) && ids.length > 0;
}

function batchMarksHPOnTrackedTarget(table) {
  const tracked = new Set(getAffectedInstanceIds(table) || []);
  if (!tracked.size) return false;
  return (table.mutationBatch || []).some((m) => {
    if (m.type !== 'markHP') return false;
    const amt = Math.max(0, Math.floor(Number(m.payload?.amount) || 0));
    return amt > 0 && tracked.has(m.payload?.instanceId);
  });
}

export const BlindingOrb = {
  name: 'Blinding Orb',
  description:
    'You can activate this orb to create a flash of bright light. All targets within Close range become Vulnerable until they mark HP.',
  onUse(table) {
    const activator = table.me;
    const affectedIds = [];
    for (const actor of table.actors) {
      if (!isWithinCloseRange(activator, actor)) continue;
      actor.addCondition('Vulnerable');
      affectedIds.push(actor.instanceId);
    }
    table.source.set('affectedInstanceIds', affectedIds);
    table.me.actionLoop(
      'Blinding Orb',
      `Flash of light: ${affectedIds.length} target(s) within Close range become Vulnerable until they mark HP.`
    );
  },
  hooks: {
    onStateChange: when(
      hasTrackedVulnerableTargets,
      batchMarksHPOnTrackedTarget,
      (table) => {
        const tracked = new Set(getAffectedInstanceIds(table) || []);
        const clearedIds = new Set();
        for (const m of table.mutationBatch) {
          if (m.type !== 'markHP') continue;
          const id = m.payload?.instanceId;
          const amt = Math.max(0, Math.floor(Number(m.payload?.amount) || 0));
          if (!id || amt < 1 || !tracked.has(id) || clearedIds.has(id)) continue;
          clearedIds.add(id);
          const actor = table.actors.find((a) => a.instanceId === id);
          actor?.removeCondition('Vulnerable');
        }
        if (!clearedIds.size) return;
        const remaining = [...tracked].filter((id) => !clearedIds.has(id));
        table.source.set('affectedInstanceIds', remaining);
      }
    ),
  },
};
