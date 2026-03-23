import {
  ChevronDown,
  ChevronRight,
  Dices,
  Zap,
  Flame,
  Mountain,
  Droplets,
  Wind,
  Square,
  CheckSquare,
  Share2,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MarkdownText } from '../../lib/markdown.js';
import { Tooltip } from '../Tooltip.jsx';
import { CustomSelect } from '../forms/CustomSelect.jsx';
import {
  buildFeatureCardModelForCharacter,
  buildGuideFeatureTableSnapshot,
  formatFrequency,
  getSheetOwnerKey,
  V2_TABLE_STUB_NO_INSTANCE_ID,
} from '../../lib/build-feature-card-model.js';
import { FeatureResourceCostIcons } from '../FeatureResourceCostIcons.jsx';
import { v2OriginFeatureDescriptorsByName } from '../../lib/v2-origin-feature-descriptors.js';
import {
  readPersistedToggleIsOn,
  resolveChipDisabled,
  getChipDisableHint,
} from '../../../features-v2/engine/chip-system.js';
import { ACTION_LOOP_PHASE_UI, FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI } from '../../lib/action-loop-phase-ui-icons.js';
import { resolveV2FeatureSourcePath } from '../../../features-v2/resolve-feature-source-path.js';
import { FeatureSourceModal } from './FeatureSourceModal.jsx';
import { getPendingV2DeferToggleNext } from '../../lib/helpers.js';

const ELEMENT_ICONS = { fire: Flame, earth: Mountain, water: Droplets, air: Wind, Fire: Flame, Earth: Mountain, Water: Droplets, Air: Wind };

/** Resource costs for the card title bar (lifted single-chip header or legacy parse). */
function buildTitleCostAction(model, legacy) {
  const lifted = model.liftedHeader;
  if (model.cardChips.length === 1 && lifted) {
    const h = lifted.hopeCost || 0;
    const s = lifted.stressCost || 0;
    const am = lifted.armorMark || 0;
    const ac = lifted.armorClear || 0;
    if (h || s || am || ac) {
      return { hopeCost: h, stressCost: s, armorMark: am, armorClear: ac };
    }
  }
  if (legacy.isActive) {
    const h = legacy.hopeCost || 0;
    const s = legacy.stressCost || 0;
    const am = legacy.armorMark || 0;
    const ac = legacy.armorClear || 0;
    if (h || s || am || ac) {
      return { hopeCost: h, stressCost: s, armorMark: am, armorClear: ac };
    }
  }
  return null;
}

function chipFrequencySuffix(chip) {
  if (!chip.frequency) return '';
  const t = formatFrequency(chip.frequency) || chip.frequency;
  return ` · ${t}`;
}

function getSelectOptions(chip, featRow, el, v2TableContext) {
  if (typeof chip.isSelect !== 'function') return [];
  try {
    if (getSheetOwnerKey(el) != null) {
      const table = buildGuideFeatureTableSnapshot(el, featRow, v2TableContext);
      return chip.isSelect(table) || [];
    }
    return chip.isSelect(V2_TABLE_STUB_NO_INSTANCE_ID) || [];
  } catch {
    return [];
  }
}

/**
 * Renders only the V2 card chip row (buttons / selects / toggles) for a feature — used by
 * `GuideFeatureCard` and the sheet-level Actions strip.
 */
export function GuideFeatureCardChips({
  model,
  tableForChips,
  featRow,
  el,
  featureKey,
  v2TableContext,
  interactionMode,
  onV2CardChip,
  /** When set, narrative-only chips (`narrativeBannerOnly`) call this — same payload as "Share Feature Text". */
  onShareFeature,
  activeChanneledElement,
  stressMaxed,
  /** Dense sheet Actions strip: no per-feature chrome; CustomSelect uses feature name + ellipsis, full width */
  actionsStripLayout = false,
  /** When true, only render chips with `isToggle` (e.g. compact Game Table character panel). */
  onlyIsToggle = false,
  /** Pending action banners — tentative on/off for deferred toggles (`gameTableDeferUntilBannerAck`) until GM ack. */
  pendingBanners,
}) {
  const [isSelectNonce, setIsSelectNonce] = useState({});
  const bumpIsSelect = (ci) => {
    setIsSelectNonce((prev) => ({ ...prev, [ci]: (prev[ci] || 0) + 1 }));
  };

  const preview = interactionMode === 'preview';
  const canInteract = !preview && typeof onV2CardChip === 'function';
  const effectiveKey = featureKey || model.name;
  const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);
  if (!model.cardChips?.length) return null;
  if (onlyIsToggle && !(model.cardChips || []).some((c) => c?.isToggle)) return null;

  return (
    <>
      {model.cardChips.map((chip, ci) => {
        if (onlyIsToggle && !chip.isToggle) return null;
        const baseName = chip.name || model.displayName;
        const resolvedName = typeof baseName === 'function' ? baseName(tableForChips) : baseName;
        const chipForEngine = { ...chip, name: resolvedName };
        const logicDisabled = resolveChipDisabled(chipForEngine, tableForChips);
        const resourceUnaffordable = !!chipForEngine.resourceUnaffordable;
        const chipDisabled = logicDisabled || resourceUnaffordable;
        const engineDisableHint = chip.disableHint ?? getChipDisableHint(chipForEngine, tableForChips);
        const chipUsed = !!(chip.frequency && isUsed);
        const usedHint = chipUsed ? `Already used (${formatFrequency(chip.frequency) || chip.frequency}).` : null;
        const cardDisableReason =
          preview ? 'Preview mode' : !canInteract ? null : usedHint || (chipDisabled ? engineDisableHint : null);
        const label = chipForEngine.name;
        const tipText = chip.description || label;
        const tipContent = (
          <MarkdownText text={String(tipText || '')} className="text-[11px] leading-relaxed dh-md" />
        );
        const isToggle = !!chip.isToggle;
        const selectOpts = getSelectOptions(chip, featRow, el, v2TableContext);
        const isSelect = typeof chip.isSelect === 'function' && selectOpts.length > 0;

        if (isSelect && selectOpts.length >= 2 && chip.selectPresentation === 'iconGrid') {
          return (
            <div
              key={ci}
              className={
                actionsStripLayout
                  ? 'inline-flex flex-wrap gap-1.5 items-center align-middle max-w-full'
                  : 'flex flex-wrap gap-1.5'
              }
            >
              {selectOpts.map((opt) => {
                const id = opt.id || opt.name;
                const Icon = ELEMENT_ICONS[id] || ELEMENT_ICONS[String(id).toLowerCase()] || Zap;
                const isActive = !!activeChanneledElement && String(id).toLowerCase() === String(activeChanneledElement).toLowerCase();
                const cantUse = isUsed || (stressMaxed && !isActive);
                let elementalTip = null;
                if (preview) elementalTip = 'Preview mode';
                else if (!canInteract) elementalTip = null;
                else if (chipDisabled) elementalTip = engineDisableHint;
                else if (cantUse) {
                  if (isUsed && chip.frequency) elementalTip = usedHint;
                  else if (stressMaxed && !activeChanneledElement) elementalTip = 'Stress is full; cannot channel a new element.';
                }
                const chipBtn = (
                  <button
                    type="button"
                    disabled={preview || cantUse || !canInteract || chipDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (preview || cantUse || !canInteract || chipDisabled) return;
                      onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey, selectOpts: { selectedId: id } });
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border transition-all shrink-0 ${
                      isActive
                        ? 'border-emerald-600/70 bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-700/40'
                        : cantUse || preview
                          ? 'border-slate-600/50 bg-slate-800/30 text-slate-500 opacity-60 cursor-not-allowed'
                          : 'border-amber-700/50 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40 hover:border-amber-600/70 cursor-pointer'
                    }`}
                    aria-label={opt.name || id}
                  >
                    <Icon size={12} className="shrink-0" />
                    <span>{opt.name || id}</span>
                  </button>
                );
                return (
                  <Tooltip
                    key={String(id)}
                    label={elementalTip || undefined}
                    content={!elementalTip ? <MarkdownText text={opt.description || ''} className="text-[11px] leading-relaxed dh-md" /> : undefined}
                    placement="bottom"
                  >
                    {chipBtn}
                  </Tooltip>
                );
              })}
              {stressMaxed && !activeChanneledElement && (
                <span className="text-[9px] text-orange-500/70 italic whitespace-nowrap shrink-0">
                  Stress full — cannot channel
                </span>
              )}
            </div>
          );
        }

        if (isSelect && selectOpts.length > 0 && chip.selectPresentation !== 'iconGrid') {
          const n = isSelectNonce[ci] ?? 0;
          const selectCls = actionsStripLayout ? 'text-xs w-full' : 'text-xs';
          const closedName = actionsStripLayout ? model.displayName : label;
          return (
            <div key={`${ci}-${n}`} className={actionsStripLayout ? 'w-full min-w-0 basis-full' : undefined}>
              <CustomSelect
                key={`isselect-${ci}-${n}`}
                value={null}
                placeholder={actionsStripLayout ? model.displayName : 'Choose…'}
                truncateClosedLabel={!!actionsStripLayout}
                renderPlaceholder={() => (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className={`min-w-0 text-inherit ${actionsStripLayout ? 'truncate' : ''}`}>{closedName}</span>
                    <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
                    {chip.frequency ? (
                      <span className="text-slate-400 text-[9px] shrink-0">{chipFrequencySuffix(chip)}</span>
                    ) : null}
                  </span>
                )}
                options={selectOpts}
                getOptionKey={(o) => o.id ?? o.name}
                getOptionLabel={(o) => o.name ?? o.label ?? String(o.id ?? '')}
                getOptionDescription={(o) => o.description}
                tooltipWide={model.name === 'Beastform' || model.name === 'Evolution'}
                disabled={preview || !canInteract || chipDisabled || chipUsed}
                disabledReason={
                  preview
                    ? 'Preview mode'
                    : !canInteract
                      ? undefined
                      : usedHint || (chipDisabled ? engineDisableHint : undefined)
                }
                className={selectCls}
                onChange={(opt) => {
                  if (opt == null || !canInteract || chipDisabled || chipUsed) return;
                  const id = opt.id ?? opt.name;
                  if (id == null || id === '') return;
                  onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey, selectOpts: { selectedId: id } });
                  bumpIsSelect(ci);
                }}
              />
            </div>
          );
        }

        const needsSelectTargets = typeof chip.selectTargets === 'function';
        let selectTargetOpts = [];
        if (needsSelectTargets) {
          try {
            selectTargetOpts = chip.selectTargets(tableForChips) || [];
          } catch {
            selectTargetOpts = [];
          }
        }

        if (needsSelectTargets && selectTargetOpts.length > 0) {
          const n = isSelectNonce[ci] ?? 0;
          const selectCls = actionsStripLayout ? 'text-xs w-full' : 'text-xs';
          const closedName = actionsStripLayout ? model.displayName : label;
          return (
            <div key={`${ci}-st-${n}`} className={actionsStripLayout ? 'w-full min-w-0 basis-full' : undefined}>
              <CustomSelect
                key={`selectTargets-${ci}-${n}`}
                value={null}
                placeholder={actionsStripLayout ? model.displayName : 'Choose target…'}
                truncateClosedLabel={!!actionsStripLayout}
                renderPlaceholder={() => (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className={`min-w-0 text-inherit ${actionsStripLayout ? 'truncate' : ''}`}>{closedName}</span>
                    <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
                  </span>
                )}
                options={selectTargetOpts}
                getOptionKey={(o) => o.instanceId ?? o.id ?? o.name}
                getOptionLabel={(o) => o.name ?? String(o.instanceId ?? '')}
                getOptionDescription={() => ''}
                disabled={preview || !canInteract || chipDisabled || chipUsed}
                disabledReason={
                  preview
                    ? 'Preview mode'
                    : !canInteract
                      ? undefined
                      : usedHint || (chipDisabled ? engineDisableHint : undefined)
                }
                className={selectCls}
                onChange={(opt) => {
                  if (opt == null || !canInteract || chipDisabled || chipUsed) return;
                  const tid = opt.instanceId ?? opt.id;
                  if (tid == null || tid === '') return;
                  onV2CardChip({
                    featRow,
                    chip: chipForEngine,
                    featureKey: effectiveKey,
                    selectOpts: { selectedTargetIds: [tid] },
                  });
                  bumpIsSelect(ci);
                }}
              />
            </div>
          );
        }

        if (isToggle) {
          const deferTogglePending = getPendingV2DeferToggleNext(
            pendingBanners,
            el?.instanceId,
            model.name,
            resolvedName
          );
          const toggleDeferAwait = deferTogglePending !== undefined;
          let active = false;
          if (toggleDeferAwait) {
            active = deferTogglePending;
          } else {
            try {
              active = readPersistedToggleIsOn(chipForEngine, tableForChips, featRow);
            } catch {
              active = false;
            }
          }
          return (
            <Tooltip
              key={ci}
              label={cardDisableReason || undefined}
              content={
                !cardDisableReason ? (
                  toggleDeferAwait ? (
                    <div>
                      <MarkdownText
                        text={`${String(tipText || '')}\n\n*Awaiting GM confirmation.*`}
                        className="text-[11px] leading-relaxed dh-md"
                      />
                    </div>
                  ) : (
                    tipContent
                  )
                ) : undefined
              }
              placement="top"
            >
              <button
                type="button"
                disabled={preview || !canInteract || chipDisabled || toggleDeferAwait}
                onClick={(e) => {
                  e.stopPropagation();
                  if (preview || !canInteract || chipDisabled || toggleDeferAwait) return;
                  onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey });
                }}
                className={`inline-flex items-center gap-1 max-w-full rounded px-1.5 py-0.5 text-[10px] border transition-colors ${
                  preview || !canInteract || chipDisabled || toggleDeferAwait
                    ? 'border-slate-600/50 bg-slate-800/30 text-slate-500 opacity-70 cursor-not-allowed'
                    : active
                      ? 'border-amber-500 bg-amber-800/60 text-amber-100 hover:bg-amber-700/70'
                      : 'border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800 hover:text-amber-100'
                } ${toggleDeferAwait ? 'ring-1 ring-amber-300/70 ring-offset-1 ring-offset-slate-900/90 animate-pulse' : ''}`}
                aria-pressed={active}
                aria-busy={toggleDeferAwait || undefined}
              >
                {active ? <CheckSquare size={10} className="shrink-0" /> : <Square size={10} className="shrink-0" />}
                <span className="truncate">{label}</span>
                <FeatureResourceCostIcons action={chipForEngine} iconSize={9} />
              </button>
            </Tooltip>
          );
        }

        const narrativeOnly = !!chip.narrativeBannerOnly;
        const canShareNarrative = narrativeOnly && typeof onShareFeature === 'function';
        const narrativeActivatable = canInteract || canShareNarrative;
        const narrativeDisableReason =
          preview ? 'Preview mode' : !narrativeActivatable ? null : usedHint || (chipDisabled ? engineDisableHint : null);
        const defaultChipInactive =
          preview || chipUsed || (narrativeOnly ? !narrativeActivatable : !canInteract) || chipDisabled;
        return (
          <Tooltip
            key={ci}
            label={narrativeOnly ? narrativeDisableReason || undefined : cardDisableReason || undefined}
            content={narrativeOnly ? (!narrativeDisableReason ? tipContent : undefined) : !cardDisableReason ? tipContent : undefined}
            placement="top"
          >
            <button
              type="button"
              disabled={defaultChipInactive}
              onClick={(e) => {
                e.stopPropagation();
                if (preview || chipUsed || chipDisabled) return;
                if (narrativeOnly) {
                  if (!narrativeActivatable) return;
                  if (canShareNarrative) {
                    onShareFeature(featRow);
                    return;
                  }
                  onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey });
                  return;
                }
                if (!canInteract) return;
                onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey });
              }}
              className={`inline-flex items-center gap-1 max-w-full rounded px-1.5 py-0.5 border transition-colors ${
                narrativeOnly ? 'text-[9px] font-normal' : 'text-[10px]'
              } ${
                defaultChipInactive
                  ? 'border-slate-600 bg-slate-800/50 text-slate-500 cursor-not-allowed'
                  : narrativeOnly
                    ? 'border-slate-600/60 bg-slate-900/40 text-slate-400 hover:bg-slate-800/50 hover:border-slate-500/70 hover:text-slate-300'
                    : 'border-amber-700/50 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50 hover:border-amber-600/60'
              }`}
            >
              <span className="truncate">{label}</span>
              <FeatureResourceCostIcons action={chip} iconSize={9} />
              {chip.frequency ? (
                <span className="truncate text-slate-400">{chipFrequencySuffix(chip)}</span>
              ) : null}
            </button>
          </Tooltip>
        );
      })}
    </>
  );
}

/**
 * Guide-driven feature card — shared by Game Table hover and Library preview.
 *
 * @param {'interactive' | 'preview'} props.interactionMode
 * @param {object} props.featRow — merged activeFeatures row
 * @param {string} props.featureKey — stable key for usage / expand
 * @param {object} props.el — character element
 * @param {boolean} props.open
 * @param {function} props.onToggle
 * @param {function} [props.onFeatureUse] — legacy Phase-1 use
 * @param {function} [props.onV2CardChip] — ({ featRow, chip, featureKey, selectOpts? }) => void
 * @param {string|null} [props.activeChanneledElement] — Elemental Incarnation channel id
 * @param {boolean} [props.stressMaxed]
 * @param {object} [props.prayerDiceProps] — Prayer Dice pool UI
 * @param {object} [props.rangerFocusToggle] — legacy bridge when V2 card handler absent
 * @param {object} [props.faerieWingsProps]
 * @param {function} [props.onShareFeature]
 * @param {string} [props.tone] — 'default' | 'domain'
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object, activeElements?: object[] }} [props.v2TableContext] — for `isSelect` chips (Druid Beastform, etc.)
 */
export function GuideFeatureCard({
  featRow,
  featureKey,
  el,
  open,
  onToggle,
  interactionMode,
  onFeatureUse,
  onV2CardChip,
  activeChanneledElement,
  stressMaxed,
  prayerDiceProps,
  rangerFocusToggle,
  faerieWingsProps,
  onShareFeature,
  tone = 'default',
  v2TableContext,
  pendingBanners,
}) {
  const [sourceViewer, setSourceViewer] = useState(null);
  const preview = interactionMode === 'preview';
  const canInteract = !preview && typeof onV2CardChip === 'function';
  const canLegacy = !preview && typeof onFeatureUse === 'function';

  const { model, table: tableForChips } = useMemo(
    () => buildFeatureCardModelForCharacter(featRow, el, v2TableContext),
    [featRow, el, v2TableContext],
  );

  const featureSourcePath = useMemo(() => resolveV2FeatureSourcePath(featRow), [featRow]);

  const effectiveKey = featureKey || model.name;
  const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);

  const legacy = model.legacyAction;
  const hasDice = model.hasDice;

  const shellClass =
    tone === 'domain'
      ? 'overflow-hidden border-0 bg-transparent'
      : 'rounded-lg overflow-hidden bg-slate-800/40 border-t border-slate-500/35';

  const sourceBadge = model.sourceLabel && (
    <span
      className={`ml-auto text-[9px] rounded px-1 shrink-0 ${
        model.sourceType === 'class'
          ? 'bg-violet-900/60 text-violet-300'
          : model.sourceType === 'subclass'
            ? 'bg-sky-900/60 text-sky-300'
            : model.sourceType === 'ancestry'
              ? 'bg-amber-900/60 text-amber-300'
              : model.sourceType === 'community'
                ? 'bg-emerald-900/60 text-emerald-300'
                : model.sourceType === 'beastform'
                  ? 'bg-teal-900/60 text-teal-300'
                  : model.sourceType === 'domain'
                    ? 'bg-violet-900/60 text-violet-300'
                    : 'bg-emerald-900/60 text-emerald-300'
      }`}
    >
      {model.sourceLabel}
    </span>
  );

  const lifted = model.liftedHeader;
  const freqLabel =
    (lifted?.frequency && formatFrequency(lifted.frequency)) ||
    (!lifted?.frequency && legacy.frequency ? formatFrequency(legacy.frequency) : null);
  const titleCostAction = buildTitleCostAction(model, legacy);

  const actionLoopPhases = model.actionLoopPhases;
  const showPhaseIcons =
    actionLoopPhases &&
    (actionLoopPhases.intent || actionLoopPhases.reviewAction || actionLoopPhases.reviewOutcome);

  const showHiddenPhaseChipsIcon = !!model.hasHiddenConditionalPhaseChips;

  const showWidgetRow =
    model.cardChips.length > 0 ||
    model.showLegacyUseStrip ||
    model.declarativePassive.length > 0 ||
    model.legacyPassive.length > 0 ||
    !!rangerFocusToggle ||
    !!faerieWingsProps ||
    ((prayerDiceProps?.dice?.length ?? 0) > 0);

  return (
    <div className={shellClass}>
      <div className="px-2 py-1 flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          className={`flex-1 min-w-0 flex items-center gap-1 text-left transition-colors rounded -m-1 p-1 ${
            tone === 'domain' ? 'hover:bg-violet-950/50' : 'hover:bg-slate-700/40'
          }`}
        >
          {open ? <ChevronDown size={9} className="text-slate-500 shrink-0" /> : <ChevronRight size={9} className="text-slate-500 shrink-0" />}
          <span className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{model.displayName}</span>
          {(showPhaseIcons || showHiddenPhaseChipsIcon) && (
            <span className="inline-flex items-center gap-0.5 shrink-0 ml-0.5 text-slate-200">
              {showHiddenPhaseChipsIcon && (
                <Tooltip label={FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.tooltip} placement="bottom">
                  <span className="inline-flex" aria-label={FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.tooltip}>
                    <FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.Icon size={10} className="shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              )}
              {actionLoopPhases.intent && (
                <Tooltip label={ACTION_LOOP_PHASE_UI.intent.tooltip} placement="bottom">
                  <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.intent.tooltip}>
                    <ACTION_LOOP_PHASE_UI.intent.Icon size={10} className="shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              )}
              {actionLoopPhases.reviewAction && (
                <Tooltip label={ACTION_LOOP_PHASE_UI.reviewAction.tooltip} placement="bottom">
                  <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.reviewAction.tooltip}>
                    <ACTION_LOOP_PHASE_UI.reviewAction.Icon size={10} className="shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              )}
              {actionLoopPhases.reviewOutcome && (
                <Tooltip label={ACTION_LOOP_PHASE_UI.reviewOutcome.tooltip} placement="bottom">
                  <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.reviewOutcome.tooltip}>
                    <ACTION_LOOP_PHASE_UI.reviewOutcome.Icon size={10} className="shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              )}
            </span>
          )}
          {titleCostAction && <FeatureResourceCostIcons action={titleCostAction} iconSize={10} className="ml-0.5" />}
          {freqLabel && (
            <span className="ml-1 text-[9px] rounded px-1 border shrink-0 bg-slate-700/60 border-slate-600 text-slate-400">{freqLabel}</span>
          )}
          {activeChanneledElement && (
            <span className="ml-1 text-[9px] rounded px-1 border shrink-0 bg-emerald-950/60 border-emerald-600/60 text-emerald-300 font-semibold">
              {activeChanneledElement === 'fire'
                ? '🔥'
                : activeChanneledElement === 'earth'
                  ? '🪨'
                  : activeChanneledElement === 'water'
                    ? '💧'
                    : '💨'}{' '}
              {activeChanneledElement.charAt(0).toUpperCase() + activeChanneledElement.slice(1)}
            </span>
          )}
          {legacy.isActive && !open && !activeChanneledElement && model.cardChips.length === 0 && (
            <span
              className={`ml-1 text-[9px] rounded px-1 border shrink-0 ${
                legacy.frequency
                  ? isUsed
                    ? 'bg-slate-800 border-slate-600 text-slate-500'
                    : 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
                  : isUsed
                    ? 'bg-slate-800 border-slate-700 text-slate-500'
                    : hasDice
                      ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                      : legacy.hopeCost > 0
                        ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                        : 'bg-amber-950/30 border-amber-700/30 text-amber-500/70'
              }`}
            >
              {legacy.frequency
                ? isUsed
                  ? `Used until ${legacy.frequency === 'session' ? 'next session' : legacy.frequency === 'longRest' ? 'long rest' : 'any rest'}`
                  : 'Unused'
                : isUsed
                  ? `✓ used/${legacy.frequency === 'session' ? 'session' : legacy.frequency === 'longRest' ? 'long rest' : 'rest'}`
                  : hasDice
                    ? '⚄ active'
                    : 'active'}
            </span>
          )}
          {sourceBadge}
        </button>
      </div>

      {showWidgetRow && (
        <div className="px-2 pb-2 pt-1.5 space-y-1.5">
          {model.cardChips.length > 0 && (
            <GuideFeatureCardChips
              model={model}
              tableForChips={tableForChips}
              featRow={featRow}
              el={el}
              featureKey={featureKey}
              v2TableContext={v2TableContext}
              interactionMode={interactionMode}
              onV2CardChip={onV2CardChip}
              onShareFeature={onShareFeature}
              activeChanneledElement={activeChanneledElement}
              stressMaxed={stressMaxed}
              pendingBanners={pendingBanners}
            />
          )}

          {model.showLegacyUseStrip && (
            <div className="pt-1.5 space-y-1">
              {canLegacy && (!v2OriginFeatureDescriptorsByName[model.name] || !!v2OriginFeatureDescriptorsByName[model.name]?.onUse) ? (
                isUsed ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Used this {legacy.frequency === 'session' ? 'session' : legacy.frequency === 'longRest' ? 'long rest' : 'rest'}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFeatureUse(featRow, null, e);
                    }}
                    disabled={!canLegacy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border bg-amber-900/40 border-amber-700/60 text-amber-200 hover:bg-amber-800/60 hover:border-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {hasDice ? <Dices size={10} /> : <Zap size={10} />}
                    Use
                  </button>
                )
              ) : null}
            </div>
          )}

          {rangerFocusToggle && (
            <button
              type="button"
              disabled={preview}
              onClick={(e) => {
                e.stopPropagation();
                if (!preview) rangerFocusToggle.onChange(!rangerFocusToggle.value);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                rangerFocusToggle.value
                  ? 'bg-amber-950/50 border-amber-600/70 text-amber-200 hover:bg-amber-900/50'
                  : 'border-slate-600/60 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
              title={
                rangerFocusToggle.value
                  ? "Next weapon attack will spend 1 Hope and attempt Ranger's Focus"
                  : "Enable to use Ranger's Focus on next attack"
              }
            >
              Use on next attack
            </button>
          )}

          {faerieWingsProps && (
            <div className="pt-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={preview}
                  checked={!!faerieWingsProps.flying}
                  onChange={(e) => faerieWingsProps.onFlyingChange(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span className="text-[10px] font-medium text-slate-300">Flying</span>
              </label>
            </div>
          )}

          {model.declarativePassive.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {model.declarativePassive.map((text, i) => (
                <span key={i} className="text-[9px] rounded px-1.5 py-0.5 bg-slate-800/80 border border-slate-700 text-slate-400">
                  {text}
                </span>
              ))}
            </div>
          )}

          {model.legacyPassive.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {model.legacyPassive.map((ps, i) => (
                <span key={i} className="text-[9px] rounded px-1.5 py-0.5 bg-slate-800/80 border border-slate-700 text-slate-400">
                  {ps.label}
                </span>
              ))}
            </div>
          )}

          {prayerDiceProps?.dice?.length > 0 && (
            <div className="pt-1.5 space-y-1">
              <p className="text-[10px] text-teal-400/70">Active Prayer Dice</p>
              <div className="flex flex-wrap gap-1">
                {prayerDiceProps.dice.map((mod) => (
                  <div key={mod.id} className="flex items-center rounded border border-teal-700/60 bg-teal-950/40 text-teal-200 text-[10px] overflow-hidden">
                    <span className="px-1.5 py-0.5 font-semibold">{mod.value}</span>
                    {prayerDiceProps.onGainHope && (
                      <button
                        type="button"
                        disabled={preview}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!preview) prayerDiceProps.onGainHope(mod);
                        }}
                        className="px-1.5 py-0.5 border-l border-teal-700/40 text-[9px] font-semibold hover:bg-teal-900/40 transition-colors disabled:opacity-40"
                        title={`Post banner to gain ${mod.value} Hope (requires GM acknowledge)`}
                      >
                        +Hope
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-500">Use +Roll / −Dmg in roll/damage banners</p>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="px-2 pb-2 pt-1.5 text-[11px] text-slate-300 leading-relaxed">
          {((onShareFeature && !preview) || (featureSourcePath && !preview)) && (
            <div className="float-right ml-2 mb-1 flex items-center gap-0.5">
              {featureSourcePath && !preview && (
                <Tooltip content="View implementation source" placement="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourceViewer({ path: featureSourcePath });
                    }}
                    className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                    aria-label="View implementation source"
                  >
                    <Search size={12} />
                  </button>
                </Tooltip>
              )}
              {onShareFeature && !preview && (
                <Tooltip content="Share Feature Text" placement="top">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareFeature(featRow);
                    }}
                    className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                    aria-label="Share Feature Text"
                  >
                    <Share2 size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          {model.description ? <MarkdownText text={model.description} className="dh-md" /> : null}
          {featRow.charge && (
            <span className="block clear-both mt-0.5 text-[10px] text-slate-500 italic">
              {featRow.charge.max} charge{featRow.charge.max !== 1 ? 's' : ''} · recharges on {featRow.charge.recharge?.on || 'rest'}
            </span>
          )}
        </div>
      )}
      <FeatureSourceModal
        open={!!sourceViewer}
        relativePath={sourceViewer?.path}
        onClose={() => setSourceViewer(null)}
      />
    </div>
  );
}
