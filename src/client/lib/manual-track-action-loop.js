/**
 * Manual HP / Stress / Hope / Armor (and companion stress) edits on the Game Table apply to server
 * state immediately; an `_action` banner is posted for the log and Acknowledge only dismisses it.
 *
 * Adversary HP/stress CheckboxTracks apply immediately without a manual-track banner — character
 * lifecycle hooks are character-only; see GMTableView Encounter panel + BattleMap token detail panel.
 */

/** @param {string|undefined} elementType */
export function shouldQueueManualTrackBannerForElementType(elementType) {
  return elementType !== 'adversary';
}

/**
 * @param {object[]|null|undefined} pendingBanners
 * @param {string} instanceId
 * @returns {object|null} latest matching roll data
 */
export function findPendingManualTrackBanner(pendingBanners, instanceId) {
  if (!Array.isArray(pendingBanners) || !instanceId) return null;
  for (let i = pendingBanners.length - 1; i >= 0; i--) {
    const r = pendingBanners[i];
    if (r?._manualTrackEdit && r._targetInstanceId === instanceId) return r;
  }
  return null;
}

/**
 * @param {object} el — active element
 * @param {object|null} pendingRoll — banner roll from `findPendingManualTrackBanner`
 * @returns {object} el merged with `_manualUpdates` for display only
 */
export function mergeManualTrackDisplay(el, pendingRoll) {
  if (!el || !pendingRoll?._manualUpdates) return el;
  const u = pendingRoll._manualUpdates;
  if (!u) return el;
  const next = { ...el, ...u };
  if (u.companion != null && el.companion != null) {
    next.companion = { ...el.companion, ...u.companion };
  }
  return next;
}

/**
 * Bodies always describe **marked** counts (damage marked, stress marked, Hope marked = spent vs max, etc.),
 * never remaining HP / remaining Hope.
 *
 * @returns {{ title: string, body: string }}
 */
function copyHp(before, after, maxHp) {
  const max = maxHp ?? 0;
  const dmgBefore = Math.max(0, max - before);
  const dmgAfter = Math.max(0, max - after);
  const lost = before - after;
  const healed = after - before;
  if (lost > 0) {
    return {
      title: `Marked ${lost} damage`,
      body: `HP marked changed from ${dmgBefore} to ${dmgAfter}`,
    };
  }
  if (healed > 0) {
    return {
      title: `Cleared ${healed} damage`,
      body: `HP marked changed from ${dmgBefore} to ${dmgAfter}`,
    };
  }
  return {
    title: 'HP',
    body: `HP marked changed from ${dmgBefore} to ${dmgAfter}`,
  };
}

function copyStress(before, after) {
  const marked = after - before;
  const cleared = before - after;
  if (marked > 0) {
    return {
      title: `Marked ${marked} stress`,
      body: `Stress marked changed from ${before} to ${after}`,
    };
  }
  if (cleared > 0) {
    return {
      title: `Cleared ${cleared} stress`,
      body: `Stress marked changed from ${before} to ${after}`,
    };
  }
  return {
    title: 'Stress',
    body: `Stress marked changed from ${before} to ${after}`,
  };
}

/** Hope “marked” = spent vs pool (maxHope − remaining Hope). */
function copyHope(before, after, maxHope) {
  const max = maxHope ?? 6;
  const spentBefore = Math.max(0, max - before);
  const spentAfter = Math.max(0, max - after);
  const gained = after - before;
  const spent = before - after;
  if (gained > 0) {
    return {
      title: `Gained ${gained} Hope`,
      body: `Hope marked changed from ${spentBefore} to ${spentAfter}`,
    };
  }
  if (spent > 0) {
    return {
      title: `Spent ${spent} Hope`,
      body: `Hope marked changed from ${spentBefore} to ${spentAfter}`,
    };
  }
  return {
    title: 'Hope',
    body: `Hope marked changed from ${spentBefore} to ${spentAfter}`,
  };
}

function copyArmor(before, after) {
  const marked = after - before;
  const cleared = before - after;
  if (marked > 0) {
    return {
      title: `Marked ${marked} armor`,
      body: `Armor marked changed from ${before} to ${after}`,
    };
  }
  if (cleared > 0) {
    return {
      title: `Cleared ${cleared} armor`,
      body: `Armor marked changed from ${before} to ${after}`,
    };
  }
  return {
    title: 'Armor',
    body: `Armor marked changed from ${before} to ${after}`,
  };
}

function copyCompanionStress(before, after) {
  const marked = after - before;
  const cleared = before - after;
  if (marked > 0) {
    return {
      title: `Marked ${marked} companion stress`,
      body: `Companion stress marked changed from ${before} to ${after}`,
    };
  }
  if (cleared > 0) {
    return {
      title: `Cleared ${cleared} companion stress`,
      body: `Companion stress marked changed from ${before} to ${after}`,
    };
  }
  return {
    title: 'Companion stress',
    body: `Companion stress marked changed from ${before} to ${after}`,
  };
}

/**
 * @param {object} targetEl — character or adversary element
 * @param {object} updates — partial `{ currentHp?, currentStress?, hope?, currentArmor?, companion? }`
 */
export function buildManualTrackActionRoll(targetEl, updates) {
  const name = targetEl.name || 'Actor';
  const titles = [];
  const bodies = [];
  const maxHp = targetEl.maxHp ?? targetEl.hp_max ?? 0;
  const maxStress = targetEl.maxStress ?? targetEl.stress_max ?? 0;
  const maxHope = targetEl.maxHope ?? 6;

  if (updates.currentHp !== undefined) {
    const before = targetEl.currentHp ?? maxHp ?? 0;
    const after = updates.currentHp;
    const { title, body } = copyHp(before, after, maxHp);
    titles.push(title);
    bodies.push(body);
  }
  if (updates.currentStress !== undefined) {
    const before = targetEl.currentStress ?? 0;
    const after = updates.currentStress;
    const { title, body } = copyStress(before, after);
    titles.push(title);
    bodies.push(body);
  }
  if (updates.hope !== undefined) {
    const before = targetEl.hope ?? maxHope;
    const after = updates.hope;
    const { title, body } = copyHope(before, after, maxHope);
    titles.push(title);
    bodies.push(body);
  }
  if (updates.currentArmor !== undefined) {
    const before = targetEl.currentArmor ?? 0;
    const after = updates.currentArmor;
    const { title, body } = copyArmor(before, after);
    titles.push(title);
    bodies.push(body);
  }
  if (updates.companion?.currentStress !== undefined && targetEl.companion) {
    const before = targetEl.companion.currentStress ?? 0;
    const after = updates.companion.currentStress;
    const { title, body } = copyCompanionStress(before, after);
    titles.push(title);
    bodies.push(body);
  }
  if (updates.gold !== undefined) {
    const before = targetEl.gold ?? 0;
    const after = updates.gold;
    const delta = after - before;
    if (delta > 0) titles.push(`Gained ${delta} gold`);
    else if (delta < 0) titles.push(`Spent ${-delta} gold`);
    else titles.push('Gold');
    bodies.push(`Gold changed from ${before} to ${after}`);
  }
  if (updates.inventory !== undefined) {
    const after = Array.isArray(updates.inventory) ? updates.inventory.length : 0;
    titles.push('Inventory');
    bodies.push(`Inventory updated (${after} item${after !== 1 ? 's' : ''})`);
  }

  const actionText = bodies.length ? bodies.join('\n') : 'Resource updated.';
  const actionName = titles.length ? titles.join(' · ') : 'Resource updated';

  return {
    _action: true,
    _manualTrackEdit: true,
    _targetInstanceId: targetEl.instanceId,
    _targetType: targetEl.elementType || 'character',
    _manualUpdates: updates,
    rollUser: name,
    actionName,
    actionText,
  };
}

/**
 * Pending Life Support: HP damage boxes that will clear on GM ack (0 or 1).
 */
export function getLifeSupportPendingHealSlots(pendingBanners, lifeSupportSelections, instanceId) {
  if (!instanceId) return 0;
  for (const r of pendingBanners || []) {
    if (!r?._action || r._featureName !== 'Life Support' || r._rollDbId == null) continue;
    const sel = lifeSupportSelections?.[r._rollDbId];
    if (sel && sel === instanceId) return 1;
  }
  return 0;
}

/**
 * Deltas between server `el` and merged manual-track preview — drives dashed pending UI when the
 * banner’s target values are not yet reflected in `el` (e.g. before SSE catches up).
 */
export function getPendingManualTrackAckDeltas(el, pendingRoll) {
  const empty = {
    stressAdd: 0,
    stressClear: 0,
    hpDamageAdd: 0,
    hpHealSlots: 0,
    armorMarkAdd: 0,
    armorClear: 0,
    hopeSpend: 0,
    hopeGain: 0,
    companionStressAdd: 0,
    companionStressClear: 0,
  };
  if (!el || !pendingRoll?._manualUpdates) return { ...empty };
  const merged = mergeManualTrackDisplay(el, pendingRoll);
  const u = pendingRoll._manualUpdates;
  const out = { ...empty };

  if (u.currentStress !== undefined) {
    const c = el.currentStress ?? 0;
    const m = merged.currentStress ?? 0;
    if (m > c) out.stressAdd = m - c;
    if (m < c) out.stressClear = c - m;
  }
  const maxHp = el.maxHp ?? el.hp_max ?? 0;
  if (maxHp > 0 && u.currentHp !== undefined) {
    const dmgEl = maxHp - (el.currentHp ?? maxHp);
    const dmgM = maxHp - (merged.currentHp ?? maxHp);
    if (dmgM > dmgEl) out.hpDamageAdd = dmgM - dmgEl;
    if (dmgM < dmgEl) out.hpHealSlots = dmgEl - dmgM;
  }
  if (u.currentArmor !== undefined) {
    const c = el.currentArmor ?? 0;
    const m = merged.currentArmor ?? 0;
    if (m > c) out.armorMarkAdd = m - c;
    if (m < c) out.armorClear = c - m;
  }
  if (u.hope !== undefined) {
    const maxH = el.maxHope ?? 6;
    const c = el.hope ?? maxH;
    const m = merged.hope ?? maxH;
    if (m < c) out.hopeSpend = c - m;
    if (m > c) out.hopeGain = m - c;
  }
  if (u.companion?.currentStress !== undefined && el.companion) {
    const c = el.companion.currentStress ?? 0;
    const m = merged.companion?.currentStress ?? 0;
    if (m > c) out.companionStressAdd = m - c;
    if (m < c) out.companionStressClear = c - m;
  }
  return out;
}
