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

    /**
     * Persist an arbitrary flag on the element (e.g. feature-specific state
     * like reinforcedActive). Triggers a React state update immediately.
     */
    setFlag(key, value) {
      updateActiveElement(el.instanceId, { [key]: value });
    },
  };

  return entity;
}
