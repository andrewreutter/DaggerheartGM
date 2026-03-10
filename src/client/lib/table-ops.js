export const RUNTIME_KEYS = [
  'instanceId', 'elementType', 'currentHp', 'currentStress', 'conditions', 'hope', 'maxHope',
  'playerName', 'maxHp', 'maxStress', 'name',
  'daggerstackUrl', 'daggerstackEmail', 'daggerstackPassword', 'daggerstackCharacterId',
  'class', 'subclass', 'level', 'pronouns', 'description', 'ancestry', 'community',
  'domains', 'traits', 'evasion', 'armorScore', 'armorName', 'armorThresholds',
  'maxArmor', 'currentArmor', 'weapons', 'gold', 'inventory',
  'classFeatures', 'subclassFeatures', 'ancestryFeatures', 'communityFeatures',
  'experiences', 'spellcastTrait', 'hopeAbility', 'hopeAbilityName', 'companion', 'tier',
  'tokenX', 'tokenY',
];

/**
 * Apply a table operation to GM-side state (pure function).
 * Returns an object containing only the state keys that changed.
 */
export function applyTableOp(op, state) {
  const { activeElements = [], featureCountdowns = {} } = state;
  switch (op.op) {
    case 'update-element':
      return { activeElements: activeElements.map(el => el.instanceId === op.instanceId ? { ...el, ...op.updates } : el) };
    case 'add-elements':
      return { activeElements: [...activeElements, ...op.elements] };
    case 'remove-element':
      return { activeElements: activeElements.filter(el => el.instanceId !== op.instanceId) };
    case 'clear-table':
      return { activeElements: activeElements.filter(el => el.elementType === 'character'), featureCountdowns: {} };
    case 'set-fear':
      return { fearCount: op.fearCount };
    case 'set-countdown':
      return { featureCountdowns: { ...featureCountdowns, [op.key]: op.value } };
    case 'set-battle-mods':
      return { tableBattleMods: op.tableBattleMods };
    case 'set-player-emails':
      return { playerEmails: op.playerEmails };
    case 'update-base-data': {
      return {
        activeElements: activeElements.map(el => {
          if (el.id !== op.elementId) return el;
          const runtime = {};
          RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
          return { ...op.newBaseData, ...runtime };
        }),
      };
    }
    case 'set-map':
      return {
        mapConfig: {
          mapImageUrl: op.mapImageUrl ?? null,
          mapDimension: op.mapDimension ?? 'width',
          mapSizeFt: op.mapSizeFt ?? 100,
          mapImageNaturalWidth: op.mapImageNaturalWidth ?? null,
          mapImageNaturalHeight: op.mapImageNaturalHeight ?? null,
        },
        // When image changes, reset all token positions
        ...(op.resetTokenPositions ? {
          activeElements: activeElements.map(el => ({ ...el, tokenX: null, tokenY: null })),
        } : {}),
      };
    default:
      return {};
  }
}

/**
 * Apply a table operation to player-side table state (pure function).
 * Returns a new state object, or the original if no change applies.
 */
export function applyPlayerTableOp(op, state) {
  if (!state) return state;
  const elements = state.elements || [];
  switch (op.op) {
    case 'update-element':
      return { ...state, elements: elements.map(el => el.instanceId === op.instanceId ? { ...el, ...op.updates } : el) };
    case 'add-elements':
      return { ...state, elements: [...elements, ...op.elements] };
    case 'remove-element':
      return { ...state, elements: elements.filter(el => el.instanceId !== op.instanceId) };
    case 'clear-table':
      return { ...state, elements: elements.filter(el => el.elementType === 'character'), featureCountdowns: {} };
    case 'set-fear':
      return { ...state, fearCount: op.fearCount };
    case 'set-countdown':
      return { ...state, featureCountdowns: { ...(state.featureCountdowns || {}), [op.key]: op.value } };
    case 'set-battle-mods':
      return { ...state, tableBattleMods: op.tableBattleMods };
    case 'set-player-emails':
      return { ...state, playerEmails: op.playerEmails };
    case 'set-map': {
      const mapConfig = {
        mapImageUrl: op.mapImageUrl ?? null,
        mapDimension: op.mapDimension ?? 'width',
        mapSizeFt: op.mapSizeFt ?? 100,
        mapImageNaturalWidth: op.mapImageNaturalWidth ?? null,
        mapImageNaturalHeight: op.mapImageNaturalHeight ?? null,
      };
      const newElements = op.resetTokenPositions
        ? elements.map(el => ({ ...el, tokenX: null, tokenY: null }))
        : elements;
      return { ...state, mapConfig, elements: newElements };
    }
    default:
      return state;
  }
}
