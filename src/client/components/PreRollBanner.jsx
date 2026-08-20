import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Square, CheckSquare, Trash2, Plus } from 'lucide-react';
import { FeatureResourceCostIcons } from './FeatureResourceCostIcons.jsx';
import { FrequencyCycleChipSuffix, getFrequencyCycleWord } from '../lib/frequency-cycle-ui.jsx';
import { Tooltip } from './Tooltip.jsx';
import { BANNER_CARD_SCROLL_STYLE } from '../lib/dice-banner-layout.js';
import { buildPreRollPanelTitle } from '../lib/trait-roll-text.js';
import { DifficultySlider } from './DifficultySlider.jsx';
import {
  ROLL_VISIBILITY_TABLE,
  ROLL_VISIBILITY_GM_AND_PLAYER,
  ROLL_VISIBILITY_GM_ONLY,
  characterHasAssignedPlayer,
  assignedPlayerDisplayName,
} from '../lib/roll-visibility.js';
import { rangeFtToLabel } from '../lib/map-range.js';
import {
  PRE_ROLL_POOL_TEXT_DEBOUNCE_MS,
  nextPoolNameDraft,
  preRollObserverVisibleModel,
} from '../lib/pre-roll-intent.js';
import {
  buildV2PreRollWeaponAttackRollSkeleton,
  buildV2PreRollTraitRollSkeleton,
} from '../lib/v2-action-loop-bridge.js';

/**
 * Advantage / disadvantage name field. Draft stays local while typing so a stale
 * SSE snapshot cannot revert the input (ConditionsEditor / countdown-name pattern).
 */
function DebouncedPoolNameInput({
  value,
  onCommit,
  onDraft,
  placeholder,
  className,
  'aria-label': ariaLabel,
  inputRef,
}) {
  const [draft, setDraft] = useState(() => (typeof value === 'string' ? value : ''));
  const dirtyRef = useRef(false);
  const draftRef = useRef(draft);
  const onCommitRef = useRef(onCommit);
  const onDraftRef = useRef(onDraft);
  draftRef.current = draft;
  onCommitRef.current = onCommit;
  onDraftRef.current = onDraft;

  useEffect(() => {
    if (dirtyRef.current && value === draftRef.current) {
      dirtyRef.current = false;
    }
    const next = nextPoolNameDraft(value, draftRef.current, { dirty: dirtyRef.current });
    setDraft(next);
  }, [value]);

  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    const t = window.setTimeout(() => {
      onCommitRef.current?.(draftRef.current);
    }, PRE_ROLL_POOL_TEXT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => {
        dirtyRef.current = true;
        const next = e.target.value;
        draftRef.current = next;
        setDraft(next);
        onDraftRef.current?.(next);
      }}
      onBlur={() => onCommitRef.current?.(draftRef.current)}
      placeholder={placeholder}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

/**
 * Shared pre-roll strip card (GM + invited players).
 * Other players get `readOnly` (on chips only; empty sections omitted).
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
  readOnly = false,
  joinedPlayers = [],
  needsDifficulty = false,
  difficulty = 15,
  difficultyFinalized = false,
  onDifficultyChange,
  onFinalize,
  onUnlock,
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
  const pendingPoolFocusRef = useRef(null);
  const lastAdvantageInputRef = useRef(null);
  const lastDisadvantageInputRef = useRef(null);
  const advantageDraftByIdxRef = useRef({});
  const disadvantageDraftByIdxRef = useRef({});

  const mergedPoolNames = (committed, drafts) =>
    (Array.isArray(committed) ? committed : []).map((name, i) => (
      Object.prototype.hasOwnProperty.call(drafts, i) ? drafts[i] : name
    ));

  const commitAdvantageAt = (idx, name) => {
    advantageDraftByIdxRef.current[idx] = name;
    onChangeAdvantages?.(mergedPoolNames(advantages, advantageDraftByIdxRef.current));
  };
  const commitDisadvantageAt = (idx, name) => {
    disadvantageDraftByIdxRef.current[idx] = name;
    onChangeDisadvantages?.(mergedPoolNames(disadvantages, disadvantageDraftByIdxRef.current));
  };
  const flushPoolDrafts = () => {
    onChangeAdvantages?.(mergedPoolNames(advantages, advantageDraftByIdxRef.current));
    onChangeDisadvantages?.(mergedPoolNames(disadvantages, disadvantageDraftByIdxRef.current));
  };
  useLayoutEffect(() => {
    const kind = pendingPoolFocusRef.current;
    if (!kind) return;
    pendingPoolFocusRef.current = null;
    const el = kind === 'adv' ? lastAdvantageInputRef.current : lastDisadvantageInputRef.current;
    el?.focus();
  }, [advantages.length, disadvantages.length]);

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
  const readonlyTarget = targetInstanceId
    ? (prerollIntentTargets.find((t) => t.instanceId === targetInstanceId)
      || (() => {
        const el = activeElements.find((e) => e.instanceId === targetInstanceId);
        return el ? { instanceId: el.instanceId, name: el.name || 'Target' } : null;
      })())
    : null;

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

  const canEditDifficulty = !isPlayer && !readOnly;
  const observerModel = readOnly
    ? preRollObserverVisibleModel({
        chips,
        selectedChips,
        experienceIndex,
        companionExperienceIndex,
        advantages,
        disadvantages,
        targetInstanceId,
        deferExperience: !!meta._deferExperienceToPreRoll,
      })
    : null;

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
    const chipClass = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border ${
      used
        ? 'border-dh-strong bg-dh-raised/30 text-dh-muted cursor-not-allowed opacity-70'
        : selEmerald
          ? 'border-emerald-600 bg-emerald-900/50 text-emerald-100'
          : unselEmerald
            ? 'border-emerald-700/60 bg-emerald-950/35 text-emerald-200/90 hover:border-emerald-500 hover:bg-emerald-900/30'
            : selected
              ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
              : 'border-dh-strong bg-dh-raised/40 text-dh-muted hover:border-dh-strong hover:text-dh'
    }`;
    const chipInner = (
      <>
        <Square size={12} className={`shrink-0 ${selected && !used ? 'hidden' : ''}`} />
        <CheckSquare size={12} className={`shrink-0 ${selected && !used ? '' : 'hidden'}`} />
        <span className="truncate max-w-[180px]">{label}</span>
        {!used && <FeatureResourceCostIcons action={chip} iconSize={9} className="ml-0.5" />}
        {chip.resetsOn && (
          <FrequencyCycleChipSuffix frequency={chip.resetsOn} iconSize={9} className="ml-0.5" />
        )}
      </>
    );
    return (
      <Tooltip key={i} label={tooltipLabel} placement="bottom-left">
        <span className="inline-flex items-center gap-1">
          {readOnly ? (
            <span data-testid={`preroll-chip-${i}`} className={`${chipClass} cursor-default`}>
              {chipInner}
            </span>
          ) : (
            <button
              type="button"
              disabled={used || v2Disabled}
              onClick={used || v2Disabled ? undefined : () => onToggleChip?.(i)}
              className={`${chipClass} transition-colors`}
            >
              {chipInner}
            </button>
          )}
        </span>
      </Tooltip>
    );
  };

  return (
    <div
      className="dice-result-banner select-none flex-shrink-0"
      data-testid="preroll-banner"
      data-readonly={readOnly ? 'true' : undefined}
      role="region"
      aria-labelledby="preroll-title"
      style={{
        pointerEvents: 'auto',
        width: 'min(24.5rem, 66vw)',
        maxWidth: '66vw',
      }}
    >
      <div
        className="px-4 py-3 rounded-xl shadow-2xl bg-dh-surface/90 border-2 border-dh-strong text-dh min-w-0 w-full"
        style={BANNER_CARD_SCROLL_STYLE}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide text-dh-muted mb-0.5">Before you roll</div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div id="preroll-title" className="text-sm font-bold text-dh">{title}</div>
          {!readOnly && (isPlayer ? (
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
          ))}
        </div>
        {!readOnly && (
          <p className="text-xs text-dh mb-2">Choose experience and optional toggles, then Proceed.</p>
        )}

        <DifficultySlider
          id="intent-difficulty"
          value={difficulty}
          onChange={onDifficultyChange}
          disabled={!canEditDifficulty}
          testIdPrefix="preroll-difficulty"
          className="mb-3 w-full flex flex-col gap-1"
          trailing={needsDifficulty && !readOnly ? (
            <div className="ml-auto shrink-0 self-start grid justify-items-stretch">
              {isPlayer ? (
                <>
                  <span
                    className="invisible col-start-1 row-start-1 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                    aria-hidden="true"
                  >
                    Approved
                  </span>
                  <span
                    data-testid="preroll-difficulty-lock"
                    role="status"
                    className={`col-start-1 row-start-1 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-center select-none ${
                      difficultyFinalized ? 'text-emerald-400' : 'text-sky-400'
                    }`}
                  >
                    {difficultyFinalized ? 'Approved' : 'GM...'}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="invisible col-start-1 row-start-1 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                    aria-hidden="true"
                  >
                    Approve
                  </span>
                  <button
                    type="button"
                    data-testid="preroll-difficulty-lock"
                    onClick={() => (difficultyFinalized ? onUnlock?.() : onFinalize?.())}
                    className={`col-start-1 row-start-1 px-2.5 py-1 rounded text-[11px] font-semibold border ${
                      difficultyFinalized
                        ? 'border-emerald-600 bg-emerald-900/40 text-emerald-100 hover:bg-emerald-800/50'
                        : 'border-sky-600 bg-sky-900/50 text-sky-100 hover:bg-sky-800/60'
                    }`}
                  >
                    {difficultyFinalized ? 'Retract' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          ) : null}
        />

        {meta._deferExperienceToPreRoll && (() => {
          const isComp = meta._companionExperienceForRoll;
          const exps = isComp ? (cel.companion?.experiences || []) : (cel.experiences || []);
          const hope = cel.hope ?? (cel.maxHope ?? 6);
          if (exps.length === 0) return null;
          if (readOnly && !observerModel.showExperience) return null;
          const selectedIdx = isComp ? companionExperienceIndex : experienceIndex;
          const visibleExps = readOnly
            ? exps.map((exp, i) => ({ exp, i })).filter(({ i }) => i === selectedIdx)
            : exps.map((exp, i) => ({ exp, i }));
          if (readOnly && visibleExps.length === 0) return null;
          return (
            <div className="mb-3 w-full">
              <div className="text-[11px] font-semibold text-dh mb-1.5">
                Experience <span className="text-dh-hope-soft font-normal">(1 Hope)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {visibleExps.map(({ exp, i }) => {
                  const selected = isComp ? companionExperienceIndex === i : experienceIndex === i;
                  const noHope = hope === 0;
                  const disabled = noHope && !selected;
                  const chipClass = `text-[11px] rounded px-2 py-0.5 border font-medium
                        ${disabled
                          ? 'opacity-35 cursor-not-allowed bg-dh-raised border-dh-strong text-dh-muted'
                          : selected
                            ? 'bg-sky-900/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/50'
                            : 'bg-dh-raised border-dh-strong text-dh'}`;
                  const inner = (
                    <>
                      {exp.name}
                      {exp.score != null && (
                        <span className={`font-bold ml-1 ${disabled ? 'text-dh-muted' : 'text-sky-400'}`}>+{exp.score}</span>
                      )}
                    </>
                  );
                  if (readOnly) {
                    return (
                      <span key={i} data-testid={`preroll-experience-${i}`} className={`${chipClass} cursor-default`}>
                        {inner}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      data-testid={`preroll-experience-${i}`}
                      onClick={() => onSelectExperience?.(isComp ? 'companion' : 'pc', selected ? null : i)}
                      className={`${chipClass} transition-colors ${
                        disabled ? '' : 'hover:bg-dh-hover/60 hover:border-dh-strong cursor-pointer'
                      } ${selected && !disabled ? 'cursor-pointer' : ''}`}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
              {!readOnly && hope === 0 && (
                <p className="text-[9px] text-red-500/70 mt-0.5">No Hope — cannot select an experience</p>
              )}
            </div>
          );
        })()}

        {(readOnly ? observerModel.showTarget && !!readonlyTarget : showPreRollTargetPicker) && (
          <div className="mb-3 w-full flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-dh">
              Target{prerollTargetRangeLabel ? ` (within ${prerollTargetRangeLabel})` : ''}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(readOnly
                ? (readonlyTarget ? [readonlyTarget] : [])
                : prerollIntentTargets
              ).map((t) => {
                const selected = targetInstanceId === t.instanceId;
                const chipClass = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border ${
                  selected
                    ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                    : 'border-dh-strong bg-dh-raised/40 text-dh'
                }`;
                if (readOnly) {
                  return (
                    <span key={t.instanceId} className={`${chipClass} cursor-default`}>
                      {t.name}
                    </span>
                  );
                }
                return (
                  <button
                    key={t.instanceId}
                    type="button"
                    onClick={() => onSelectTarget?.(t.instanceId)}
                    className={`${chipClass} transition-colors hover:border-dh-strong hover:text-dh`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            {!readOnly && (
              <p className="text-[9px] text-dh-muted">
                Same valid targets as the in-sheet picker (range, map position, etc.).
              </p>
            )}
          </div>
        )}

        {(readOnly
          ? observerModel.showFeatureChips
          : chips.some((chip) => !chip._difficultyChip && !chip._advantageTriggerChip)
        ) && (
          <div className="flex flex-wrap gap-1.5 items-center mb-3">
            {(readOnly ? observerModel.featureChipIndices : chips.map((_, i) => i)).map((i) => {
              const chip = chips[i];
              if (!chip || chip._difficultyChip || chip._advantageTriggerChip) return null;
              return renderPrerollToggle(i, false);
            })}
          </div>
        )}

        {(readOnly ? observerModel.showAdvantageSection : showAdvantageSection) && (
          <div className="mb-3 w-full flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-dh">Advantage / Disadvantage</span>
            <div className="flex flex-wrap gap-1.5 items-center w-full min-w-0">
              {(readOnly ? observerModel.advantageTriggerIndices : advantageTriggerIndices).map((ti) => renderPrerollToggle(ti, true))}
              {readOnly && observerModel.namedAdvantages.map((name, idx) => (
                <span
                  key={`adv-ro-${idx}`}
                  className="inline-flex shrink-0 items-center px-2 py-1 rounded border border-emerald-700/60 bg-emerald-950/35 text-[11px] text-emerald-100"
                >
                  {name}
                </span>
              ))}
              {readOnly && observerModel.namedDisadvantages.map((name, idx) => (
                <span
                  key={`dis-ro-${idx}`}
                  className="inline-flex shrink-0 items-center px-2 py-1 rounded border border-rose-700/60 bg-rose-950/35 text-[11px] text-rose-100"
                >
                  {name}
                </span>
              ))}
              {!readOnly && showManualAdvDisadv && (
                <>
                  {advantages.map((name, idx) => (
                    <div
                      key={`adv-${idx}`}
                      className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded border border-emerald-700/60 bg-emerald-950/35"
                    >
                      <DebouncedPoolNameInput
                        inputRef={idx === advantages.length - 1 ? lastAdvantageInputRef : undefined}
                        value={name}
                        onDraft={(nextName) => {
                          advantageDraftByIdxRef.current[idx] = nextName;
                        }}
                        onCommit={(nextName) => commitAdvantageAt(idx, nextName)}
                        placeholder="Advantage"
                        className="w-[7rem] bg-transparent text-[11px] text-emerald-100 placeholder-emerald-200/50 outline-none"
                        aria-label="Advantage name"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const next = mergedPoolNames(advantages, advantageDraftByIdxRef.current)
                            .filter((_, i) => i !== idx);
                          advantageDraftByIdxRef.current = Object.fromEntries(
                            next.map((n, i) => [i, n]),
                          );
                          onChangeAdvantages?.(next);
                        }}
                        className="shrink-0 p-0.5 rounded text-emerald-200/70 hover:bg-emerald-900/50 hover:text-emerald-100"
                        aria-label="Remove advantage"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      pendingPoolFocusRef.current = 'adv';
                      onChangeAdvantages?.([...mergedPoolNames(advantages, advantageDraftByIdxRef.current), '']);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
                  >
                    <Plus size={12} /> Add advantage [d6]
                  </button>
                  {disadvantages.map((name, idx) => (
                    <div
                      key={`dis-${idx}`}
                      className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded border border-rose-700/60 bg-rose-950/35"
                    >
                      <DebouncedPoolNameInput
                        inputRef={idx === disadvantages.length - 1 ? lastDisadvantageInputRef : undefined}
                        value={name}
                        onDraft={(nextName) => {
                          disadvantageDraftByIdxRef.current[idx] = nextName;
                        }}
                        onCommit={(nextName) => commitDisadvantageAt(idx, nextName)}
                        placeholder="Disadvantage"
                        className="w-[7rem] bg-transparent text-[11px] text-rose-100 placeholder-rose-200/50 outline-none"
                        aria-label="Disadvantage name"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const next = mergedPoolNames(disadvantages, disadvantageDraftByIdxRef.current)
                            .filter((_, i) => i !== idx);
                          disadvantageDraftByIdxRef.current = Object.fromEntries(
                            next.map((n, i) => [i, n]),
                          );
                          onChangeDisadvantages?.(next);
                        }}
                        className="shrink-0 p-0.5 rounded text-rose-200/70 hover:bg-rose-900/50 hover:text-rose-100"
                        aria-label="Remove disadvantage"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      pendingPoolFocusRef.current = 'dis';
                      onChangeDisadvantages?.([...mergedPoolNames(disadvantages, disadvantageDraftByIdxRef.current), '']);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded text-[11px] text-dh-muted hover:text-sky-400 hover:bg-dh-raised/80 border border-dh-strong hover:border-dh-strong"
                  >
                    <Plus size={12} /> Add disadvantage [d6]
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                flushPoolDrafts();
                onProceed?.();
              }}
              disabled={proceedDisabled}
              title={proceedDisabled ? 'Waiting for the GM to approve the difficulty' : undefined}
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
        )}
      </div>
    </div>
  );
}
