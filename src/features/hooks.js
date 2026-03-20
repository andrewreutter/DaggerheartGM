/**
 * Hook Dispatchers — dispatch patterns for the feature IoC system.
 *
 * runHook / runCharacterHook — fire-and-forget: call feature[hookName](context).
 * runPipelineHook / runCharacterPipelineHook — pipeline: each feature transforms a value.
 * runAsyncPipelineHook / runCharacterAsyncPipelineHook — async pipeline.
 */

/**
 * Call `feature[hookName](context)` for every feature whose name is in tagNames.
 *
 * @param {Record<string, object>} featureMap  - lookup map: feature name → feature object
 * @param {Set<string>|string[]}   tagNames    - active feature names for this roll/event
 * @param {string}                 hookName    - method name to call on each feature
 * @param {object}                 context     - context object passed to each hook
 */
export function runHook(featureMap, tagNames, hookName, context) {
  const names = tagNames instanceof Set ? tagNames : new Set(tagNames);
  for (const name of names) {
    const feature = featureMap[name];
    if (feature && typeof feature[hookName] === 'function') {
      try {
        const ctx = { ...context, feature };
        feature[hookName](ctx);
      } catch (err) {
        console.error(`[features] ${name}.${hookName} threw:`, err);
      }
    }
  }
}

/**
 * Call hookName on each feature in the activeFeatures array with a unified context.
 * Use when you have a flat list of feature descriptors (e.g. from character-calc activeFeatures).
 * Injects source (the contributing item) and feature (descriptor).
 *
 * @param {object[]} activeFeatures - array of feature descriptors with at least .name and optional .source, .priority
 * @param {string}   hookName       - method name to call on each feature
 * @param {object}   context        - base context (e.g. { banner, character, characters, system })
 */
export function runCharacterHook(activeFeatures, hookName, context) {
  if (!Array.isArray(activeFeatures)) return;
  for (const feature of activeFeatures) {
    if (typeof feature[hookName] !== 'function') continue;
    const name = feature.name;
    try {
      const ctx = { ...context, source: feature.source, feature };
      feature[hookName](ctx);
    } catch (err) {
      console.error(`[features] ${name}.${hookName} threw:`, err);
    }
  }
}

/**
 * Run a pipeline hook over an activeFeatures array. Each feature receives
 * (currentValue, context) with context including source: feature.source.
 *
 * @param {object[]} activeFeatures - array of feature descriptors with optional .source, .priority
 * @param {string}   hookName       - method name (e.g. 'modifyPreThresholdDamage')
 * @param {*}        initialValue   - starting value
 * @param {object}   context        - base context
 * @returns {*} the final transformed value
 */
export function runCharacterPipelineHook(activeFeatures, hookName, initialValue, context) {
  if (!Array.isArray(activeFeatures)) return initialValue;
  const participants = activeFeatures.filter(f => typeof f[hookName] === 'function');
  participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  let value = initialValue;
  for (const feature of participants) {
    try {
      const ctx = { ...context, source: feature.source, feature };
      const result = feature[hookName](value, ctx);
      if (result !== undefined) value = result;
    } catch (err) {
      console.error(`[features] ${feature.name}.${hookName} threw:`, err);
    }
  }
  return value;
}

/**
 * Run an async pipeline hook where each feature can asynchronously transform
 * a value. Like `runPipelineHook` but awaits each feature's result.
 *
 * @param {Record<string, object>} featureMap
 * @param {Set<string>|string[]}   tagNames
 * @param {string}                 hookName
 * @param {*}                      initialValue
 * @param {object}                 context
 * @returns {Promise<*>} the final transformed value
 */
export async function runAsyncPipelineHook(featureMap, tagNames, hookName, initialValue, context) {
  const names = tagNames instanceof Set ? tagNames : new Set(tagNames);

  const participants = [];
  for (const name of names) {
    const feature = featureMap[name];
    if (feature && typeof feature[hookName] === 'function') {
      participants.push(feature);
    }
  }
  participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  let value = initialValue;
  for (const feature of participants) {
    try {
      const ctx = { ...context, feature };
      const result = await feature[hookName](value, ctx);
      if (result !== undefined) value = result;
    } catch (err) {
      console.error(`[features] ${feature.name}.${hookName} threw:`, err);
    }
  }
  return value;
}

/**
 * Async pipeline over activeFeatures array. Each feature receives (value, context) with source.
 *
 * @param {object[]} activeFeatures - array of feature descriptors
 * @param {string}   hookName       - method name
 * @param {*}        initialValue   - starting value
 * @param {object}   context        - base context
 * @returns {Promise<*>} the final transformed value
 */
export async function runCharacterAsyncPipelineHook(activeFeatures, hookName, initialValue, context) {
  if (!Array.isArray(activeFeatures)) return initialValue;
  const participants = activeFeatures.filter(f => typeof f[hookName] === 'function');
  participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  let value = initialValue;
  for (const feature of participants) {
    try {
      const ctx = { ...context, source: feature.source, feature };
      const result = await feature[hookName](value, ctx);
      if (result !== undefined) value = result;
    } catch (err) {
      console.error(`[features] ${feature.name}.${hookName} threw:`, err);
    }
  }
  return value;
}

/**
 * Run a pipeline hook where each feature can transform a value.
 * Features are sorted by their `priority` field (ascending; default 50).
 * Each feature receives `(currentValue, context)` and returns the new value.
 * Features that don't implement the hook are skipped transparently.
 *
 * @param {Record<string, object>} featureMap
 * @param {Set<string>|string[]}   tagNames
 * @param {string}                 hookName
 * @param {*}                      initialValue  - starting value for the pipeline
 * @param {object}                 context       - additional context (read-only)
 * @returns {*} the final transformed value
 */
export function runPipelineHook(featureMap, tagNames, hookName, initialValue, context) {
  const names = tagNames instanceof Set ? tagNames : new Set(tagNames);

  // Collect participating features and sort by priority
  const participants = [];
  for (const name of names) {
    const feature = featureMap[name];
    if (feature && typeof feature[hookName] === 'function') {
      participants.push(feature);
    }
  }
  participants.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  let value = initialValue;
  for (const feature of participants) {
    try {
      const ctx = { ...context, feature };
      const result = feature[hookName](value, ctx);
      if (result !== undefined) value = result;
    } catch (err) {
      console.error(`[features] ${feature.name}.${hookName} threw:`, err);
    }
  }
  return value;
}
