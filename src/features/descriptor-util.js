/**
 * Build and register feature descriptors for weapon and armor barrels.
 * Used by weapons/index.js and armor/index.js only (ancestries/communities use their own merge).
 */

/**
 * Build a feature descriptor from name, description, hooks, and context.
 *
 * @param {string} name
 * @param {string} [description]
 * @param {object} hooks
 * @param {{ sourceType: string, source: string }} context
 * @returns {object} descriptor
 */
export function buildFeatureDescriptor(name, description, hooks, context) {
  return {
    name,
    description: description ?? '',
    sourceType: context.sourceType,
    source: context.source,
    ...hooks,
  };
}

/**
 * Register descriptor in context.targetMap.
 *
 * @param {object} descriptor
 * @param {{ targetMap: Record<string, object> }} context
 */
export function registerFeature(descriptor, context) {
  context.targetMap[descriptor.name] = descriptor;
}
