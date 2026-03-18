/**
 * Shared addFeature and feature builder factory.
 *
 * Ancestries, communities, armor, and weapons all use the same addFeature flow:
 * buildFeatureDescriptor → registerFeature, with optional onAfterAdd (e.g. onCharacterEdit).
 * Only ancestry and community descriptors are pushed to a feature list (character sheet cards);
 * armor/weapon descriptors are registered in their maps only.
 */

/**
 * Build a feature descriptor from name, description, hooks, and context.
 * Strips onCharacterEdit from hooks (not stored on descriptor).
 * Runs onCharacterRender mock to capture advantageTrigger / virtualWeaponBehaviors.
 * Runs onCard mock to capture cardChips.
 * When onCharacterRender calls addStatMod(stat, value), the mock accumulates into
 * descriptor.passiveStatMods (so weapon/armor features can use the same API as ancestries).
 *
 * @param {string} name
 * @param {string} [description]
 * @param {object} hooks
 * @param {{ sourceType: string, source: string, virtualWeaponBehaviors?: Record<string, object> }} context
 * @returns {object} descriptor
 */
const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

export function buildFeatureDescriptor(name, description, hooks, context) {
  const { onCharacterEdit, ...restHooks } = hooks;
  const descriptor = {
    name,
    description: description ?? '',
    sourceType: context.sourceType,
    source: context.source,
    ...restHooks,
  };
  if (context.sourceType === 'ancestry') {
    descriptor.ancestry = context.source;
  }

  if (hooks.onCharacterRender) {
    const virtualWeaponBehaviors = context.virtualWeaponBehaviors ?? {};
    const mockCtx = {
      weapons: [],
      _currentFeatureName: name,
      addStatMod(stat, value) {
        descriptor.passiveStatMods = descriptor.passiveStatMods || {};
        if (TRAIT_KEYS.includes(stat)) {
          descriptor.passiveStatMods.traits = descriptor.passiveStatMods.traits || {};
          descriptor.passiveStatMods.traits[stat] = (descriptor.passiveStatMods.traits[stat] || 0) + value;
        } else {
          descriptor.passiveStatMods[stat] = (descriptor.passiveStatMods[stat] || 0) + value;
        }
      },
      addRollModifier(opts) {
        descriptor.passiveStatMods = descriptor.passiveStatMods || {};
        descriptor.passiveStatMods.rollModifiers = descriptor.passiveStatMods.rollModifiers || [];
        descriptor.passiveStatMods.rollModifiers.push(opts);
      },
      addThresholdBonus() {},
      addAdvantageTrigger(condition) {
        descriptor.advantageTrigger = condition;
      },
      addVirtualWeapon(vw) {
        if (vw.onAcknowledge || vw.stressCost != null || vw.hopeCost != null) {
          virtualWeaponBehaviors[name] = {
            onAcknowledge: vw.onAcknowledge,
            stressCost: vw.stressCost,
            hopeCost: vw.hopeCost,
          };
        }
      },
    };
    try {
      hooks.onCharacterRender(mockCtx);
    } catch {
      /* no-op if hook errors without real char data */
    }
  }

  if (hooks.onCard) {
    const cardChips = [];
    const card = { addChip(d) { cardChips.push(d); } };
    try {
      hooks.onCard(card);
    } catch {
      /* no-op */
    }
    if (cardChips.length) descriptor.cardChips = cardChips;
  }

  return descriptor;
}

/**
 * Register descriptor in context.targetMap and optionally push to context.featureList.
 *
 * @param {object} descriptor
 * @param {{ targetMap: Record<string, object>, featureList?: object[] }} context
 */
export function registerFeature(descriptor, context) {
  context.targetMap[descriptor.name] = descriptor;
  if (context.featureList) {
    context.featureList.push(descriptor);
  }
}

/**
 * Build descriptor, register it, and run onAfterAdd if present.
 * context.char is set by createFeatureBuilder when calling this (the builder object).
 *
 * @param {string} name
 * @param {string} [description]
 * @param {object} hooks
 * @param {object} context
 */
export function addFeature(name, description, hooks, context) {
  const descriptor = buildFeatureDescriptor(name, description ?? '', hooks, context);
  registerFeature(descriptor, context);
  if (context.onAfterAdd) {
    try {
      context.onAfterAdd(descriptor, hooks, context.char);
    } catch {
      /* no-op */
    }
  }
}

/**
 * Factory: returns a builder object with addFeature(name, description, hooks).
 * For ancestry context (context.ancestryEntry set), also adds addExperienceBonus(amount);
 * lastFeatureNameRef is set before each addFeature so addExperienceBonus can use it.
 *
 * @param {object} context
 * @returns {{ addFeature: function, addExperienceBonus?: function }}
 */
export function createFeatureBuilder(context) {
  const lastFeatureNameRef = { current: null };

  const builder = {
    addFeature(name, description, hooks = {}) {
      lastFeatureNameRef.current = name;
      addFeature(name, description, hooks, { ...context, char: builder });
    },
  };

  if (context.ancestryEntry) {
    builder.addExperienceBonus = function addExperienceBonus(amount) {
      if (lastFeatureNameRef.current != null && context.ancestryEntry) {
        context.ancestryEntry.experienceBonus = {
          amount,
          featureName: lastFeatureNameRef.current,
        };
      }
    };
  }

  return builder;
}
