import { Square, CheckSquare, Trash2, Plus } from 'lucide-react';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { FrequencyCycleChipSuffix, getFrequencyCycleWord } from '../lib/frequency-cycle-ui.jsx';
import { Tooltip } from './Tooltip.jsx';
import { BANNER_CARD_SCROLL_STYLE } from '../lib/dice-banner-layout.js';
import { buildPreRollPanelTitle } from '../lib/trait-roll-text.js';
import { getDifficultyLabel } from '../lib/helpers.js';
import {
  ROLL_VISIBILITY_TABLE,
  ROLL_VISIBILITY_GM_AND_PLAYER,
  ROLL_VISIBILITY_GM_ONLY,
  characterHasAssignedPlayer,
  assignedPlayerDisplayName,
} from '../lib/roll-visibility.js';
import { rangeFtToLabel } from '../lib/map-range.js';
import {
  buildV2PreRollWeaponAttackRollSkeleton,
  buildV2PreRollTraitRollSkeleton,
} from '../lib/v2-action-loop-bridge.js';

/**
 * Shared pre-roll strip card (GM + initiator + assigned player).
 * Slider id is `#intent-difficulty` so Playwright's existing helper still works.
 */
export function PreRollBanner({
  characterEl,
  pending,
  chips = [],
  selectedChips = [],
  onToggleChip,
  experienceIndex = null,
  companionExperienceIndex = null,
  onSelectExperience,
  advantages = [],
  disadvantages = [],
  onChangeAdvantages,
  onChangeDisadvantages,
  targetInstanceId = null,
  onSelectTarget,
  visibility = ROLL_VISIBILITY_TABLE,
  onChangeVisibility,
  isPlayer = false,
  joinedPlayers = [],
  needsDifficulty = false,
  difficulty = 15,
  difficultyFinalized = false,
  onDifficultyChange,
  onFinalize,
  onProceed,
  onCancel,
  proceedDisabled = false,
  getTargetsForRoll,
  getV2ReviewChipDisableHint,
  activeElements = [],
  srdData = null,
  fearCount = 0,
  mapConfig = null,
  tableFeatureState = null,
}) {
  const cel = (activeElements.find((e) => e.instanceId === characterEl?.instanceId) || characterEl) ?? {};
  const meta = pending?.meta || {};
  const companion = cel?.companion;
  const isCompanionAttack = !!meta._companionExperienceForRoll && !!companion?.attackName;
  const weapon = Array.isArray(cel?.weapons) && meta._weaponId != null
    ? cel.weapons.find((w) => w.id === meta._weaponId)
    : null;
  const title = buildPreRollPanelTitle({
    actorName: isCompanionAttack ? companion.name : (cel?.name || ''),
    traitKey: meta._traitKey,
    displayName: pending?.displayName,
    actionName: meta._subFeatureName || meta._featureName || null,
    weaponName: weapon?.name || null,
    isSpellcast: !!meta._isSpellcastRoll && !meta._companionExperienceForRoll,
    isReaction: !!meta._isReaction,
    companionAttackName: isCompanionAttack ? companion.attackName : null,
  });

  const advantageTriggerIndices = chips.reduce((acc, c, i) => {
    if (c._advantageTriggerChip) acc.push(i);
    return acc;
  }, []);
  const showManualAdvDisadv = needsDifficulty;
  const showAdvantageSection = advantageTriggerIndices.length > 0 || showManualAdvDisadv;

  const syntheticRoll = {
    _attackerInstanceId: meta._attackerInstanceId ?? characterEl?.instanceId,
    _attackerType: meta._attackerType,
    _weaponRangeFt: meta._weaponRangeFt,
    _attackRangeFt: meta._attackRangeFt,
    _attackerInstanceIds: meta._attackerInstanceIds,
    _featureNeedsTarget: meta._featureNeedsTarget,
  };
  const rawPrerollTargets = typeof getTargetsForRoll === 'function' ? getTargetsForRoll(syntheticRoll) : [];
  const isPcAttack = syntheticRoll._attackerInstanceId != null && syntheticRoll._attackerType !== 'adversary';
  const prerollIntentTargets = isPcAttack
    ? rawPrerollTargets.filter((t) => t.type === 'adversary')
    : rawPrerollTargets.filter((t) => t.type === 'character');
  const prerollTargetRangeLabel =
    meta._weaponRangeFt != null
      ? rangeFtToLabel(meta._weaponRangeFt)
      : meta._attackerType === 'adversary' && meta._attackRangeFt != null
        ? rangeFtToLabel(meta._attackRangeFt)
        : null;
  const showPreRollTargetPicker = !!meta._selectedTargetInstanceId && prerollIntentTargets.length > 0;

  const syntheticRollForV2Intent =
    srdData &&
    (meta._weaponRangeFt != null || meta._weaponId != null
      ? buildV2PreRollWeaponAttackRollSkeleton({
          pendingMeta: meta,
          pendingRollText: pending?.rollText,
          characterEl: cel,
        })
      : buildV2PreRollTraitRollSkeleton({
          pendingMeta: meta,
          pendingRollText: pending?.rollText,
          characterEl: cel,
        }));

  const sliderDisabled = isPlayer || difficultyFinalized;
  const showFinalize = !isPlayer && needsDifficulty && !difficultyFinalized;

  const renderPrerollToggle = (i, emerald) => {
    const chip = chips[i];
    const selected = selectedChips[i];
    const used = chip._used;
    const v2Hint =
      chip._v2IntentChip && syntheticRollForV2Intent && getV2ReviewChipDisableHint
        ? getV2ReviewChipDisableHint(chip, syntheticRollForV2Intent, activeElements, srdData, {
            fearCount,
            mapConfig,
            tableFeatureState,
          })
        : null;
    const v2Disabled = !!v2Hint;
    const label = chip.label ?? chip.name ?? chip._featureName ?? '';
    const costParts = [];
    if (chip.stressCost) costParts.push(`${chip.stressCost} Stress`);
    if (chip.hopeCost) costParts.push(`${chip.hopeCost} Hope`);
    const costLabel = costParts.length ? ` (${costParts.join(', ')})` : '';
    const cycleWord = getFrequencyCycleWord(chip.resetsOn);
    const descForTooltip =
      typeof chip.description === 'string' && chip.description.trim() !== ''
        ? chip.description.trim()
        : null;
    const tooltipLabel = used
      ? (cycleWord ? `Already used (${cycleWord})` : 'Already used')
      : v2Hint || (descForTooltip ?? label) + costLabel;
    const selEmerald = emerald && selected && !used && !v2Disabled;
    const unselEmerald = emerald && !selected && !used && !v2Disabled;
    return (
      <Tooltip key={i} label={tooltipLabel} placement="bottom-left">
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={used || v2Disabled}
            onClick={used || v2Disabled ? undefined : () => onToggleChip?.(i)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
              used
                ? 'border-dh-strong bg-dh-raised/30 text-dh-muted cursor-not-allowed opacity-70'
                : selEmerald
                  ? 'border-emerald-600 bg-emerald-900/50 text-emerald-100'
                  : unselEmerald
                    ? 'border-emerald-700/60 bg-emerald-950/35 text-emerald-200/90 hover:border-emerald-500 hover:bg-emerald-900/30'
                    : selected
                      ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                      : 'border-dh-strong bg-dh-raised/40 text-dh-muted hover:border-dh-strong hover:text-dh'
            }`}
          >
            <Square size={12} className={`shrink-0 ${selected && !used ? 'hidden' : ''}`} />
            <CheckSquare size={12} className={`shrink-0 ${selected && !used ? '' : 'hidden'}`} />
            <span className="truncate max-w-[180px]">{label}</span>
            {!used && <FeatureResourceCostIcons action={chip} iconSize={9} className="ml-0.5" />}
            {chip.resetsOn && (
              <FrequencyCycleChipSuffix frequency={chip.resetsOn} iconSize={9} className="ml-0.5" />
            )}
          </button>
        </span>
      </Tooltip>
    );
  };

  return (
    <div
      className="dice-result-banner select-none flex-shrink-0"
      data-testid="preroll-banner"
      role="region"
      aria-labelledby="preroll-title"
      style={{
        pointerEvents: 'auto',
        maxWidth: '95vw',
        minWidth: '560px',
      }}
    >
      <div
        className="px-4 py-3 rounded-xl shadow-2xl bg-dh-surface/90 border-2 border-dh-strong text-dh"
        style={BANNER_CARD_SCROLL_STYLE}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide text-dh-muted mb-0.5">Before you roll</div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div id="preroll-title" className="text-sm font-bold text-dh">{title}</div>
          {isPlayer ? (
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-dh cursor-pointer">
              <input
                type="checkbox"
                data-testid="preroll-private-checkbox"
                checked={visibility === ROLL_VISIBILITY_GM_AND_PLAYER}
                onChange={(e) => {
                  onChangeVisibility?.(e.target.checked ? ROLL_VISIBILITY_GM_AND_PLAYER : ROLL_VISIBILITY_TABLE);
                }}
              />
              Private to me and GM
            </label>
          ) : (
            <select
              data-testid="preroll-visibility"
              aria-label="Roll visibility"
              value={
                visibility === ROLL_VISIBILITY_GM_AND_PLAYER && !characterHasAssignedPlayer(characterEl)
                  ? ROLL_VISIBILITY_TABLE
                  : visibility
              }
              onChange={(e) => onChangeVisibility?.(e.target.value)}
              className="max-w-[16rem] rounded px-1.5 py-1 text-[11px] bg-dh-raised border border-dh-strong text-dh"
            >
              <option value={ROLL_VISIBILITY_TABLE}>Visible to table</option>
              <option value={ROLL_VISIBILITY_GM_ONLY}>Private to me</option>
              {characterHasAssignedPlayer(characterEl) && (
                <option value={ROLL_VISIBILITY_GM_AND_PLAYER}>
                  Private to me and {assignedPlayerDisplayName(characterEl, joinedPlayers)}
                </option>
              )}
            </select>
          )}
        </div>
        <p className="text-xs text-dh mb-2">Choose experience and optional toggles, then Proceed.</p>

        <div className="mb-3 w-full flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-dh" htmlFor="intent-difficulty">
            Difficulty
          </label>
          <div className="flex items-center gap-2">
            <input
              id="intent-difficulty"
              type="range"
              min={5}
              max={30}
              step={1}
              value={difficulty}
              disabled={sliderDisabled}
              onChange={(e) => onDifficultyChange?.(Number(e.target.value))}
              className={`flex-1 h-2 rounded-full appearance-none bg-gradient-to-r from-slate-600 to-slate-900 accent-sky-500 ${sliderDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label="Difficulty (DC 5–30)"
            />
            <span className="text-sm font-bold tabular-nums text-dh shrink-0 w-8" aria-live="polite">
              {difficulty}
            </span>
          </div>
          <span className="text-[10px] text-dh-muted">{getDifficultyLabel(difficulty)}</span>
          {needsDifficulty && difficultyFinalized && (
            <span className="self-start text-[10px] font-semibold text-emerald-400">Locked: DC {difficulty}</span>
          )}
          {showFinalize && (
            <button
              type="button"
              onClick={onFinalize}
              className="self-start px-2.5 py-1 rounded text-[11px] font-semibold border border-sky-600 bg-sky-900/50 text-sky-100 hover:bg-sky-800/60"
            >
              Finalize
            </button>
          )}
        </div>

        {meta._deferExperienceToPreRoll && (() => {
          const isComp = meta._companionExperienceForRoll;
          const exps = isComp ? (cel.companion?.experiences || []) : (cel.experiences || []);
          const hope = cel.hope ?? (cel.maxHope ?? 6);
          if (exps.length === 0) return null;
          return (
            <div className="mb-3 w-full">
              <div className="text-[11px] font-semibold text-dh mb-1.5">
                Experience <span className="text-dh-hope-soft font-normal">(1 Hope)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {exps.map((exp, i) => {
                  const selected = isComp ? companionExperienceIndex === i : experienceIndex === i;
                  const noHope = hope === 0;
                  const disabled = noHope && !selected;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      data-testid={`preroll-experience-${i}`}
                      onClick={() => onSelectExperience?.(isComp ? 'companion' : 'pc', selected ? null : i)}
                      className={`text-[11px] rounded px-2 py-0.5 border transition-colors font-medium
                        ${disabled
                          ? 'opacity-35 cursor-not-allowed bg-dh-raised border-dh-strong text-dh-muted'
                          : selected
                            ? 'bg-sky-900/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/50 cursor-pointer'
                            : 'bg-dh-raised border-dh-strong text-dh hover:bg-dh-hover/60 hover:border-dh-strong cursor-pointer'}`}
                    >
                      {exp.name}
                      {exp.score != null && (
                        <span className={`font-bold ml-1 ${disabled ? 'text-dh-muted' : 'text-sky-400'}`}>+{exp.score}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {hope === 0 && (
                <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot select an experience</p>
              )}
            </div>
          );
        })()}

        {showPreRollTargetPicker && (
          <div className="mb-3 w-full flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-dh">
              Target{prerollTargetRangeLabel ? ` (within ${prerollTargetRangeLabel})` : ''}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {prerollIntentTargets.map((t) => {
                const selected = targetInstanceId === t.instanceId;
                return (
                  <button
                    key={t.instanceId}
                    type="button"
                    onClick={() => onSelectTarget?.(t.instanceId)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                      selected
                        ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                        : 'border-dh-strong bg-dh-raised/40 text-dh hover:border-dh-strong hover:text-dh'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-dh-muted">
              Same valid targets as the in-sheet picker (range, map position, etc.).
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 items-center mb-3">
          {chips.map((chip, i) => {
            if (chip._difficultyChip || chip._advantageTriggerChip) return null;
            return renderPrerollToggle(i, false);
          })}
        </div>

        {showAdvantageSection && (
          <div className="mb-3 w-full flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-dh">Advantage</span>
            {advantageTriggerIndices.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {advantageTriggerIndices.map((ti) => renderPrerollToggle(ti, true))}
              </div>
            )}
            {showManualAdvDisadv && (
              <>
                {advantages.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const next = [...advantages];
                        next[idx] = e.target.value;
                        onChangeAdvantages?.(next);
                      }}
                      placeholder="Advantage"
                      className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-dh-raised border border-dh-strong text-dh placeholder-dh-muted focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      aria-label="Advantage name"
                    />
                    <button
                      type="button"
                      onClick={() => onChangeAdvantages?.(advantages.filter((_, i) => i !== idx))}
                      className="shrink-0 p-1 rounded text-dh-muted hover:bg-dh-hover hover:text-dh"
                      aria-label="Remove advantage"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChangeAdvantages?.([...advantages, ''])}
                  className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
                >
                  <Plus size={12} /> Add advantage [d6]
                </button>
              </>
            )}
          </div>
        )}

        {showManualAdvDisadv && (
          <div className="mb-3 w-full flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-dh">Disadvantage</span>
            {disadvantages.map((name, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const next = [...disadvantages];
                    next[idx] = e.target.value;
                    onChangeDisadvantages?.(next);
                  }}
                  placeholder="Disadvantage"
                  className="flex-1 min-w-0 rounded px-2 py-1 text-[11px] bg-dh-raised border border-dh-strong text-dh placeholder-dh-muted focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  aria-label="Disadvantage name"
                />
                <button
                  type="button"
                  onClick={() => onChangeDisadvantages?.(disadvantages.filter((_, i) => i !== idx))}
                  className="shrink-0 p-1 rounded text-dh-muted hover:bg-dh-hover hover:text-dh"
                  aria-label="Remove disadvantage"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChangeDisadvantages?.([...disadvantages, ''])}
              className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
            >
              <Plus size={12} /> Add disadvantage [d6]
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onProceed}
            disabled={proceedDisabled}
            title={proceedDisabled ? 'Waiting for the GM to set the difficulty' : undefined}
            className="px-3 py-1.5 rounded text-[11px] font-semibold border border-dh-strong bg-dh-hover text-dh hover:bg-dh-strong disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-dh-hover"
          >
            Proceed
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-0.5 rounded text-[10px] font-medium border border-dh-strong bg-dh-surface/60 text-dh-muted hover:bg-dh-raised hover:text-dh"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
