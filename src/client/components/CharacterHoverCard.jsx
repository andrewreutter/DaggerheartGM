import { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle, Sparkles, Heart, Shield,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, Bug, Pencil,
} from 'lucide-react';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { CheckboxTrack } from './DetailCardContent.jsx';
import {
  Section,
  CharacterIdentityHeader,
  CharacterTraitGrid,
  CharacterExperiences,
  CharacterDefenseRow,
  CharacterWeaponList,
  CharacterFeatureList,
  CharacterAbilityList,
  CharacterInventory,
  CharacterCompanion,
  TRAIT_FULL,
  WEAPON_TAG_DESCRIPTIONS,
  formatGold,
  parseBeastformBonus,
} from './CharacterDisplay.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { parseFeatureAction, parseSubFeatures } from '../lib/feature-actions.js';
import { weaponFeatures, classFeatures } from '../../features/registry.js';
import { runPipelineHook, runHook } from '../../features/hooks.js';
import { wrapEntity } from '../../features/entity.js';
import { getEffectiveWeaponRange } from '../lib/character-calc.js';
import { rangeBandNameToFt } from '../lib/map-range.js';
import { formatTargetSummary } from '../lib/helpers.js';

// formatGold is re-exported from CharacterDisplay; re-export it for callers that
// already import it from here (keeps backwards-compatibility during migration).
export { formatGold };

/**
 * Append "Vulnerable Target" advantage d6 to rollText, in the same keep-highest pool
 * as any existing advantage dice (last [d6] or [Nd6kh] in the string).
 */
function appendVulnerableTargetToRollText(rollText) {
  const idxD6 = rollText.lastIndexOf(' [d6]');
  const khMatches = [...rollText.matchAll(/ \[\d+d6kh\]/g)];
  const idxKh = khMatches.length > 0 ? khMatches[khMatches.length - 1].index : -1;
  const lastIdx = Math.max(idxD6, idxKh);
  if (lastIdx === -1) {
    return rollText + ' Vulnerable Target [d6]';
  }
  const bracketStart = rollText.indexOf(' [', lastIdx);
  const label = rollText.substring(lastIdx + 1, bracketStart);
  const bracket = rollText.substring(bracketStart);
  const n = bracket === ' [d6]' ? 1 : parseInt(bracket.match(/\d+/)[0], 10);
  return rollText.substring(0, lastIdx) + ' ' + label + ' and Vulnerable Target [' + (n + 1) + 'd6kh]';
}

// ─── Roll text builders ───────────────────────────────────────────────────────

/**
 * Build a roll string for a Daggerheart action roll.
 * Hope [d12] / Fear [d12] are separate expressions so the server can detect
 * which die is dominant.
 */
function buildTraitRollText(charName, traitKey, traitScore, expName) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${traitName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [2]`);
  }
  return parts.join(' ');
}

/** Returns true when a feature has no per-attack banner effect (passive stat mods only). */
function isSkipTagFeature(name) {
  return weaponFeatures[name]?.skipTag ?? false;
}

/**
 * Build descriptive tag text for a feature in the roll banner.
 * Delegates to the feature registry's `tagText` property (string or function).
 * Falls back to SRD text or WEAPON_TAG_DESCRIPTIONS for unregistered features.
 */
function buildFeatureTagText(feature, traits, level) {
  const f = weaponFeatures[feature.name];
  if (f) {
    const t = f.tagText;
    if (typeof t === 'function') return t({ traits, level });
    if (typeof t === 'string') return t;
  }
  return feature.text || feature.description || WEAPON_TAG_DESCRIPTIONS[feature.name] || '';
}

function buildWeaponRollText(charName, weaponName, traitKey, traitScore, expName, damageStr, feature, traits, level, opts = {}) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${weaponName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [2]`);
  }

  const featureSet = feature?.name ? [feature.name] : [];
  const rollCtx = { traits, level, opts };

  // Pre-damage additions (e.g. Reliable [1])
  for (const name of featureSet) {
    const f = weaponFeatures[name];
    if (f?.prependRollParts) parts.push(...(f.prependRollParts(rollCtx) || []));
  }

  // Damage string — rewrite via pipeline hook, except when devastating toggle overrides
  if (damageStr) {
    let effectiveDamage = damageStr;
    if (opts.devastating) {
      const dm = damageStr.trim().match(/^(\d*d\d+)([+-]\d+)?(.*)$/i);
      if (dm) effectiveDamage = `d20${dm[2] || ''}${dm[3] || ''}`;
    } else {
      effectiveDamage = runPipelineHook(weaponFeatures, featureSet, 'rewriteDamage', damageStr, rollCtx);
    }
    const m = effectiveDamage.trim().match(/^([^\s]+)(?:\s+(.+))?$/);
    if (m) {
      parts.push(`damage [${m[1]}]`);
      if (m[2]) parts.push(m[2].toLowerCase());
    }
  }

  // Post-damage additions (e.g. Reload [d6], Invigorate [d4], Lifesteal [d6])
  for (const name of featureSet) {
    const f = weaponFeatures[name];
    if (f?.appendRollParts) parts.push(...(f.appendRollParts(rollCtx) || []));
  }

  // Feature tag (skip purely passive features)
  if (feature && !isSkipTagFeature(feature.name)) {
    let tagText;
    if (opts.devastating) {
      tagText = 'd20 damage die, mark 1 Stress (active)';
    } else if (feature.name === 'Doubled Up' && opts.secondaryDamage) {
      tagText = `${opts.secondaryDamage} -- deal to another Melee target`;
    } else {
      tagText = buildFeatureTagText(feature, traits, level);
    }
    if (tagText) parts.push(`{${feature.name}: ${tagText}}`);
  }
  return parts.join(' ');
}

// ─── Collapsible JSON tree (for debug panel) ──────────────────────────────────

function JsonTree({ data, label, depth = 0, defaultOpen }) {
  const isOpen = defaultOpen ?? depth < 1;
  const [open, setOpen] = useState(isOpen);

  if (data === null || data === undefined) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-slate-500 italic">null</span>
      </span>
    );
  }

  if (typeof data !== 'object') {
    const color = typeof data === 'string' ? 'text-emerald-400'
      : typeof data === 'number' ? 'text-amber-300'
      : typeof data === 'boolean' ? 'text-sky-400'
      : 'text-slate-300';
    const display = typeof data === 'string' ? `"${data}"` : String(data);
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className={color}>{display}</span>
      </span>
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
  const brackets = isArray ? ['[', ']'] : ['{', '}'];

  if (entries.length === 0) {
    return (
      <span className="inline">
        {label != null && <span className="text-violet-300">{label}: </span>}
        <span className="text-slate-600">{brackets[0]}{brackets[1]}</span>
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-0.5 hover:bg-slate-800/60 rounded px-0.5 -ml-0.5 transition-colors text-left"
      >
        {open
          ? <ChevronDown size={9} className="text-slate-500 shrink-0" />
          : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
        {label != null && <span className="text-violet-300">{label}: </span>}
        {!open && (
          <span className="text-slate-600">
            {brackets[0]}<span className="text-slate-500 mx-0.5">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>{brackets[1]}
          </span>
        )}
        {open && <span className="text-slate-600">{brackets[0]}</span>}
      </button>
      {open && (
        <div className="pl-3 border-l border-slate-800 ml-1">
          {entries.map(([key, val]) => (
            <div key={key} className="leading-relaxed">
              <JsonTree data={val} label={isArray ? String(key) : key} depth={depth + 1} />
            </div>
          ))}
          <span className="text-slate-600">{brackets[1]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CharacterHoverCard — detailed character sheet panel.
 *
 * Props:
 *   el              — character element from activeElements
 *   updateFn        — (instanceId, patch) => void
 *   onResync        — () => void  (optional; triggers re-sync from Daggerstack)
 *   isSyncing       — bool
 *   onRoll          — (rollText, displayName, rollMeta?) => void
 *   onSpendHope     — (instanceId) => void
 *   onUseHopeAbility — (instanceId) => void  (legacy; now routed through onFeatureUse)
 *   showResources   — bool
 *   onEdit          — () => void
 *   onDebugMouseEnter / onDebugMouseLeave — for debug panel hover
 *   onActionNotification — (data) => void
 */

/**
 * Compute the total roll-modifier bonus for a given roll type.
 * Auto-apply mods matching the type are always included (e.g. Channeling on
 * spellcast rolls). The manually-selected mod is added only when it is not
 * auto-apply (i.e. situational mods like Quiet that the player activates).
 */
function getRollModBonus(rollModifiers, activeRollMod, rollType) {
  const autoBonus = rollModifiers
    .filter(rm => rm.autoApply && rm.rollType === rollType)
    .reduce((sum, rm) => sum + rm.score, 0);
  const manualBonus = activeRollMod && !activeRollMod.autoApply ? activeRollMod.score : 0;
  return autoBonus + manualBonus;
}

export function CharacterHoverCard({
  el,
  updateFn,
  expandedKeys,
  onToggleFeature,
  onResync,
  isSyncing,
  onRoll,
  onSpendHope,
  onUseHopeAbility,
  showResources = false,
  onEdit,
  onDebugMouseEnter,
  onDebugMouseLeave,
  onActionNotification,
  activeElements,
  mapConfig,
  hideCompanionSection = false,
  pendingResourceCosts = {},
  isPlayer = false,
  getValidTargets,
}) {
  const [showDebug, setShowDebug] = useState(false);
  const [devastatingActive, setDevastatingActive] = useState(false);
  const [selectedRollModIndex, setSelectedRollModIndex] = useState(null);
  const [selectedModId, setSelectedModId] = useState(null);
  const [selectedAdvIds, setSelectedAdvIds] = useState(() => []);
  // For features that requiresInputForFeature (e.g. Sorcerer Channel Raw Power)
  const [featureInputPending, setFeatureInputPending] = useState(null); // { feature, subFeature, action, spec }
  const [featureInputValue, setFeatureInputValue] = useState('');
  // Druid beastform selection (shared by Beastform class feature and Evolution hope ability)
  const [selectedBeastformId, setSelectedBeastformId] = useState(null);
  // In-place target menu before sending roll: { type: 'weapon'|'beastform', rollText, displayName, rollMeta, validTargets, opts?, anchorRect? }
  const [targetMenuPending, setTargetMenuPending] = useState(null);

  useEffect(() => {
    if (!targetMenuPending) return;
    const onKey = (e) => { if (e.key === 'Escape') setTargetMenuPending(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [targetMenuPending]);

  const { srdData } = useCharacterSrdData();

  const traits = el.traits || {};
  const hasDaggerstack = !!el.daggerstackUrl;
  const rollModifiers = el.armorMods?.rollModifiers || [];
  const activeRollMod = selectedRollModIndex != null ? rollModifiers[selectedRollModIndex] : null;
  const activeModifiers = el.activeModifiers || [];
  const selectedMod = selectedModId != null ? activeModifiers.find(m => m.id === selectedModId) : null;

  // Compute modifier eligibility for class features that auto-enable/disable chips
  // (e.g. Rogue's Sneak Attack requires Cloaked or ally-in-Melee proximity).
  const modifierEligibility = useMemo(() => {
    const classFeat = classFeatures[el.class];
    if (!classFeat?.computeModifierEligibility) return {};
    return classFeat.computeModifierEligibility({
      el,
      activeElements: activeElements ?? [],
      mapConfig: mapConfig ?? {},
    }) || {};
  }, [el, activeElements, mapConfig]);

  // Advantage chips: features with "You have advantage on rolls to..." (parsed at render time)
  const advantageChips = useMemo(() => {
    const chips = [];
    let idx = 0;
    const featureArrays = [
      ...(el.classFeatures || []),
      ...(el.subclassFeatures || []),
      ...(el.ancestryFeatures || []),
      ...(el.communityFeatures || []),
    ];
    for (const f of featureArrays) {
      const desc = f.description || f.text || '';
      const parsed = parseFeatureAction(desc);
      if (parsed.advantageCondition) {
        chips.push({ id: `adv-${f.name}-${idx++}`, name: f.name, condition: parsed.advantageCondition, dice: 'd6', mode: 'advantage' });
      }
      const subFeatures = parseSubFeatures(desc);
      for (const sub of subFeatures) {
        const subParsed = parseFeatureAction(sub.description || '');
        if (subParsed.advantageCondition) {
          chips.push({ id: `adv-${sub.name}-${idx++}`, name: sub.name, condition: subParsed.advantageCondition, dice: 'd6', mode: 'advantage' });
        }
      }
    }
    for (const w of el.weapons || []) {
      const feat = w.feature;
      if (!feat) continue;
      const desc = feat.description || feat.text || '';
      const parsed = parseFeatureAction(desc);
      if (parsed.advantageCondition) {
        chips.push({ id: `adv-${feat.name || w.name}-${idx++}`, name: feat.name || w.name, condition: parsed.advantageCondition, dice: 'd6', mode: 'advantage' });
      }
    }
    return chips;
  }, [el]);

  // ── Feature roll text builder ────────────────────────────────────────────────
  // Builds the roll text string for a feature that has dice or a spellcast roll.
  const buildFeatureRollText = (feature, subFeature, action) => {
    const charName = el.name;
    const featName = subFeature ? subFeature.name : feature.name;
    const parts = [];

    if (action.spellcastDC != null) {
      // Spellcast roll: Hope [d12] Fear [d12] + spellcast trait (include beastform bonus)
      const traitKey = (el.spellcastTrait || 'presence').toLowerCase();
      const bfForSpellcast = parseBeastformBonus(el.activeBeastform?.trait_bonus);
      const beastformBonus = bfForSpellcast?.stat === traitKey ? bfForSpellcast.bonus : 0;
      const baseScore = traits[traitKey] ?? 0;
      const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, 'spellcast');
      const modBonus = selectedMod?.mode === 'roll' && selectedMod.dice ? 0 : (selectedMod?.bonus ?? 0);
      const effectiveScore = baseScore + beastformBonus + rollModBonus + modBonus;
      parts.push(`${charName} ${featName} Hope [d12] Fear [d12]`);
      if (effectiveScore !== 0) {
        parts.push(`${TRAIT_FULL[traitKey] || traitKey} [${effectiveScore}]`);
      }
      parts.push(`{${featName}: Spellcast Roll DC ${action.spellcastDC}}`);
    } else if (action.dice.length > 0) {
      // Generic dice roll (e.g. Rally d6, Prayer d4, Ranger's Focus d12+d12)
      const diceExpr = action.dice.join('+');
      // Check if it's a Daggerheart action roll (has d12s that should be Hope/Fear)
      const hasDualD12 = action.dice.filter(d => d === 'd12').length >= 2 || (action.dice.includes('d12') && action.dice.length === 1);
      if (hasDualD12 && action.dice.length <= 2) {
        const traitKey = Object.keys(traits)[0] || 'agility';
        parts.push(`${charName} ${featName} Hope [d12] Fear [d12]`);
      } else {
        parts.push(`${charName} ${featName} [${diceExpr}]`);
      }
    }

    // Append cost tags so the ResultBanner can display them
    if (action.hopeCost > 0)  parts.push(`{HopeCost: Spend ${action.hopeCost} Hope}`);
    if (action.stressCost > 0) parts.push(`{StressCost: Mark ${action.stressCost} Stress}`);
    if (action.armorClear > 0) parts.push(`{ArmorClear: Clear ${action.armorClear} Armor slot}`);
    if (action.armorMark > 0)  parts.push(`{ArmorMark: Mark ${action.armorMark} Armor slot}`);

    // Include selected active modifier (roll-mode die) in the roll
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      parts.push(`${selectedMod.name} [${selectedMod.dice}]`);
    }

    return parts.join(' ');
  };

  // ── Feature use handler ──────────────────────────────────────────────────────
  // Called when user clicks Use on a feature or a SubFeatureCard.
  const handleFeatureUse = onRoll || onActionNotification ? (feature, subFeature = null, event = null) => {
    // Sorcerer Channel Raw Power (and any future class feature) requires an input value
    // before dispatch. Show an inline prompt and defer actual dispatch until submitted.
    const classFeat = classFeatures[el.class];
    const requiredInputSpec = classFeat?.requiresInputForFeature?.[feature.name];
    if (requiredInputSpec && !featureInputPending) {
      const action = subFeature
        ? parseFeatureAction(subFeature.description || '')
        : parseFeatureAction(feature.description || '');
      setFeatureInputPending({ feature, subFeature, action, spec: requiredInputSpec });
      setFeatureInputValue(String(requiredInputSpec.default ?? 1));
      return;
    }

    const activeDesc = subFeature ? (subFeature.description || '') : (feature.description || '');
    const parentAction = subFeature ? parseFeatureAction(feature.description || '') : null;
    const action = subFeature ? parseFeatureAction(subFeature.description || '') : parseFeatureAction(feature.description || '');
    if (parentAction) {
      if (action.stressCost === 0) action.stressCost = parentAction.stressCost;
      if (action.hopeCost === 0) action.hopeCost = parentAction.hopeCost;
    }
    // Sub-feature cost may come from name, e.g. "Hold Them Off (3 Hope)" — prefer that over re-parsed description
    if (subFeature && typeof subFeature.hopeCost === 'number') action.hopeCost = subFeature.hopeCost;
    const featName = subFeature ? subFeature.name : feature.name;

    // Feature-level key for usage tracking (uses parent feature name)
    const featureKeyIdx = [
      ...(el.classFeatures || []),
      ...(el.subclassFeatures || []),
      ...(el.ancestryFeatures || []),
      ...(el.communityFeatures || []),
    ].findIndex(f => f.name === feature.name);
    const featureKey = `${feature.name}-${featureKeyIdx >= 0 ? featureKeyIdx : 0}`;

    // ── Prayer Dice: roll Nd4, chips are created from results on banner dismiss ──
    // Bypass the target-picker path entirely — the description mentions "ally" but
    // clicking Prayer Dice is just rolling, not spending a specific die yet.
    if (feature.name === 'Prayer Dice') {
      const spellcastCount = (el.spellcastTrait && el.traits?.[el.spellcastTrait])
        ? el.traits[el.spellcastTrait]
        : 2;
      const diceExprs = Array(Math.max(1, spellcastCount)).fill('[d4]').join(' ');
      const rollText = `${el.name} Prayer Dice ${diceExprs}`;
      const displayName = `${el.name} Prayer Dice`;  // shown as banner header
      const prayerRollMeta = {
        _featureUse: true,
        _isPrayerDiceRoll: true,
        _attackerInstanceId: el.instanceId,
        _featureName: 'Prayer Dice',
        _featureKey: featureKey,
        _frequency: 'session',
      };
      onRoll?.(rollText, displayName, prayerRollMeta);
      return;
    }

    // ── Feature-specific modifier additions ──────────────────────────────────
    // Rally: give all party members a Rally Die
    const isRally = feature.name === 'Rally' || feature.name?.toLowerCase().includes('rally');
    const rallyDieSize = el.level >= 5 ? 'd8' : 'd6';
    const _addModifiers = isRally ? [{
      id: `rally-die-${el.instanceId}-${Date.now()}`,
      name: 'Rally Die',
      dice: rallyDieSize,
      mode: 'roll',
      consumeOnUse: true,
      refreshOn: 'session',
    }] : [];
    const _distributeModifiersToAll = isRally;

    // _inputValue carries card level / numeric inputs (e.g. Sorcerer Channel Raw Power)
    const inputVal = featureInputPending?.feature?.name === feature.name
      ? (parseFloat(featureInputValue) || (featureInputPending.spec?.default ?? 1))
      : null;
    if (featureInputPending) setFeatureInputPending(null);

    const forceAction = classFeat?.forceActionNotificationFeatures?.includes(feature.name);
    const hasDice = !forceAction && (action.dice.length > 0 || action.spellcastDC != null);
    // Only add experience Hope cost when this feature use involves a roll (experience is used in the roll)
    const rollMeta = {
      _featureUse: true,
      _attackerInstanceId: el.instanceId,
      _featureName: feature.name,
      _subFeatureName: subFeature?.name || null,
      _hopeCost: action.hopeCost,
      _stressCost: action.stressCost,
      _armorMark: action.armorMark,
      _armorClear: action.armorClear,
      _frequency: action.frequency,
      _featureKey: featureKey,
      _targetType: action.targetType,
      ...(inputVal !== null ? { _inputValue: inputVal } : {}),
      ...(_addModifiers.length > 0 ? { _addModifiers, _distributeModifiersToAll } : {}),
      ...(el.selectedExperienceIndex != null && hasDice ? { _experienceHopeCost: 1 } : {}),
      // Druid Evolution: inject the selected beastform so onFeatureActivated can set activeBeastform
      ...(el.class === 'Druid' && feature.name === 'Evolution' && selectedBeastform
        ? { _beastform: selectedBeastform }
        : {}),
    };

    if (hasDice) {
      // Dice roll path — experience Hope cost applied on GM ack, not here
      let rollText = buildFeatureRollText(feature, subFeature, action);
      if (!rollText) return;
      const selectedAdvs = (selectedAdvIds || []).map(id => advantageChips.find(c => c.id === id)).filter(Boolean);
      if (selectedAdvs.length > 0) rollText += selectedAdvs.length === 1 ? ` ${selectedAdvs[0].name} [d6]` : ` ${selectedAdvs.map(a => a.name).join(' and ')} [${selectedAdvs.length}d6kh]`;
      const displayName = subFeature ? `${el.name} ${feature.name}: ${subFeature.name}` : `${el.name} ${feature.name}`;
      onRoll?.(rollText, displayName, rollMeta);
      if (selectedMod) setSelectedModId(null);
      if (selectedAdvs.length) setSelectedAdvIds([]);
    } else {
      // Action notification path (costs but no dice, or comms-only)
      const truncDesc = activeDesc.length > 150 ? activeDesc.slice(0, 150) + '…' : activeDesc;
      // Rally (Bard): banner message for whole party
      const actionText = isRally
        ? 'Everyone gets a Rally Die to add to their next action roll, or to clear Stress equal to the result.'
        : truncDesc;
      const notification = {
        _action: true,
        rollUser: el.name,
        actionName: featName,
        actionText,
        tags: [
          ...(action.hopeCost > 0  ? [{ name: 'HopeCost',  text: `Spend ${action.hopeCost} Hope` }]  : []),
          ...(action.stressCost > 0 ? [{ name: 'StressCost', text: `Mark ${action.stressCost} Stress` }] : []),
          ...(action.armorClear > 0 ? [{ name: 'ArmorClear', text: `Clear ${action.armorClear} Armor slot` }] : []),
          ...(action.armorMark > 0  ? [{ name: 'ArmorMark',  text: `Mark ${action.armorMark} Armor slot` }]  : []),
        ],
        ...rollMeta,
      };

      // Features that require an adversary target: show in-place picker at click time,
      // like weapon attacks. Picker appears before the notification is sent so both
      // GM and players select the target when initiating the action.
      // Skip picker for force-action features (e.g. Elemental Incarnation Fire/Water) where target is unused.
      if (action.targetType === 'adversary' && getValidTargets && onActionNotification && !forceAction) {
        const closeFt = rangeBandNameToFt('Close') ?? 30;
        let validTargets = getValidTargets(el.instanceId, { weaponRangeFt: closeFt }) ?? [];
        if (validTargets.length === 0) {
          // Attacker not on map or no targets in range: fall back to ALL adversaries
          validTargets = (getValidTargets(el.instanceId, {}) ?? []).filter(t => t.type === 'adversary');
        }
        const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
        setTargetMenuPending({ type: 'feature_action', notification, validTargets, anchorRect });
        return;
      }

      onActionNotification?.(notification);
    }
  } : undefined;

  // Beastform trait bonus for rolls (must match display in CharacterTraitGrid)
  const beastformTraitBonus = parseBeastformBonus(el.activeBeastform?.trait_bonus);
  const getBeastformTraitBonus = (traitKey) =>
    (beastformTraitBonus?.stat === traitKey ? beastformTraitBonus.bonus : 0);

  // ── Trait click handler ──────────────────────────────────────────────────────
  const handleTraitClick = onRoll ? (traitKey) => {
    const activeExp = el.selectedExperienceIndex != null
      ? (el.experiences || [])[el.selectedExperienceIndex]
      : null;
    const baseScore = traits[traitKey] ?? 0;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    const effectiveScore = baseScore + getBeastformTraitBonus(traitKey) + rollModBonus;
    let rollText = buildTraitRollText(el.name, traitKey, effectiveScore, activeExp?.name);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    // Air (Elemental Incarnation): auto-apply d6 advantage on Agility rolls
    if (traitKey === 'agility' && el.activeChanneledElement === 'air') {
      rollText += ' Air [d6]';
    }
    const selectedAdvs = (selectedAdvIds || []).map(id => advantageChips.find(c => c.id === id)).filter(Boolean);
    if (selectedAdvs.length > 0) rollText += selectedAdvs.length === 1 ? ` ${selectedAdvs[0].name} [d6]` : ` ${selectedAdvs.map(a => a.name).join(' and ')} [${selectedAdvs.length}d6kh]`;
    const displayName = `${el.name} ${TRAIT_FULL[traitKey]}`;
    const traitRollMeta = { _attackerInstanceId: el.instanceId, _traitKey: traitKey };
    if (selectedMod?.consumeOnUse) traitRollMeta._usedModifierId = selectedMod.id;
    if (el.selectedExperienceIndex != null) traitRollMeta._experienceHopeCost = 1;
    onRoll(rollText, displayName, traitRollMeta);
    if (selectedMod) setSelectedModId(null);
    if (selectedAdvs.length) setSelectedAdvIds([]);
  } : undefined;

  const selectedExpHint = el.selectedExperienceIndex != null
    ? `+2 from "${(el.experiences || [])[el.selectedExperienceIndex]?.name}" included`
    : undefined;

  // ── Spellcast roll handler ─────────────────────────────────────────────────
  const handleSpellcastRoll = onRoll && el.spellcastTrait ? () => {
    const traitKey = el.spellcastTrait.toLowerCase();
    const baseScore = traits[traitKey] ?? 0;
    const activeExp = el.selectedExperienceIndex != null
      ? (el.experiences || [])[el.selectedExperienceIndex]
      : null;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, 'spellcast');
    const effectiveScore = baseScore + getBeastformTraitBonus(traitKey) + rollModBonus;
    let rollText = buildTraitRollText(el.name + ' Spellcast', traitKey, effectiveScore, activeExp?.name);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const selectedAdvs = (selectedAdvIds || []).map(id => advantageChips.find(c => c.id === id)).filter(Boolean);
    if (selectedAdvs.length > 0) rollText += selectedAdvs.length === 1 ? ` ${selectedAdvs[0].name} [d6]` : ` ${selectedAdvs.map(a => a.name).join(' and ')} [${selectedAdvs.length}d6kh]`;
    const displayName = `${el.name} Spellcast`;
    const spellcastRollMeta = { _attackerInstanceId: el.instanceId, _traitKey: traitKey };
    if (selectedMod?.consumeOnUse) spellcastRollMeta._usedModifierId = selectedMod.id;
    if (el.selectedExperienceIndex != null) spellcastRollMeta._experienceHopeCost = 1;
    onRoll(rollText, displayName, spellcastRollMeta);
    if (selectedMod) setSelectedModId(null);
    if (selectedAdvs.length) setSelectedAdvIds([]);
  } : undefined;

  // Send roll (used after target selection or when no target menu needed)
  const sendWeaponRoll = (rollText, displayName, rollMeta, opts) => {
    onRoll(rollText, displayName, rollMeta);
    if (selectedMod) setSelectedModId(null);
    if ((selectedAdvIds || []).length) setSelectedAdvIds([]);
    if (opts?.devastating) {
      const maxStress = el.maxStress ?? 6;
      const newStress = Math.min((el.currentStress ?? 0) + 1, maxStress);
      updateFn(el.instanceId, { currentStress: newStress });
      setDevastatingActive(false);
    }
  };

  // ── Weapon click handler ─────────────────────────────────────────────────────
  const handleWeaponClick = onRoll ? (weapon, rollMeta = {}, event = null) => {
    const traitKey = (weapon.trait || '').toLowerCase();
    const baseTrait = traits[traitKey] ?? 0;
    const activeExp = el.selectedExperienceIndex != null
      ? (el.experiences || [])[el.selectedExperienceIndex]
      : null;
    const opts = {};
    if (rollMeta.devastating) opts.devastating = true;
    if (rollMeta.secondaryDamage) opts.secondaryDamage = rollMeta.secondaryDamage;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    const effectiveTrait = baseTrait + getBeastformTraitBonus(traitKey) + rollModBonus;
    let rollText = buildWeaponRollText(
      el.name, weapon.name, traitKey, effectiveTrait,
      activeExp?.name, weapon.damage, weapon.feature, traits, el.level, opts,
    );
    const rangeStr = (weapon.effectiveRange ?? getEffectiveWeaponRange(weapon, el.ancestryFeatures)) || weapon.range;
    if (rangeStr) rollText += ` ${rangeStr}`;
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const selectedAdvs = (selectedAdvIds || []).map(id => advantageChips.find(c => c.id === id)).filter(Boolean);
    if (selectedAdvs.length > 0) rollText += selectedAdvs.length === 1 ? ` ${selectedAdvs[0].name} [d6]` : ` ${selectedAdvs.map(a => a.name).join(' and ')} [${selectedAdvs.length}d6kh]`;
    let displayName = `${el.name} ${weapon.name}`;
    rollMeta._attackerInstanceId = el.instanceId;
    rollMeta._traitKey = (weapon.trait || '').toLowerCase();
    if (rangeStr) {
      const ft = rangeBandNameToFt(rangeStr);
      if (ft != null) rollMeta._weaponRangeFt = ft;
    }
    if (selectedMod?.consumeOnUse) rollMeta._usedModifierId = selectedMod.id;
    if (el.selectedExperienceIndex != null) rollMeta._experienceHopeCost = 1;
    if (weapon._retractingClaws) rollMeta._retractingClaws = true;
    if (weapon._kick) rollMeta._stressCost = 1;
    // Ranger's Focus: use on next attack (toggle adds Hope cost and title suffix)
    if (el.rangerFocusOnNextAttack && updateFn) {
      rollMeta._rangerFocusAttempt = true;
      rollMeta._hopeCost = (rollMeta._hopeCost || 0) + 1;
      displayName = `${el.name} ${weapon.name} with Ranger's Focus attempt`;
    }

    if (getValidTargets && (rollMeta._weaponRangeFt != null || rollMeta._retractingClaws)) {
      const validTargets = getValidTargets(el.instanceId, {
        weaponRangeFt: rollMeta._weaponRangeFt,
        retractingClaws: rollMeta._retractingClaws,
      }) ?? [];
      const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
      setTargetMenuPending({ type: 'weapon', rollText, displayName, rollMeta, validTargets, opts, anchorRect });
      if (validTargets.length === 0) return; // don't send roll; popup will show "No targets in range"
      return;
    }
    sendWeaponRoll(rollText, displayName, rollMeta, opts);
    if (rollMeta._rangerFocusAttempt && updateFn) updateFn(el.instanceId, { rangerFocusOnNextAttack: false });
  } : undefined;

  const handleTargetMenuSelect = (target) => {
    if (!targetMenuPending) return;
    let { type, rollText, displayName, rollMeta, opts, notification } = targetMenuPending;

    // Action notification with pre-selected target (e.g. Make a Scene, Bard)
    if (type === 'feature_action') {
      onActionNotification?.({
        ...notification,
        _selectedTargetInstanceId: target.instanceId,
        _selectedTargetName: target.name,
      });
      setTargetMenuPending(null);
      return;
    }

    if (target.type === 'adversary' && target.vulnerable) {
      rollText = appendVulnerableTargetToRollText(rollText);
    }
    onRoll(rollText, displayName, { ...rollMeta, _selectedTargetInstanceId: target.instanceId });
    if (type === 'weapon') {
      if (rollMeta._rangerFocusAttempt && updateFn) updateFn(el.instanceId, { rangerFocusOnNextAttack: false });
      if (selectedMod) setSelectedModId(null);
      if ((selectedAdvIds || []).length) setSelectedAdvIds([]);
      if (opts?.devastating) {
        const maxStress = el.maxStress ?? 6;
        const newStress = Math.min((el.currentStress ?? 0) + 1, maxStress);
        updateFn(el.instanceId, { currentStress: newStress });
        setDevastatingActive(false);
      }
    }
    setTargetMenuPending(null);
  };

  const handleTargetMenuCancel = () => {
    setTargetMenuPending(null);
  };

  // ── Beastform helpers ────────────────────────────────────────────────────────

  /**
   * Parse a beastform attack string like "Melee Agility d4 phy" into parts.
   * Returns { range, traitKey, damage, dmgType } or null.
   */
  const parseBeastformAttack = (attackStr) => {
    const parts = (attackStr || '').trim().split(/\s+/);
    if (parts.length < 3) return null;
    return {
      range: parts[0],
      traitKey: parts[1].toLowerCase(),
      damage: parts[2],
      dmgType: parts[3] || '',
    };
  };

  // Resolved beastforms filtered to character's tier
  const availableBeastforms = useMemo(() => {
    const allBf = srdData?.beastforms || [];
    const tier = el.tier || 1;
    return allBf.filter(b => b.tier <= tier);
  }, [srdData, el.tier]);

  // Currently selected beastform object (for Beastform card and Evolution)
  const selectedBeastform = useMemo(() => {
    if (!srdData) return null;
    if (selectedBeastformId) return srdData.beastformsById?.[selectedBeastformId] || null;
    return availableBeastforms[0] || null;
  }, [srdData, selectedBeastformId, availableBeastforms]);

  // Use Beastform (1 Stress, once per rest)
  const handleUseBeastform = onActionNotification ? (beastform) => {
    const featureKeyIdx = (el.classFeatures || []).findIndex(f => f.name === 'Beastform');
    const featureKey = `Beastform-${featureKeyIdx >= 0 ? featureKeyIdx : 0}`;
    onActionNotification({
      _action: true,
      rollUser: el.name,
      actionName: 'Beastform',
      actionText: `${el.name} transforms into ${beastform.name}!`,
      tags: [{ name: 'StressCost', text: 'Mark 1 Stress' }],
      _featureUse: true,
      _attackerInstanceId: el.instanceId,
      _featureName: 'Beastform',
      _stressCost: 1,
      _frequency: 'rest',
      _featureKey: featureKey,
      _beastform: beastform,
    });
  } : undefined;

  // Drop Out of Beastform (no cost; GM ack applies state via Druid.onFeatureActivated)
  const handleDropOutBeastform = onActionNotification ? () => {
    onActionNotification({
      _action: true,
      rollUser: el.name,
      actionName: 'Drop out of Beastform',
      actionText: `${el.name} drops out of Beastform.`,
      _featureUse: true,
      _attackerInstanceId: el.instanceId,
      _featureName: 'Drop out of Beastform',
    });
  } : undefined;

  // Click to set/clear the selected beastform advantage (mutually exclusive)
  const handleBeastformAdvantageSelect = updateFn ? (adv) => {
    updateFn(el.instanceId, { selectedBeastformAdvantage: adv });
  } : undefined;

  // Build and fire a beastform attack roll
  const handleBeastformAttack = onRoll && el.activeBeastform ? (event = null) => {
    const bf = el.activeBeastform;
    const parsed = parseBeastformAttack(bf.attack);
    if (!parsed) return;
    const { range, traitKey, damage, dmgType } = parsed;
    const traitScore = traits[traitKey] ?? 0;
    const bfBonus = parseBeastformBonus(bf.trait_bonus);
    const effectiveScore = traitScore + (bfBonus?.stat === traitKey ? bfBonus.bonus : 0);
    const traitName = TRAIT_FULL[traitKey] || traitKey;
    const profBonus = el.proficiency ? `+${el.proficiency}` : '';
    const dmgStr = profBonus ? `${damage}${profBonus}` : damage;
    let rollText = `${el.name} ${bf.name} ${traitName} Hope [d12] Fear [d12]`;
    if (effectiveScore !== 0) rollText += ` ${traitName} [${effectiveScore}]`;
    rollText += ` damage [${dmgStr}]`;
    if (dmgType) rollText += ` ${dmgType}`;
    if (range) rollText += ` ${range}`;
    if (el.selectedBeastformAdvantage) rollText += ` ${el.selectedBeastformAdvantage} [d6]`;
    const displayName = `${el.name} ${bf.name}`;
    const beastformRollMeta = { _attackerInstanceId: el.instanceId };
    if (range) {
      const ft = rangeBandNameToFt(range);
      if (ft != null) beastformRollMeta._weaponRangeFt = ft;
    }
    if (getValidTargets && beastformRollMeta._weaponRangeFt != null) {
      const validTargets = getValidTargets(el.instanceId, {
        weaponRangeFt: beastformRollMeta._weaponRangeFt,
        retractingClaws: false,
      }) ?? [];
      const anchorRect = event?.currentTarget?.getBoundingClientRect() ?? null;
      setTargetMenuPending({ type: 'beastform', rollText, displayName, rollMeta: beastformRollMeta, validTargets, anchorRect });
      if (validTargets.length === 0) return; // don't send roll; popup will show "No targets in range"
      return;
    }
    onRoll(rollText, displayName, beastformRollMeta);
  } : undefined;

  // beastformProps — passed into CharacterFeatureList and CharacterWeaponList
  const beastformProps = el.class === 'Druid' ? {
    beastforms: availableBeastforms,
    selectedBeastformId: selectedBeastformId || availableBeastforms[0]?.id || null,
    onBeastformSelect: setSelectedBeastformId,
    activeBeastform: el.activeBeastform || null,
    onUseBeastform: handleUseBeastform,
    onDropOutBeastform: handleDropOutBeastform,
  } : null;

  // ── Header action buttons ────────────────────────────────────────────────────
  const headerActions = (
    <>
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit character"
          className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"
        >
          <Pencil size={11} />
        </button>
      )}
      {(el._daggerstackDebug || el._daggerstackLookupTables) && (
        <button
          onClick={() => setShowDebug(d => !d)}
          title="Debug: view raw Daggerstack payloads"
          className={`p-1 rounded transition-colors ${showDebug ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
        >
          <Bug size={11} />
        </button>
      )}
      {hasDaggerstack && onResync && (
        <button
          onClick={onResync}
          disabled={isSyncing}
          title="Re-sync from Daggerstack"
          className="p-1 rounded text-slate-500 hover:text-sky-400 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      )}
      {hasDaggerstack && (
        <a
          href={el.daggerstackUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on Daggerstack"
          className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </>
  );

  const stressMaxed = (el.currentStress ?? 0) >= (el.maxStress ?? 6);
  const currentHope = el.hope ?? (el.maxHope ?? 6);

  return (
    <div className="relative flex flex-col flex-1 min-h-0">

    {/* ── Target selection popover (fixed, anchored to clicked weapon card) ── */}
    {targetMenuPending && (() => {
      const rect = targetMenuPending.anchorRect;
      const top = rect ? Math.min(rect.bottom + 4, window.innerHeight - 160) : window.innerHeight / 2;
      const left = rect ? Math.min(rect.left, window.innerWidth - 200) : window.innerWidth / 2;
      return (
        <>
          {/* Transparent backdrop — click to dismiss */}
          <div
            className="fixed inset-0 z-[200]"
            onClick={handleTargetMenuCancel}
          />
          {/* Popover */}
          <div
            className="fixed z-[201] rounded-lg border border-amber-600/70 bg-slate-900 shadow-2xl p-2 space-y-2"
            style={{ top, left, minWidth: '140px', maxWidth: '220px' }}
          >
            <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide">
              {targetMenuPending.validTargets.length > 0 ? 'Choose target' : 'No targets in range'}
            </div>
            <div className="space-y-1">
              {targetMenuPending.validTargets.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic px-1 py-1">No valid targets are in range of this attack.</p>
              ) : targetMenuPending.validTargets.map((t) => {
                const sum = formatTargetSummary(t, { hideMax: isPlayer });
                return (
                  <button
                    key={t.instanceId}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTargetMenuSelect(t); }}
                    className="w-full text-left px-2 py-1.5 rounded text-xs font-medium border border-amber-600/60 bg-slate-800/80 text-slate-200 hover:bg-amber-800/60 hover:border-amber-500 transition-colors"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{t.name}</span>
                      {t.vulnerable && (
                        <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-900/60 border border-amber-600/70 text-amber-200" title="Attacker gains advantage die: Vulnerable Target">Vulnerable</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {[sum.hp, sum.stress].filter(Boolean).join(' · ')}
                      {sum.conditions ? ` · ${sum.conditions}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTargetMenuCancel(); }}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      );
    })()}

    <div className="w-[22rem] bg-slate-900 border border-sky-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">

      {/* ── Header ── */}
      <div className="shrink-0">
        <CharacterIdentityHeader el={el} actions={headerActions} />
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">

        {/* ── Traits ── */}
        <CharacterTraitGrid
          el={el}
          onTraitClick={handleTraitClick}
          onSpellcastRoll={handleSpellcastRoll}
          selectedExperienceHint={selectedExpHint}
        />

        {/* ── Experiences + Modifier Bin ── */}
        <CharacterExperiences
          el={el}
          selectedIndex={el.selectedExperienceIndex}
          onSelect={updateFn ? (i) => updateFn(el.instanceId, { selectedExperienceIndex: i }) : undefined}
          hope={currentHope}
          maxHope={el.maxHope ?? 6}
          rollModifiers={rollModifiers}
          selectedRollModIndex={selectedRollModIndex}
          onSelectRollMod={onRoll ? setSelectedRollModIndex : undefined}
          selectedModId={selectedModId}
          onSelectMod={onRoll ? setSelectedModId : undefined}
          advantageChips={advantageChips}
          selectedAdvIds={selectedAdvIds}
          onSelectAdv={onRoll ? (id) => setSelectedAdvIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : undefined}
          modifierEligibility={modifierEligibility}
          beastformAdvantages={el.activeBeastform?.advantages
            ? el.activeBeastform.advantages.split(',').map(s => s.trim()).filter(Boolean)
            : undefined}
          selectedBeastformAdvantage={el.selectedBeastformAdvantage ?? null}
          onSelectBeastformAdvantage={updateFn ? handleBeastformAdvantageSelect : undefined}
          onUseMod={updateFn ? (mod) => {
            // clearStress mode chips (Rally Die, Rogue's Dodge, etc.)
            if (mod.mode === 'clearStress' && mod.dice) {
              const stress = Math.max(0, (el.currentStress ?? 0) - 1);
              updateFn(el.instanceId, { currentStress: stress });
              const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
              updateFn(el.instanceId, { activeModifiers: kept });
              return;
            }
          } : undefined}
          onUseMode={updateFn ? (mod, mode) => {
            // Prayer Die: gainHope → post ActionBanner for GM ack (not direct apply)
            if (mod.name === 'Prayer Die' && mode === 'gainHope') {
              onActionNotification?.({
                _action: true,
                rollUser: el.name,
                actionName: 'Prayer Die',
                actionText: `Use Prayer Die to gain ${mod.value} Hope`,
                _prayerDieGainHope: { modId: mod.id, value: mod.value, instanceId: el.instanceId },
                _attackerInstanceId: el.instanceId,
              });
              return; // Die is consumed on GM ack, not here
            }
            // Dispatch class feature onModifierUsed hook
            if (el.class) {
              const selfEl = wrapEntity(el, updateFn);
              runHook(classFeatures, [el.class], 'onModifierUsed', {
                modifier: mod,
                mode,
                selfEl,
                updateActiveElement: updateFn,
              });
            }
            // Consume the modifier chip after use
            const kept = (el.activeModifiers || []).filter(m => m.id !== mod.id);
            updateFn(el.instanceId, { activeModifiers: kept });
          } : undefined}
        />

        {/* ── Defense ── */}
        <CharacterDefenseRow el={el} />

        {/* ── Resource tracks ── */}
        {showResources && (
          <Section label="Resources">
            <div className="space-y-1.5">
              {(() => {
                const maxHope = el.maxHope ?? 6;
                const hopePending = pendingResourceCosts[el.instanceId]?.hope ?? 0;
                const currentHope = el.hope ?? maxHope;
                return maxHope > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={11} className="text-amber-400 shrink-0" />
                    <span className="text-[11px] text-slate-400 w-10 shrink-0">Hope</span>
                    <CheckboxTrack
                      total={maxHope}
                      filled={Math.max(0, currentHope - hopePending)}
                      pendingFilled={hopePending}
                      onSetFilled={(h) => updateFn(el.instanceId, { hope: h })}
                      fillColor="bg-amber-400"
                      label="Hope"
                      verbs={['Gain', 'Spend']}
                      pulseOnDecreaseOnly
                    />
                    <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.hope ?? maxHope}/{maxHope}</span>
                  </div>
                );
              })()}
              {(el.maxArmor || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className="text-cyan-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Armor</span>
                  <CheckboxTrack
                    total={el.maxArmor}
                    filled={el.currentArmor || 0}
                    pendingFilled={pendingResourceCosts[el.instanceId]?.armorMark ?? 0}
                    onSetFilled={(v) => {
                      const upd = { currentArmor: v };
                      if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                      updateFn(el.instanceId, upd);
                    }}
                    fillColor="bg-cyan-500"
                    label="Armor"
                    verbs={['Mark', 'Clear']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentArmor || 0}/{el.maxArmor}</span>
                </div>
              )}
              {(el.maxHp || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Heart size={11} className="text-red-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">HP</span>
                  <CheckboxTrack
                    total={el.maxHp}
                    filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                    onSetFilled={(dmg) => updateFn(el.instanceId, { currentHp: (el.maxHp || 0) - dmg })}
                    fillColor="bg-red-500"
                    label="HP"
                    verbs={['Mark', 'Clear']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentHp ?? el.maxHp}/{el.maxHp}</span>
                </div>
              )}
              {(el.maxStress || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={11} className="text-orange-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Stress</span>
                  <CheckboxTrack
                    total={el.maxStress}
                    filled={el.currentStress || 0}
                    pendingFilled={pendingResourceCosts[el.instanceId]?.stress ?? 0}
                    onSetFilled={(s) => updateFn(el.instanceId, { currentStress: s })}
                    fillColor="bg-orange-500"
                    label="Stress"
                    verbs={['Mark', 'Clear']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.currentStress || 0}/{el.maxStress}</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Weapons (or Beastform Attack when transformed) ── */}
        <CharacterWeaponList
          el={el}
          onWeaponClick={handleWeaponClick}
          devastatingActive={devastatingActive}
          onDevastatingToggle={() => setDevastatingActive(d => !d)}
          stressMaxed={stressMaxed}
          onActionNotification={onActionNotification}
          selectedExperienceHint={el.selectedExperienceIndex != null
            ? `+2 from \u201c${(el.experiences || [])[el.selectedExperienceIndex]?.name}\u201d included`
            : undefined}
          onBeastformAttack={handleBeastformAttack}
        />

        {/* ── Inventory ── */}
        <CharacterInventory el={el} />

        {/* ── Features ── */}
        <CharacterFeatureList
          el={el}
          expandedKeys={expandedKeys}
          onToggleFeature={onToggleFeature}
          onUseHopeAbility={onUseHopeAbility}
          onFeatureUse={handleFeatureUse}
          featureUsage={el.featureUsage}
          currentHope={currentHope}
          beastformProps={beastformProps}
          updateFn={updateFn}
          activeChanneledElement={el.activeChanneledElement ?? null}
          prayerDice={(el.activeModifiers || []).filter(m => m.name === 'Prayer Die')}
          onPrayerDieGainHope={onActionNotification ? (mod) => onActionNotification({
            _action: true,
            rollUser: el.name,
            actionName: 'Prayer Die',
            actionText: `Use Prayer Die to gain ${mod.value} Hope`,
            _prayerDieGainHope: { modId: mod.id, value: mod.value, instanceId: el.instanceId },
            _attackerInstanceId: el.instanceId,
          }) : undefined}
          onWingsPickUpCarry={onActionNotification ? (characterEl) => onActionNotification({
            _action: true,
            _featureName: 'Wings of Light',
            _wingsOfLightPickUpCarry: true,
            _attackerInstanceId: characterEl.instanceId,
            rollUser: characterEl.name,
            actionName: 'Wings of Light: Pick up and carry',
            tags: [{ name: 'Wings of Light', text: 'Mark 1 Stress' }],
          }) : undefined}
        />

        {/* ── Domain Cards ── */}
        <CharacterAbilityList el={el} />

        {/* ── Companion (hidden when shown as second card in overlay) ── */}
        {!hideCompanionSection && <CharacterCompanion el={el} />}

        {/* ── Description ── */}
        {el.description && (
          <Section label="Description">
            <p className="text-[11px] text-slate-400 leading-relaxed italic">{el.description}</p>
          </Section>
        )}

      </div>
    </div>

    {showDebug && (el._daggerstackDebug || el._daggerstackLookupTables) && (
      <div
        className="absolute top-0 flex gap-2 pl-2"
        style={{ left: '22rem' }}
        onMouseEnter={onDebugMouseEnter}
        onMouseLeave={onDebugMouseLeave}
      >
        {[
          ['Supabase Row', el._daggerstackDebug?.supabaseRow],
          ['Resolved Lookups', el._daggerstackDebug?.resolved],
          ['Lookup Tables', el._daggerstackLookupTables],
        ].filter(([, data]) => data).map(([label, data]) => (
          <div key={label} className="w-80 h-[80vh] bg-slate-900 border border-amber-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-amber-950/30 border-b border-amber-900/30 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">{label}</p>
            </div>
            <div className="flex-1 overflow-auto min-h-0 p-2 text-[9px] font-mono">
              <JsonTree data={data} defaultOpen={true} />
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ── Feature input overlay (e.g. Sorcerer Channel Raw Power card level) ── */}
    {featureInputPending && (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 rounded-xl">
        <div className="bg-slate-900 border border-amber-600/60 rounded-lg p-4 shadow-2xl w-56 text-center">
          <div className="text-[11px] font-bold text-amber-300 mb-1">{featureInputPending.feature.name}</div>
          {featureInputPending.subFeature && (
            <div className="text-[10px] text-slate-400 mb-2">{featureInputPending.subFeature.name}</div>
          )}
          <label className="text-[10px] text-slate-400 block mb-1">{featureInputPending.spec.label}</label>
          <input
            type="number"
            min={featureInputPending.spec.min ?? 1}
            max={featureInputPending.spec.max ?? 10}
            value={featureInputValue}
            onChange={e => setFeatureInputValue(e.target.value)}
            className="w-full text-center bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white mb-3 focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setFeatureInputPending(null)}
              className="flex-1 px-2 py-1 rounded text-[11px] border border-slate-600 text-slate-400 hover:bg-slate-800 transition-colors"
            >Cancel</button>
            <button
              onClick={() => handleFeatureUse(featureInputPending.feature, featureInputPending.subFeature)}
              className="flex-1 px-2 py-1 rounded text-[11px] font-semibold border border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 transition-colors"
            >Use</button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
