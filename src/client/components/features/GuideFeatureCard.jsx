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
import { cloneElement, useMemo, useRef, useState } from 'react';
import { MarkdownText } from '../../lib/markdown.js';
import { Tooltip } from '../Tooltip.jsx';
import { CustomSelect } from '../forms/CustomSelect.jsx';
import {
  buildFeatureCardModelForCharacter,
  buildGuideFeatureTableSnapshot,
  getSheetOwnerKey,
  V2_TABLE_STUB_NO_INSTANCE_ID,
} from '../../lib/build-feature-card-model.js';
import { FrequencyCycleChipSuffix, getFrequencyCycleWord } from '../../lib/frequency-cycle-ui.jsx';
import { FeatureResourceCostIcons } from '../FeatureResourceCostIcons.jsx';
import { v2OriginFeatureDescriptorsByName } from '../../lib/v2-origin-feature-descriptors.js';
import {
  readPersistedToggleIsOn,
  resolveChipDisabled,
  getChipDisableHint,
} from '../../../features-v2/engine/chip-system.js';
import {
  ACTION_LOOP_PHASE_UI,
  FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI,
  FEATURE_CARD_PASSIVE_BONUS_UI,
} from '../../lib/action-loop-phase-ui-icons.js';
import { resolveV2FeatureSourcePath } from '../../../features-v2/resolve-feature-source-path.js';
import { FeatureSourceModal } from './FeatureSourceModal.jsx';
import { getPendingV2DeferToggleNext } from '../../lib/helpers.js';
import {
  V2_REVIEW_CHIP_INLINE_OPTION_MAX,
  V2_INLINE_GROUP_OUTER,
  V2_INLINE_GROUP_TITLE_ROW,
  V2_INLINE_SEG_BTN_BASE,
  V2_INLINE_SEG_TARGET_BTN,
  V2_INLINE_SEG_OFF,
} from '../../lib/v2-inline-select-ui.js';
import { V2SegmentedRowWrap } from '../V2SegmentedRowWrap.jsx';
import { WidthSortedFlexWrap } from '../WidthSortedFlexWrap.jsx';
import { useCharacterSheetSourceHighlightState } from '../CharacterSheetSourceHighlight.jsx';
import { shouldDimFeatOrAbilityRow, SHEET_SOURCE_DIM_CLASS } from '../../lib/source-badge-sheet-highlight.js';
import {
  buildGuideCardChipTipText,
  mergeOptionAndFeatureTooltipMarkdown,
} from '../../lib/guide-feature-card-tip-text.js';
import { usePortalHoverTooltip, PortalHoverTooltipLayer } from '../../lib/portal-hover-tooltip.jsx';
import { getSheetSourceChipPalette, resolveSheetSourcePaletteKey } from '../../lib/sheet-source-chip-styles.js';
import { shouldMoveV2ActionChipToUnusableSubsection } from '../../lib/v2-action-chip-strip.js';

const ELEMENT_ICONS = { fire: Flame, earth: Mountain, water: Droplets, air: Wind, Fire: Flame, Earth: Mountain, Water: Droplets, Air: Wind };

/** Banner + markdown body for chip tooltips when `interactionMode === 'preview'` (Library / read-only). */
function PreviewModeTooltipBody({ children }) {
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/95 mb-1.5 border-b border-amber-700/50 pb-1">
        Preview mode
      </div>
      {children}
    </>
  );
}

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

/** Segmented `selectTargets` row — portaled option tooltips (same as inline isSelect). */
function GuideFeatureSegmentedSelectTargetsRow({
  actionsStripLayout,
  closedName,
  chipForEngine,
  chip,
  featRow,
  effectiveKey,
  chipPayloadExtras,
  selectTargetOpts,
  targetPickDisabled,
  onV2CardChip,
  bumpIsSelect,
  ci,
  n,
  tipText,
  preview,
  sourcePalette,
}) {
  const segmentBankAnchorRef = useRef(null);
  const portalHover = usePortalHoverTooltip();
  const targetsChipTipMd = tipText || closedName;
  const targetsChipTipContent = preview ? (
    <PreviewModeTooltipBody>
      <MarkdownText text={targetsChipTipMd} className="text-[11px] leading-relaxed dh-md" />
    </PreviewModeTooltipBody>
  ) : (
    <MarkdownText text={targetsChipTipMd} className="text-[11px] leading-relaxed dh-md" />
  );
  const targetFeatureDescForMerge =
    typeof chipForEngine?.description === 'string' && chipForEngine.description.trim()
      ? chipForEngine.description.trim()
      : typeof featRow?.description === 'string' && featRow.description.trim()
        ? featRow.description.trim()
        : '';

  return (
    <div
      className={actionsStripLayout ? 'w-full min-w-0 basis-full' : 'w-full min-w-0'}
    >
      <div className={sourcePalette.groupOuter} role="group" aria-label={`${closedName} targets`}>
        <Tooltip content={targetsChipTipContent} placement="bottom" className="relative block w-full min-w-0">
          <div className={V2_INLINE_GROUP_TITLE_ROW}>
            <span className="font-semibold text-[11px] text-dh min-w-0 shrink break-words">{closedName}</span>
            <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
            {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
          </div>
        </Tooltip>
        <div ref={segmentBankAnchorRef} className="w-full min-w-0">
          <V2SegmentedRowWrap key={`${closedName}-${ci}-stseg-${n}`}>
          {selectTargetOpts.map((o) => {
            const tid = o.instanceId ?? o.id;
            if (tid == null || tid === '') return null;
            const name = o.name ?? String(tid);
            const rowKey = String(tid);
            const tDesc = typeof o.description === 'string' ? o.description.trim() : '';
            return (
              <button
                key={rowKey}
                type="button"
                tabIndex={targetPickDisabled ? -1 : undefined}
                aria-disabled={targetPickDisabled}
                onMouseEnter={(e) => {
                  if (!tDesc) return;
                  const tgtTipMd = mergeOptionAndFeatureTooltipMarkdown(tDesc, targetFeatureDescForMerge);
                  if (!tgtTipMd) return;
                  if (preview) {
                    portalHover.showFromPointerEvent(e, {
                      anchorRef: segmentBankAnchorRef,
                      renderInner: (
                        <PreviewModeTooltipBody>
                          <MarkdownText text={tgtTipMd} className="text-[11px] leading-relaxed dh-md" />
                        </PreviewModeTooltipBody>
                      ),
                      contentKey: `${rowKey}-${tgtTipMd.slice(0, 48)}`,
                    });
                  } else {
                    portalHover.showFromPointerEvent(e, {
                      anchorRef: segmentBankAnchorRef,
                      label: name,
                      description: tgtTipMd,
                      wide: false,
                    });
                  }
                }}
                onMouseLeave={portalHover.scheduleClose}
                onKeyDown={(e) => {
                  if (targetPickDisabled && (e.key === ' ' || e.key === 'Enter')) e.preventDefault();
                }}
                onClick={() => {
                  if (targetPickDisabled) return;
                  onV2CardChip({
                    featRow,
                    chip: chipForEngine,
                    featureKey: effectiveKey,
                    selectOpts: { selectedTargetIds: [tid] },
                    ...chipPayloadExtras,
                  });
                  bumpIsSelect(ci);
                }}
                className={`${V2_INLINE_SEG_TARGET_BTN} ${sourcePalette.segmentOff} ${
                  targetPickDisabled ? 'opacity-50 pointer-events-auto' : ''
                }`}
              >
                <span className="break-words">{name}</span>
              </button>
            );
          })}
          </V2SegmentedRowWrap>
        </div>
      </div>
      <PortalHoverTooltipLayer
        tooltip={portalHover.tooltip}
        tooltipRef={portalHover.tooltipRef}
        scheduleClose={portalHover.scheduleClose}
        clearLeaveTimer={portalHover.clearLeaveTimer}
      />
    </div>
  );
}

/** Single-select isSelect: title + icons + wrapping option buttons inside the chip shell. */
function GuideFeatureIsSelectInline({
  actionsStripLayout,
  closedName,
  chipForEngine,
  chip,
  featRow,
  effectiveKey,
  chipPayloadExtras,
  selectOpts,
  selectDisabled,
  onV2CardChip,
  bumpIsSelect,
  ci,
  n,
  featureTipMarkdown,
  preview,
  groupOuterClass = V2_INLINE_GROUP_OUTER,
  segmentOffClass = V2_INLINE_SEG_OFF,
  tooltipWide = false,
}) {
  const segmentBankAnchorRef = useRef(null);
  const portalHover = usePortalHoverTooltip();
  const chipTipMd = featureTipMarkdown || closedName;
  const chipTipContent = preview ? (
    <PreviewModeTooltipBody>
      <MarkdownText text={chipTipMd} className="text-[11px] leading-relaxed dh-md" />
    </PreviewModeTooltipBody>
  ) : (
    <MarkdownText text={chipTipMd} className="text-[11px] leading-relaxed dh-md" />
  );
  const featureDescForMerge =
    typeof chipForEngine?.description === 'string' && chipForEngine.description.trim()
      ? chipForEngine.description.trim()
      : typeof featRow?.description === 'string' && featRow.description.trim()
        ? featRow.description.trim()
        : '';

  return (
    <div className={actionsStripLayout ? 'w-full min-w-0 basis-full' : 'w-full min-w-0'}>
      <div className={groupOuterClass} role="group" aria-label={String(closedName)}>
        <Tooltip content={chipTipContent} placement="bottom" className="relative block w-full min-w-0">
          <div className={V2_INLINE_GROUP_TITLE_ROW}>
            <span className="font-semibold text-[11px] text-dh min-w-0 shrink break-words">{closedName}</span>
            <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
            {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
          </div>
        </Tooltip>
        <div ref={segmentBankAnchorRef} className="w-full min-w-0">
          <V2SegmentedRowWrap key={`${effectiveKey}-${ci}-isseg-${n}`}>
          {selectOpts.map((o) => {
            const id = o.id ?? o.name;
            const idStr = id != null ? String(id) : '';
            const name = o.name ?? o.label ?? String(id ?? '');
            const rowKey = idStr || name;
            const rawDesc = typeof o.description === 'string' ? o.description.trim() : '';
            return (
              <button
                key={rowKey}
                type="button"
                tabIndex={selectDisabled ? -1 : undefined}
                aria-disabled={selectDisabled}
                onMouseEnter={(e) => {
                  if (!rawDesc) return;
                  const optTipMd = mergeOptionAndFeatureTooltipMarkdown(rawDesc, featureDescForMerge);
                  if (!optTipMd) return;
                  if (preview) {
                    portalHover.showFromPointerEvent(e, {
                      anchorRef: segmentBankAnchorRef,
                      renderInner: (
                        <PreviewModeTooltipBody>
                          <MarkdownText text={optTipMd} className="text-[11px] leading-relaxed dh-md" />
                        </PreviewModeTooltipBody>
                      ),
                      contentKey: `${rowKey}-${optTipMd.slice(0, 48)}`,
                    });
                  } else {
                    portalHover.showFromPointerEvent(e, {
                      anchorRef: segmentBankAnchorRef,
                      label: name,
                      description: optTipMd,
                      wide: tooltipWide,
                    });
                  }
                }}
                onMouseLeave={portalHover.scheduleClose}
                onKeyDown={(e) => {
                  if (selectDisabled && (e.key === ' ' || e.key === 'Enter')) e.preventDefault();
                }}
                onClick={() => {
                  if (selectDisabled || id == null || id === '') return;
                  onV2CardChip({
                    featRow,
                    chip: chipForEngine,
                    featureKey: effectiveKey,
                    selectOpts: { selectedId: idStr },
                    ...chipPayloadExtras,
                  });
                  bumpIsSelect(ci);
                }}
                className={`${V2_INLINE_SEG_BTN_BASE} ${segmentOffClass} ${
                  selectDisabled ? 'opacity-50 pointer-events-auto' : ''
                }`}
              >
                <span className="break-words">{name}</span>
              </button>
            );
          })}
          </V2SegmentedRowWrap>
        </div>
      </div>
      <PortalHoverTooltipLayer
        tooltip={portalHover.tooltip}
        tooltipRef={portalHover.tooltipRef}
        scheduleClose={portalHover.scheduleClose}
        clearLeaveTimer={portalHover.clearLeaveTimer}
      />
    </div>
  );
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
  /** When set (e.g. below a declarative template), passed through to `onV2CardChip` → `runV2OwnedCardChipTableAction` / `activateV2OwnedCardChip` (`placementShape` for `collectChipsForShapePlacement`). */
  placementShape,
  /** `full` — inline active + unusable (default). `activeOnly` / `unusableOnly` — sheet Actions splits globally (see `CharacterFeatureActionsBody`). */
  stripSlot = 'full',
  /** Prefix for stable keys when `stripSlot="unusableOnly"` merges rows. */
  stripKeyPrefix,
}) {
  const [isSelectNonce, setIsSelectNonce] = useState({});
  const bumpIsSelect = (ci) => {
    setIsSelectNonce((prev) => ({ ...prev, [ci]: (prev[ci] || 0) + 1 }));
  };

  const chipPayloadExtras = placementShape != null ? { placementShape } : {};

  const preview = interactionMode === 'preview';
  const canInteract = !preview && typeof onV2CardChip === 'function';
  const effectiveKey = featureKey || model.name;
  const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);
  if (!model.cardChips?.length) return null;
  if (onlyIsToggle && !(model.cardChips || []).some((c) => c?.isToggle)) return null;

  const sourcePalette = getSheetSourceChipPalette(resolveSheetSourcePaletteKey(featRow, model.sourceType));

  const chipElements = model.cardChips.map((chip, ci) => {
        if (onlyIsToggle && !chip.isToggle) return null;
        const baseName = chip.name || model.displayName;
        const resolvedName = typeof baseName === 'function' ? baseName(tableForChips) : baseName;
        const chipForEngine = { ...chip, name: resolvedName };
        const logicDisabled = resolveChipDisabled(chipForEngine, tableForChips);
        const resourceUnaffordable = !!chipForEngine.resourceUnaffordable;
        const chipDisabled = logicDisabled || resourceUnaffordable;
        const engineDisableHint = chip.disableHint ?? getChipDisableHint(chipForEngine, tableForChips);
        const chipUsed = !!(chip.frequency && isUsed);
        const moveToUnusable = shouldMoveV2ActionChipToUnusableSubsection({
          usedThisCycle: chipUsed,
          resourceUnaffordable,
        });
        const usedHint = chipUsed
          ? `Already used (${getFrequencyCycleWord(chip.frequency) || chip.frequency}).`
          : null;
        const cardDisableReason =
          preview ? null : !canInteract ? null : usedHint || (chipDisabled ? engineDisableHint : null);
        const hideDisableTooltipBecauseSubsection = stripSlot === 'unusableOnly' && moveToUnusable;
        const cardDisableReasonForTooltip = hideDisableTooltipBecauseSubsection ? null : cardDisableReason;
        const label = chipForEngine.name;
        const tipText = buildGuideCardChipTipText(chipForEngine, featRow, label);
        const tipContent = (
          <MarkdownText text={String(tipText || '')} className="text-[11px] leading-relaxed dh-md" />
        );
        const isToggle = !!chip.isToggle;
        const selectOpts = getSelectOptions(chip, featRow, el, v2TableContext);
        const isSelect = typeof chip.isSelect === 'function' && selectOpts.length > 0;

        if (isSelect && selectOpts.length >= 2 && chip.selectPresentation === 'iconGrid') {
          return {
            element: (
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
                if (!preview) {
                  if (hideDisableTooltipBecauseSubsection) elementalTip = null;
                  else if (!canInteract) elementalTip = null;
                  else if (chipDisabled) elementalTip = engineDisableHint;
                  else if (cantUse) {
                    if (isUsed && chip.frequency) elementalTip = usedHint;
                    else if (stressMaxed && !activeChanneledElement) elementalTip = 'Stress is full; cannot channel a new element.';
                  }
                }
                const chipBtn = (
                  <button
                    type="button"
                    disabled={preview || cantUse || !canInteract || chipDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (preview || cantUse || !canInteract || chipDisabled) return;
                      onV2CardChip({
                        featRow,
                        chip: chipForEngine,
                        featureKey: effectiveKey,
                        selectOpts: { selectedId: id },
                        ...chipPayloadExtras,
                      });
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border transition-all shrink-0 ${
                      isActive
                        ? sourcePalette.actionActive
                        : cantUse || preview
                          ? 'border-dh-border/50 bg-dh-raised/30 text-dh-muted opacity-60 cursor-not-allowed'
                          : `${sourcePalette.actionDefault} cursor-pointer`
                    }`}
                    aria-label={opt.name || id}
                  >
                    <Icon size={12} className="shrink-0" />
                    <span>{opt.name || id}</span>
                  </button>
                );
                const optMarkdown = (
                  <MarkdownText text={String(opt.description || '')} className="text-[11px] leading-relaxed dh-md" />
                );
                return (
                  <Tooltip
                    key={String(id)}
                    label={elementalTip || undefined}
                    content={
                      preview ? (
                        <PreviewModeTooltipBody>{optMarkdown}</PreviewModeTooltipBody>
                      ) : !elementalTip ? (
                        optMarkdown
                      ) : undefined
                    }
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
            ),
            moveToUnusable,
          };
        }

        if (isSelect && selectOpts.length > 0 && chip.selectPresentation !== 'iconGrid') {
          const n = isSelectNonce[ci] ?? 0;
          const selectCls = actionsStripLayout ? 'text-xs w-full' : 'text-xs';
          /** Actions strip: chip name (e.g. "Prayer Die — Action"); expanded card: chip name. */
          const closedName = label;
          const selectDisabled = preview || !canInteract || chipDisabled || chipUsed;

          if (selectOpts.length <= V2_REVIEW_CHIP_INLINE_OPTION_MAX && !chip.multiSelect) {
            return {
              element: (
              <GuideFeatureIsSelectInline
                key={`${ci}-isseg-${n}`}
                actionsStripLayout={actionsStripLayout}
                closedName={closedName}
                chipForEngine={chipForEngine}
                chip={chip}
                featRow={featRow}
                effectiveKey={effectiveKey}
                chipPayloadExtras={chipPayloadExtras}
                selectOpts={selectOpts}
                selectDisabled={selectDisabled}
                onV2CardChip={onV2CardChip}
                bumpIsSelect={bumpIsSelect}
                ci={ci}
                n={n}
                featureTipMarkdown={tipText}
                preview={preview}
                groupOuterClass={sourcePalette.groupOuter}
                segmentOffClass={sourcePalette.segmentOff}
                tooltipWide={model.name === 'Beastform' || model.name === 'Evolution'}
              />
            ),
            moveToUnusable,
            };
          }

          return {
            element: (
            <div key={`${ci}-${n}`} className={actionsStripLayout ? 'w-full min-w-0 basis-full' : undefined}>
              <CustomSelect
                key={`isselect-${ci}-${n}`}
                value={null}
                placeholder={actionsStripLayout ? closedName : 'Choose…'}
                truncateClosedLabel={!!actionsStripLayout}
                renderPlaceholder={() => (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className={`min-w-0 text-inherit ${actionsStripLayout ? 'truncate' : ''}`}>{closedName}</span>
                    <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
                    {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
                  </span>
                )}
                options={selectOpts}
                getOptionKey={(o) => o.id ?? o.name}
                getOptionLabel={(o) => o.name ?? o.label ?? String(o.id ?? '')}
                getOptionDescription={(o) => o.description}
                tooltipWide={model.name === 'Beastform' || model.name === 'Evolution'}
                disabled={preview || !canInteract}
                selectionBlocked={chipDisabled || chipUsed}
                disabledReason={
                  preview
                    ? undefined
                    : !canInteract
                      ? undefined
                      : hideDisableTooltipBecauseSubsection
                        ? undefined
                        : usedHint || (chipDisabled ? engineDisableHint : undefined)
                }
                disabledTooltipContent={
                  preview ? (
                    <PreviewModeTooltipBody>
                      <MarkdownText text={String(tipText || '')} className="text-[11px] leading-relaxed dh-md" />
                    </PreviewModeTooltipBody>
                  ) : undefined
                }
                className={selectCls}
                triggerClassName={sourcePalette.triggerClosed}
                onChange={(opt) => {
                  if (opt == null || !canInteract || chipDisabled || chipUsed) return;
                  const id = opt.id ?? opt.name;
                  if (id == null || id === '') return;
                  onV2CardChip({
                    featRow,
                    chip: chipForEngine,
                    featureKey: effectiveKey,
                    selectOpts: { selectedId: id },
                    ...chipPayloadExtras,
                  });
                  bumpIsSelect(ci);
                }}
              />
            </div>
            ),
            moveToUnusable,
          };
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
          const closedName = label;
          const targetPickDisabled = preview || !canInteract || chipDisabled || chipUsed;
          return {
            element: (
            <GuideFeatureSegmentedSelectTargetsRow
              key={`${ci}-stseg-${n}`}
              actionsStripLayout={actionsStripLayout}
              closedName={closedName}
              chipForEngine={chipForEngine}
              chip={chip}
              featRow={featRow}
              effectiveKey={effectiveKey}
              chipPayloadExtras={chipPayloadExtras}
              selectTargetOpts={selectTargetOpts}
              targetPickDisabled={targetPickDisabled}
              onV2CardChip={onV2CardChip}
              bumpIsSelect={bumpIsSelect}
              ci={ci}
              n={n}
              tipText={tipText}
              preview={preview}
              sourcePalette={sourcePalette}
            />
            ),
            moveToUnusable,
          };
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
          return {
            element: (
            <Tooltip
              key={ci}
              label={preview ? undefined : cardDisableReasonForTooltip || undefined}
              content={
                preview ? (
                  <PreviewModeTooltipBody>{tipContent}</PreviewModeTooltipBody>
                ) : !cardDisableReasonForTooltip ? (
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
                  onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey, ...chipPayloadExtras });
                }}
                className={`inline-flex items-start gap-1 max-w-full rounded px-1.5 py-1 text-left border transition-colors ${
                  preview || !canInteract || chipDisabled || toggleDeferAwait
                    ? 'border-dh-border/50 bg-dh-raised/30 text-dh-muted opacity-70 cursor-not-allowed'
                    : active
                      ? sourcePalette.actionActive
                      : sourcePalette.actionDefault
                } ${toggleDeferAwait ? `animate-pulse ${sourcePalette.toggleDeferRing}` : ''}`}
                aria-pressed={active}
                aria-busy={toggleDeferAwait || undefined}
              >
                {active ? <CheckSquare size={11} className="shrink-0 mt-0.5" /> : <Square size={11} className="shrink-0 mt-0.5" />}
                <span className="flex min-w-0 flex-1 items-start gap-1.5">
                  <span className="text-sm font-semibold leading-tight min-w-0 flex-1">{label}</span>
                  <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
                </span>
              </button>
            </Tooltip>
            ),
            moveToUnusable,
          };
        }

        const narrativeOnly = !!chip.narrativeBannerOnly;
        const canShareNarrative = narrativeOnly && typeof onShareFeature === 'function';
        const narrativeActivatable = canInteract || canShareNarrative;
        const narrativeDisableReason =
          preview ? null : !narrativeActivatable ? null : usedHint || (chipDisabled ? engineDisableHint : null);
        const narrativeDisableReasonForTooltip = hideDisableTooltipBecauseSubsection ? null : narrativeDisableReason;
        const defaultChipInactive =
          preview || chipUsed || (narrativeOnly ? !narrativeActivatable : !canInteract) || chipDisabled;
        return {
          element: (
          <Tooltip
            key={ci}
            label={
              preview
                ? undefined
                : narrativeOnly
                  ? narrativeDisableReasonForTooltip || undefined
                  : cardDisableReasonForTooltip || undefined
            }
            content={
              preview ? (
                <PreviewModeTooltipBody>{tipContent}</PreviewModeTooltipBody>
              ) : narrativeOnly ? (
                !narrativeDisableReasonForTooltip ? (
                  tipContent
                ) : undefined
              ) : !cardDisableReasonForTooltip ? (
                tipContent
              ) : undefined
            }
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
                  onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey, ...chipPayloadExtras });
                  return;
                }
                if (!canInteract) return;
                onV2CardChip({ featRow, chip: chipForEngine, featureKey: effectiveKey, ...chipPayloadExtras });
              }}
              className={`inline-flex flex-col items-stretch gap-1 max-w-full rounded px-1.5 py-1 text-left border transition-colors ${
                defaultChipInactive
                  ? 'border-dh-border bg-dh-raised/50 text-dh-muted cursor-not-allowed'
                  : narrativeOnly
                    ? 'dh-sheet-clickable-chip border-dh-border/60 bg-dh-raised/50 text-dh-muted hover:bg-dh-hover/40 hover:border-dh-strong/70 hover:text-dh'
                    : sourcePalette.actionDefault
              }`}
            >
              <span className="flex items-start gap-1.5 min-w-0">
                <span
                  className={`min-w-0 flex-1 truncate font-semibold leading-tight ${narrativeOnly ? 'text-[11px] font-normal' : 'text-sm'}`}
                >
                  {label}
                </span>
                <span className="inline-flex flex-wrap items-center gap-1 shrink-0 justify-end">
                  <FeatureResourceCostIcons action={chip} iconSize={9} />
                  {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
                </span>
              </span>
            </button>
          </Tooltip>
          ),
          moveToUnusable,
        };
      });
  const chipRows = chipElements.filter(Boolean);
  const activeEls = chipRows.filter((r) => !r.moveToUnusable).map((r) => r.element);
  const unusableEls = chipRows.filter((r) => r.moveToUnusable).map((r) => r.element);

  if (stripSlot === 'activeOnly') {
    if (actionsStripLayout) {
      return activeEls.length > 0 ? (
        <WidthSortedFlexWrap className="flex flex-wrap gap-1.5 items-center content-start">{activeEls}</WidthSortedFlexWrap>
      ) : null;
    }
    return activeEls.length > 0 ? <div className="flex flex-col gap-1.5">{activeEls}</div> : null;
  }

  if (stripSlot === 'unusableOnly') {
    if (!unusableEls.length) return null;
    return unusableEls.map((chipEl, i) =>
      cloneElement(chipEl, { key: `${stripKeyPrefix ?? 'chip'}-${i}` }),
    );
  }

  const unusableSubsection =
    unusableEls.length > 0 ? (
      <div
        className={`space-y-1 min-w-0 ${activeEls.length > 0 ? 'pt-1.5 mt-0.5 border-t border-dh-border/50' : ''}`}
      >
        <p className="text-[9px] tracking-widest text-dh-muted/90 font-semibold uppercase">Used or too costly</p>
        {actionsStripLayout ? (
          <WidthSortedFlexWrap className="flex flex-wrap gap-1.5 items-center content-start">
            {unusableEls}
          </WidthSortedFlexWrap>
        ) : (
          <div className="flex flex-col gap-1.5">{unusableEls}</div>
        )}
      </div>
    ) : null;

  if (actionsStripLayout) {
    return (
      <div className="space-y-2 min-w-0 w-full">
        {activeEls.length > 0 && (
          <WidthSortedFlexWrap className="flex flex-wrap gap-1.5 items-center content-start">
            {activeEls}
          </WidthSortedFlexWrap>
        )}
        {unusableSubsection}
      </div>
    );
  }
  return (
    <div className="space-y-2 min-w-0">
      {activeEls.length > 0 && <div className="flex flex-col gap-1.5">{activeEls}</div>}
      {unusableSubsection}
    </div>
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
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object, activeElements?: object[] }} [props.v2TableContext] — for `isSelect` chips (Druid Beastform, etc.)
 * @param {boolean} [props.hideV2CardChips] — when true, omit the V2 chip row (e.g. chips live in a separate Actions card).
 * @param {object} [props.sheetHighlightAbility] — when set, row is a domain ability from `el.abilities` (source-badge dimming).
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
  v2TableContext,
  pendingBanners,
  hideV2CardChips = false,
  sheetHighlightAbility = null,
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

  const highlightCtx = useCharacterSheetSourceHighlightState();
  const highlight = highlightCtx?.highlight ?? null;
  const cardDimmed = shouldDimFeatOrAbilityRow(sheetHighlightAbility, featRow, el, highlight);

  const shellClass = 'rounded-lg overflow-hidden bg-dh-raised/40 border-t border-dh-border/60';

  const sourceBadge = model.sourceLabel && (
    <span
      className={`text-[9px] rounded px-1 shrink-0 ${
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
                    ? 'text-[9px] dh-magic-source-badge'
                    : 'bg-emerald-900/60 text-emerald-300'
      }`}
    >
      {model.sourceLabel}
    </span>
  );

  const lifted = model.liftedHeader;
  const freqForHeader = lifted?.frequency ?? legacy.frequency ?? null;
  const titleCostAction = buildTitleCostAction(model, legacy);

  const actionLoopPhases = model.actionLoopPhases;
  const showPhaseIcons =
    actionLoopPhases &&
    (actionLoopPhases.intent || actionLoopPhases.reviewAction || actionLoopPhases.reviewOutcome);

  const showHiddenPhaseChipsIcon = !!model.hasHiddenConditionalPhaseChips;

  const passiveLines = model.passiveBonusTooltipLines ?? [];
  const showPassiveBonusIcon = passiveLines.length > 0;
  const passiveBonusTooltipLabel = [
    FEATURE_CARD_PASSIVE_BONUS_UI.tooltipTitle,
    ...passiveLines,
    '',
    FEATURE_CARD_PASSIVE_BONUS_UI.tooltipSheetNote,
  ].join('\n');

  const hasVisibleCardChips = model.cardChips.length > 0 && !hideV2CardChips;

  const showWidgetRow =
    hasVisibleCardChips ||
    model.showLegacyUseStrip ||
    model.legacyPassive.length > 0 ||
    !!rangerFocusToggle ||
    !!faerieWingsProps ||
    ((prayerDiceProps?.dice?.length ?? 0) > 0);

  const badgeRow =
    (showPhaseIcons || showHiddenPhaseChipsIcon || showPassiveBonusIcon) ||
    titleCostAction ||
    freqForHeader ||
    activeChanneledElement ||
    sourceBadge;

  const legacyStatusLine =
    legacy.isActive && !open && !activeChanneledElement && model.cardChips.length === 0 ? (
      <span
        className={`text-[9px] rounded px-1 border shrink-0 w-fit max-w-full ${
          legacy.frequency
            ? isUsed
              ? 'bg-dh-raised border-dh-border text-dh-muted'
              : 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
            : isUsed
              ? 'bg-dh-raised border-dh-border text-dh-muted'
              : hasDice
                ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                : legacy.hopeCost > 0
                  ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
                  : 'bg-amber-950/30 border-amber-700/30 text-amber-500/70'
        }`}
      >
        {legacy.frequency
          ? isUsed
            ? (
                <span className="inline-flex items-center gap-1">
                  <span>Used</span>
                  <FrequencyCycleChipSuffix frequency={legacy.frequency} iconSize={9} />
                </span>
              )
            : (
                <span className="inline-flex items-center gap-1">
                  <span>Unused</span>
                  <FrequencyCycleChipSuffix frequency={legacy.frequency} iconSize={9} />
                </span>
              )
          : isUsed
            ? '✓ used'
            : hasDice
              ? '⚄ active'
              : 'active'}
      </span>
    ) : null;

  return (
    <div className={cardDimmed ? SHEET_SOURCE_DIM_CLASS : 'transition-opacity duration-150'}>
    <div className={shellClass}>
      <div className="px-2 py-1.5 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full min-w-0 flex items-start gap-1 text-left transition-colors rounded -m-1 p-1 hover:bg-dh-hover/40"
        >
          {open ? <ChevronDown size={11} className="text-dh-muted shrink-0 mt-0.5" /> : <ChevronRight size={11} className="text-dh-muted shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 w-full">
              <span className="text-sm font-semibold text-dh leading-snug min-w-0 shrink-0 max-w-full">{model.displayName}</span>
              {badgeRow ? (
                <div className="flex flex-wrap items-center gap-1 justify-end min-w-0 flex-1">
                  {(showPhaseIcons || showHiddenPhaseChipsIcon || showPassiveBonusIcon) && (
                    <span className="inline-flex items-center gap-0.5 shrink-0 text-dh">
                      {showHiddenPhaseChipsIcon && (
                        <Tooltip label={FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.tooltip} placement="bottom">
                          <span className="inline-flex" aria-label={FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.tooltip}>
                            <FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI.Icon size={10} className="shrink-0" aria-hidden />
                          </span>
                        </Tooltip>
                      )}
                      {actionLoopPhases?.intent && (
                        <Tooltip label={ACTION_LOOP_PHASE_UI.intent.tooltip} placement="bottom">
                          <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.intent.tooltip}>
                            <ACTION_LOOP_PHASE_UI.intent.Icon size={10} className="shrink-0" aria-hidden />
                          </span>
                        </Tooltip>
                      )}
                      {actionLoopPhases?.reviewAction && (
                        <Tooltip label={ACTION_LOOP_PHASE_UI.reviewAction.tooltip} placement="bottom">
                          <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.reviewAction.tooltip}>
                            <ACTION_LOOP_PHASE_UI.reviewAction.Icon size={10} className="shrink-0" aria-hidden />
                          </span>
                        </Tooltip>
                      )}
                      {actionLoopPhases?.reviewOutcome && (
                        <Tooltip label={ACTION_LOOP_PHASE_UI.reviewOutcome.tooltip} placement="bottom">
                          <span className="inline-flex" aria-label={ACTION_LOOP_PHASE_UI.reviewOutcome.tooltip}>
                            <ACTION_LOOP_PHASE_UI.reviewOutcome.Icon size={10} className="shrink-0" aria-hidden />
                          </span>
                        </Tooltip>
                      )}
                      {showPassiveBonusIcon && (
                        <Tooltip label={passiveBonusTooltipLabel} placement="bottom">
                          <span
                            className="inline-flex text-dh-muted"
                            aria-label={passiveBonusTooltipLabel}
                          >
                            <FEATURE_CARD_PASSIVE_BONUS_UI.Icon size={10} className="shrink-0" aria-hidden />
                          </span>
                        </Tooltip>
                      )}
                    </span>
                  )}
                  {titleCostAction && <FeatureResourceCostIcons action={titleCostAction} iconSize={10} className="shrink-0" />}
                  {freqForHeader && <FrequencyCycleChipSuffix frequency={freqForHeader} iconSize={10} />}
                  {activeChanneledElement && (
                    <span className="text-[9px] rounded px-1 border shrink-0 bg-emerald-950/60 border-emerald-600/60 text-emerald-300 font-semibold">
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
                  {sourceBadge}
                </div>
              ) : null}
            </div>
            {legacyStatusLine ? <div className="min-w-0">{legacyStatusLine}</div> : null}
          </div>
        </button>
      </div>

      {showWidgetRow && (
        <div className="px-2 pb-2 pt-1.5 space-y-1.5">
          {hasVisibleCardChips && (
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
                  <p className="text-[10px] text-dh-muted italic inline-flex items-center gap-1 flex-wrap">
                    <span>Used</span>
                    <FrequencyCycleChipSuffix frequency={legacy.frequency} iconSize={9} />
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
                  : 'border-dh-border/60 text-dh-muted hover:border-dh-strong hover:text-dh'
              }`}
              title={
                rangerFocusToggle.value
                  ? "Your next weapon attack will spend 1 Hope and attempt Ranger's Focus"
                  : "Arm your next weapon attack to spend 1 Hope and attempt Ranger's Focus"
              }
            >
              {"Attempt Ranger's Focus"}
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
                  className="rounded border-dh-border"
                />
                <span className="text-[10px] font-medium text-dh">Flying</span>
              </label>
            </div>
          )}

          {model.legacyPassive.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {model.legacyPassive.map((ps, i) => (
                <span key={i} className="text-[9px] rounded px-1.5 py-0.5 bg-dh-raised/80 border border-dh-border text-dh-muted">
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
              <p className="text-[9px] text-dh-muted">Use +Roll / −Dmg in roll/damage banners</p>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="px-2 pb-2 pt-1.5 text-[11px] text-dh leading-relaxed">
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
                    className="shrink-0 p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
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
                    className="shrink-0 p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
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
            <span className="block clear-both mt-0.5 text-[10px] text-dh-muted italic">
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
    </div>
  );
}
