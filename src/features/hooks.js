/**
 * Hook Dispatchers — two dispatch patterns for the feature IoC system.
 *
 * runHook       — fire-and-forget: calls feature[hookName](context) for each
 *                 matching feature. Order-independent side effects.
 *
 * runPipelineHook — pipeline: each feature receives the accumulated value from
 *                   the previous feature and may transform it. Features may
 *                   declare a numeric `priority` (default 50); lower priority
 *                   runs first.
 */

/**
 * Call `feature[hookName](context)` for every feature whose name is in tagNames.
 * Silently skips features that don't implement the hook or aren't in the map.
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
        feature[hookName](context);
      } catch (err) {
        console.error(`[features] ${name}.${hookName} threw:`, err);
      }
    }
  }
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
      const result = await feature[hookName](value, context);
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
      const result = feature[hookName](value, context);
      if (result !== undefined) value = result;
    } catch (err) {
      console.error(`[features] ${feature.name}.${hookName} threw:`, err);
    }
  }
  return value;
}
