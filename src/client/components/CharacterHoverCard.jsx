import { useState } from 'react';
import {
  AlertCircle, Sparkles, Heart, Shield,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, Bug, Pencil,
} from 'lucide-react';
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
} from './CharacterDisplay.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { parseFeatureAction, parseSubFeatures } from '../lib/feature-actions.js';
import { weaponFeatures } from '../../features/registry.js';
import { runPipelineHook } from '../../features/hooks.js';

// formatGold is re-exported from CharacterDisplay; re-export it for callers that
// already import it from here (keeps backwards-compatibility during migration).
export { formatGold };

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
}) {
  const [showDebug, setShowDebug] = useState(false);
  const [devastatingActive, setDevastatingActive] = useState(false);
  const [selectedRollModIndex, setSelectedRollModIndex] = useState(null);
  const [selectedModId, setSelectedModId] = useState(null);

  const traits = el.traits || {};
  const hasDaggerstack = !!el.daggerstackUrl;
  const rollModifiers = el.armorMods?.rollModifiers || [];
  const activeRollMod = selectedRollModIndex != null ? rollModifiers[selectedRollModIndex] : null;
  const activeModifiers = el.activeModifiers || [];
  const selectedMod = selectedModId != null ? activeModifiers.find(m => m.id === selectedModId) : null;

  // ── Feature roll text builder ────────────────────────────────────────────────
  // Builds the roll text string for a feature that has dice or a spellcast roll.
  const buildFeatureRollText = (feature, subFeature, action) => {
    const charName = el.name;
    const featName = subFeature ? subFeature.name : feature.name;
    const parts = [];

    if (action.spellcastDC != null) {
      // Spellcast roll: Hope [d12] Fear [d12] + spellcast trait
      const traitKey = (el.spellcastTrait || 'presence').toLowerCase();
      const baseScore = traits[traitKey] ?? 0;
      const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, 'spellcast');
      const modBonus = selectedMod?.mode === 'roll' && selectedMod.dice ? 0 : (selectedMod?.bonus ?? 0);
      parts.push(`${charName} ${featName} Hope [d12] Fear [d12]`);
      if (baseScore + rollModBonus + modBonus !== 0) {
        parts.push(`${TRAIT_FULL[traitKey] || traitKey} [${baseScore + rollModBonus + modBonus}]`);
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
  const handleFeatureUse = onRoll || onActionNotification ? (feature, subFeature = null) => {
    const activeDesc = subFeature ? (subFeature.description || '') : (feature.description || '');
    const action = subFeature ? parseFeatureAction(subFeature.description || '') : parseFeatureAction(feature.description || '');
    const featName = subFeature ? subFeature.name : feature.name;

    // Feature-level key for usage tracking (uses parent feature name)
    const featureKeyIdx = [
      ...(el.classFeatures || []),
      ...(el.subclassFeatures || []),
      ...(el.ancestryFeatures || []),
      ...(el.communityFeatures || []),
    ].findIndex(f => f.name === feature.name);
    const featureKey = `${feature.name}-${featureKeyIdx >= 0 ? featureKeyIdx : 0}`;

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

    // Dread Visage: adds an advantage chip to the activator's modifier bin
    const isDreadVisage = feature.name === 'Dread Visage';
    if (isDreadVisage) {
      _addModifiers.push({
        id: `dread-visage-${el.instanceId}-${Date.now()}`,
        name: 'Dread Visage',
        mode: 'advantage',
        refreshOn: 'session',
      });
    }

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
      ...(_addModifiers.length > 0 ? { _addModifiers, _distributeModifiersToAll } : {}),
    };

    const hasDice = action.dice.length > 0 || action.spellcastDC != null;

    if (hasDice) {
      // Dice roll path
      const rollText = buildFeatureRollText(feature, subFeature, action);
      if (!rollText) return;
      const displayName = subFeature ? `${el.name} ${feature.name}: ${subFeature.name}` : `${el.name} ${feature.name}`;
      onRoll?.(rollText, displayName, rollMeta);
      // Consume selected experience (if any) and selected modifier
      if (el.selectedExperienceIndex != null) {
        if (onSpendHope) onSpendHope(el.instanceId);
        else updateFn?.(el.instanceId, { selectedExperienceIndex: null });
      }
      if (selectedMod) setSelectedModId(null);
    } else {
      // Action notification path (costs but no dice, or comms-only)
      const truncDesc = activeDesc.length > 150 ? activeDesc.slice(0, 150) + '…' : activeDesc;
      onActionNotification?.({
        _action: true,
        rollUser: el.name,
        actionName: featName,
        actionText: truncDesc,
        tags: [
          ...(action.hopeCost > 0  ? [{ name: 'HopeCost',  text: `Spend ${action.hopeCost} Hope` }]  : []),
          ...(action.stressCost > 0 ? [{ name: 'StressCost', text: `Mark ${action.stressCost} Stress` }] : []),
          ...(action.armorClear > 0 ? [{ name: 'ArmorClear', text: `Clear ${action.armorClear} Armor slot` }] : []),
          ...(action.armorMark > 0  ? [{ name: 'ArmorMark',  text: `Mark ${action.armorMark} Armor slot` }]  : []),
        ],
        ...rollMeta,
      });
    }
  } : undefined;

  // ── Trait click handler ──────────────────────────────────────────────────────
  const handleTraitClick = onRoll ? (traitKey) => {
    const activeExp = el.selectedExperienceIndex != null
      ? (el.experiences || [])[el.selectedExperienceIndex]
      : null;
    const baseScore = traits[traitKey] ?? 0;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    let rollText = buildTraitRollText(el.name, traitKey, baseScore + rollModBonus, activeExp?.name);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const displayName = `${el.name} ${TRAIT_FULL[traitKey]}`;
    const traitRollMeta = { _attackerInstanceId: el.instanceId };
    if (selectedMod?.consumeOnUse) traitRollMeta._usedModifierId = selectedMod.id;
    // #region agent log
    console.log('[3e4b6d] handleTraitClick rollMeta:', JSON.stringify(traitRollMeta), 'selectedMod:', selectedMod ? { id: selectedMod.id, consumeOnUse: selectedMod.consumeOnUse } : null);
    // #endregion
    onRoll(rollText, displayName, traitRollMeta);
    if (activeExp) {
      if (onSpendHope) onSpendHope(el.instanceId);
      else updateFn(el.instanceId, { selectedExperienceIndex: null });
    }
    if (selectedMod) setSelectedModId(null);
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
    let rollText = buildTraitRollText(el.name + ' Spellcast', traitKey, baseScore + rollModBonus, activeExp?.name);
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const displayName = `${el.name} Spellcast`;
    const spellcastRollMeta = { _attackerInstanceId: el.instanceId };
    if (selectedMod?.consumeOnUse) spellcastRollMeta._usedModifierId = selectedMod.id;
    onRoll(rollText, displayName, spellcastRollMeta);
    if (activeExp) {
      if (onSpendHope) onSpendHope(el.instanceId);
      else updateFn(el.instanceId, { selectedExperienceIndex: null });
    }
    if (selectedMod) setSelectedModId(null);
  } : undefined;

  // ── Weapon click handler ─────────────────────────────────────────────────────
  const handleWeaponClick = onRoll ? (weapon, rollMeta = {}) => {
    const traitKey = (weapon.trait || '').toLowerCase();
    const traitScore = traits[traitKey] ?? 0;
    const activeExp = el.selectedExperienceIndex != null
      ? (el.experiences || [])[el.selectedExperienceIndex]
      : null;
    const opts = {};
    if (rollMeta.devastating) opts.devastating = true;
    if (rollMeta.secondaryDamage) opts.secondaryDamage = rollMeta.secondaryDamage;
    const rollModBonus = getRollModBonus(rollModifiers, activeRollMod, traitKey);
    let rollText = buildWeaponRollText(
      el.name, weapon.name, traitKey, traitScore + rollModBonus,
      activeExp?.name, weapon.damage, weapon.feature, traits, el.level, opts,
    );
    if (selectedMod?.mode === 'roll' && selectedMod.dice) {
      rollText += ` ${selectedMod.name} [${selectedMod.dice}]`;
    }
    const displayName = `${el.name} ${weapon.name}`;
    rollMeta._attackerInstanceId = el.instanceId;
    if (selectedMod?.consumeOnUse) rollMeta._usedModifierId = selectedMod.id;
    onRoll(rollText, displayName, rollMeta);
    if (activeExp) {
      if (onSpendHope) onSpendHope(el.instanceId);
      else updateFn(el.instanceId, { selectedExperienceIndex: null });
    }
    if (selectedMod) setSelectedModId(null);
    if (opts.devastating) {
      const maxStress = el.maxStress ?? 6;
      const newStress = Math.min((el.currentStress ?? 0) + 1, maxStress);
      updateFn(el.instanceId, { currentStress: newStress });
      setDevastatingActive(false);
    }
  } : undefined;

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
        />

        {/* ── Defense ── */}
        <CharacterDefenseRow el={el} />

        {/* ── Resource tracks ── */}
        {showResources && (
          <Section label="Resources">
            <div className="space-y-1.5">
              {(() => { const maxHope = el.maxHope ?? 6; return maxHope > 0 && (
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-amber-400 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Hope</span>
                  <CheckboxTrack
                    total={maxHope}
                    filled={el.hope ?? maxHope}
                    onSetFilled={(h) => updateFn(el.instanceId, { hope: h })}
                    fillColor="bg-amber-400"
                    label="Hope"
                    verbs={['Gain', 'Spend']}
                  />
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{el.hope ?? maxHope}/{maxHope}</span>
                </div>
              ); })()}
              {(el.maxArmor || 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className="text-cyan-500 shrink-0" />
                  <span className="text-[11px] text-slate-400 w-10 shrink-0">Armor</span>
                  <CheckboxTrack
                    total={el.maxArmor}
                    filled={el.currentArmor || 0}
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

        {/* ── Weapons ── */}
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
        />

        {/* ── Inventory ── */}
        <CharacterInventory el={el} />

        {/* ── Features ── */}
        <CharacterFeatureList
          el={el}
          expandedKeys={el.expandedFeatures}
          onToggleFeature={updateFn ? (key) => {
            const current = el.expandedFeatures || [];
            const isOpen = current.includes(key);
            const next = isOpen ? current.filter(k => k !== key) : [...current, key];
            updateFn(el.instanceId, { expandedFeatures: next });
          } : undefined}
          onUseHopeAbility={onUseHopeAbility}
          onFeatureUse={handleFeatureUse}
          featureUsage={el.featureUsage}
          currentHope={currentHope}
        />

        {/* ── Domain Cards ── */}
        <CharacterAbilityList el={el} />

        {/* ── Companion ── */}
        <CharacterCompanion el={el} />

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

    </div>
  );
}
