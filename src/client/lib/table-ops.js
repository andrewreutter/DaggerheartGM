// Runtime fields that are local to the Game Table and NOT overwritten by library data.
// Used when resolving characters by reference: library base data is merged in, but
// these fields are preserved from the stored activeElement.
export const CHARACTER_RUNTIME_KEYS = [
  'instanceId', 'elementType',
  'currentHp', 'currentStress', 'hope', 'currentArmor', 'conditions',
  'tokenX', 'tokenY',
  'assignedPlayerEmail', 'assignedPlayerUid', 'playerName',
  'reinforcedActive',
  'selectedExperienceIndex',  // which experience is selected for the next roll (+2)
  // Feature interaction state
  'featureUsage',      // { [featureKey]: { used: boolean, cycle: 'session'|'rest'|'longRest' } }
  'activeModifiers',   // [{ id, name, dice?, value?, mode?, bonus?, trait?, type, refreshOn }]
  'focusTargetId',     // Ranger's Focus: instanceId of the currently focused adversary
  'rangerFocusOnNextAttack',  // Ranger's Focus: use on next weapon attack (toggle)
  'companion',         // Beastbound: { name, species, evasion, maxStress, currentStress }; table stress preserved
  'activeBeastform',           // Druid: current beastform object or null
  'selectedBeastformAdvantage', // Druid: currently selected beastform advantage label or null
  'activeChanneledElement',   // Warden of the Elements: 'fire'|'earth'|'water'|'air' or null
  '_fearlessToggle',           // Fearless (Infernis): _rollDbId of the converted banner, or null
  'wingsOfLightFlying',        // Winged Sentinel: whether the character is currently flying
];

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
  'classId', 'subclassId', 'ancestryIds', 'communityId',
  'armorId', 'primaryWeaponId', 'secondaryWeaponId',
  'abilityIds', 'abilities', 'baseTraits', 'advancements', 'proficiency',
  'background', 'connectionText', 'hopeFeature',
  'weaponMods', 'armorMods',
  'difficultyMod',     // Make a Scene: cumulative difficulty modifier applied by Bard feature
  'vulnerable',        // Retracting Claws (Katari): adversary condition, apply on successful attack
  'focusedBy',         // Ranger's Focus: character name who has this adversary as Focus
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
    case 'character-library-update': {
      return {
        activeElements: activeElements.map(el => {
          if (el.elementType !== 'character' || el.id !== op.characterId) return el;
          const runtime = {};
          CHARACTER_RUNTIME_KEYS.forEach(k => {
            if (k === 'companion') return;
            if (k in el) runtime[k] = el[k];
          });
          const merged = { ...op.newBaseData, ...runtime, elementType: 'character' };
          if (op.newBaseData.companion || el.companion) {
            merged.companion = { ...(op.newBaseData.companion || {}), currentStress: el.companion?.currentStress };
          }
          return merged;
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
    case 'set-gm-display-name':
      return { gmDisplayName: op.gmDisplayName };
    case 'life-support-select': {
      const prev = state.lifeSupportSelections || {};
      const key = String(op._rollDbId);
      const value = op.selectedLifeSupportTargetInstanceId;
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return { lifeSupportSelections: next };
    }
    case 'life-support-clear': {
      const prev = state.lifeSupportSelections || {};
      const next = { ...prev };
      delete next[String(op._rollDbId)];
      return { lifeSupportSelections: next };
    }
    default:
      return {};
  }
}

