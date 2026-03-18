/**
 * Entity Wrapper — wraps a raw active element + updateActiveElement callback
 * into an object with game-semantic mutator methods.
 *
 * Every hook receives wrapped entities so features don't need to reach into
 * component internals. The wrapper also spreads all source properties (e.g.
 * armorScore, thresholds, armorFeatureName) so feature hooks can read them
 * without needing a separate raw reference.
 *
 * Mutable tracked fields (currentStress, currentHp, hope, currentArmor) are
 * exposed as snapshot getters — chained method calls within one hook see the
 * accumulated changes even though React batches the actual state updates.
 */
export function wrapEntity(el, updateActiveElement) {
  if (!el) return null;

  // Mutate local snapshot fields so chained method calls within one hook
  // see the accumulated changes, even though React batches the state updates.
  const snapshot = {
    currentStress: el.currentStress ?? 0,
    currentHp:     el.currentHp     ?? el.maxHp   ?? 0,
    hope:          el.hope          ?? el.maxHope  ?? 0,
    currentArmor:  el.currentArmor  ?? 0,
  };

  const entity = {
    // ── All source properties (armorScore, thresholds, armorFeatureName, etc.) ──
    ...el,

    // ── Stable identity and max values with safe defaults ─────────────────────
    instanceId:  el.instanceId,
    id:          el.instanceId,  // alias for clean feature-hook APIs
    name:        el.name,
    class:       el.class,
    maxStress:   el.maxStress   ?? 6,
    maxHp:       el.maxHp       ?? 0,
    maxHope:     el.maxHope     ?? 6,
    maxArmor:    el.maxArmor    ?? 0,

    // ── Snapshot getters: reflect mutations applied during the current call chain
    get currentStress() { return snapshot.currentStress; },
    get currentHp()     { return snapshot.currentHp; },
    get hope()          { return snapshot.hope; },
    get currentArmor()  { return snapshot.currentArmor; },

    // ── Mutators ───────────────────────────────────────────────────────────────

    markStress(n = 1) {
      if (entity.maxStress <= 0) return; // target has no stress track
      snapshot.currentStress = Math.min(snapshot.currentStress + n, entity.maxStress);
      updateActiveElement(el.instanceId, { currentStress: snapshot.currentStress });
    },

    clearStress(n = 1) {
      snapshot.currentStress = Math.max(snapshot.currentStress - n, 0);
      updateActiveElement(el.instanceId, { currentStress: snapshot.currentStress });
    },

    /** Reduce HP by n (damage) */
    markHp(n = 1) {
      snapshot.currentHp = Math.max(snapshot.currentHp - n, 0);
      updateActiveElement(el.instanceId, { currentHp: snapshot.currentHp });
    },

    /** Restore HP by n (healing) */
    clearHp(n = 1) {
      snapshot.currentHp = Math.min(snapshot.currentHp + n, entity.maxHp);
      updateActiveElement(el.instanceId, { currentHp: snapshot.currentHp });
    },

    markArmor(n = 1) {
      snapshot.currentArmor = Math.min(snapshot.currentArmor + n, entity.maxArmor);
      updateActiveElement(el.instanceId, { currentArmor: snapshot.currentArmor });
    },

    clearArmor(n = 1) {
      snapshot.currentArmor = Math.max(snapshot.currentArmor - n, 0);
      updateActiveElement(el.instanceId, { currentArmor: snapshot.currentArmor });
    },

    spendHope(n = 1) {
      snapshot.hope = Math.max(snapshot.hope - n, 0);
      updateActiveElement(el.instanceId, { hope: snapshot.hope });
    },

    gainHope(n = 1) {
      snapshot.hope = Math.min(snapshot.hope + n, entity.maxHope);
      updateActiveElement(el.instanceId, { hope: snapshot.hope });
    },

    /** True when at least n stress boxes are empty (i.e. the character can absorb n more stress). */
    hasStress(n = 1) {
      return entity.maxStress - snapshot.currentStress >= n;
    },

    /**
     * Persist an arbitrary flag on the element (e.g. feature-specific state
     * like reinforcedActive). Triggers a React state update immediately.
     */
    setFlag(key, value) {
      updateActiveElement(el.instanceId, { [key]: value });
    },

    /** Mark a feature as used for a given cycle (e.g. once per rest). */
    setFeatureUsed(featureKey, cycle) {
      const next = { ...(el.featureUsage || {}), [featureKey]: { used: true, cycle } };
      updateActiveElement(el.instanceId, { featureUsage: next });
    },

    /** Append a condition string to the element's conditions list. */
    addCondition(name) {
      const existing = el.conditions || '';
      const trimmed = existing.trim();
      const updated = trimmed ? `${trimmed}, ${name}` : name;
      updateActiveElement(el.instanceId, { conditions: updated });
    },

    /** Add a damage resistance (e.g. physical). Source identifies the feature (e.g. 'Galapa - Retract'). */
    addResistance(type, source) {
      const list = Array.isArray(el.resistance) ? [...el.resistance] : [];
      const key = source ?? 'Unknown';
      if (!list.some(r => r.type === type && r.source === key)) list.push({ type, source: key });
      updateActiveElement(el.instanceId, { resistance: list });
    },

    removeResistance(type, source) {
      const list = Array.isArray(el.resistance) ? el.resistance : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { resistance: list.filter(r => !(r.type === type && r.source === key)) });
    },

    /** Add or replace an active modifier (e.g. Timeslowing +1d4 Evasion). Replaces existing modifier with same id. */
    addModifier(modifier) {
      const id = modifier?.id;
      const existing = (el.activeModifiers || []).filter(m => m.id !== id);
      updateActiveElement(el.instanceId, { activeModifiers: [...existing, modifier] });
    },

    /** Add a source of disadvantage on this character's action rolls. */
    addDisadvantage(source) {
      const list = Array.isArray(el.disadvantageSources) ? [...el.disadvantageSources] : [];
      const key = source ?? 'Unknown';
      if (!list.includes(key)) list.push(key);
      updateActiveElement(el.instanceId, { disadvantageSources: list });
    },

    removeDisadvantage(source) {
      const list = Array.isArray(el.disadvantageSources) ? el.disadvantageSources : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { disadvantageSources: list.filter(s => s !== key) });
    },

    /** Add a source that prevents this character's token from being moved. */
    disableMove(source) {
      const list = Array.isArray(el.moveDisabledSources) ? [...el.moveDisabledSources] : [];
      const key = source ?? 'Unknown';
      if (!list.includes(key)) list.push(key);
      updateActiveElement(el.instanceId, { moveDisabledSources: list });
    },

    enableMove(source) {
      const list = Array.isArray(el.moveDisabledSources) ? el.moveDisabledSources : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { moveDisabledSources: list.filter(s => s !== key) });
    },
  };

  return entity;
}
