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
  Sticker,
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
  resolveGuideSourceLabel,
} from '../../lib/build-feature-card-model.js';
import { FrequencyCycleChipSuffix } from '../../lib/frequency-cycle-ui.jsx';
import { FeatureResourceCostIcons } from '../FeatureResourceCostIcons.jsx';
import { v2OriginFeatureDescriptorsByName } from '../../lib/v2-origin-feature-descriptors.js';
import {
  readPersistedToggleIsOn,
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
import {
  getFeatureSheetLabelParts,
  getAbilitySheetLabelParts,
  resolveFeatureSheetDisplayCustom,
} from '../../lib/sheet-display-names.js';
import { SheetDisplayLabelInline } from '../../lib/sheet-display-label-inline.jsx';
import { shouldDimFeatOrAbilityRow, SHEET_SOURCE_DIM_CLASS } from '../../lib/source-badge-sheet-highlight.js';
import {
  buildGuideCardChipTipText,
  mergeOptionAndFeatureTooltipMarkdown,
} from '../../lib/guide-feature-card-tip-text.js';
import { usePortalHoverTooltip, PortalHoverTooltipLayer } from '../../lib/portal-hover-tooltip.jsx';
import {
  getSheetSourceChipPalette,
  intrinsicWidthActionsStripPalette,
  resolveSheetSourcePaletteKey,
} from '../../lib/sheet-source-chip-styles.js';
import { computeActionChipUnusableState } from '../../lib/v2-action-chip-strip.js';

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

/** Disabled reason line + feature/chip markdown — Actions strip “unusable” subsection. */
function UnusableChipTooltipBody({ primaryLine, markdownBody }) {
  return (
    <div className="space-y-2">
      {primaryLine ? (
        <p className="text-[11px] font-semibold text-dh-muted leading-snug border-b border-dh-border/60 pb-1.5">
          {primaryLine}
        </p>
      ) : null}
      <MarkdownText text={String(markdownBody || '')} className="text-[11px] leading-relaxed dh-md" />
    </div>
  );
}

const ACTIONS_STRIP_UNUSABLE_BTN =
  'border-dh-border/50 bg-dh-raised/30 text-dh-muted opacity-80 cursor-not-allowed';

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
  actionsStripIntrinsicWidth = false,
  titleTooltipPlacement = 'bottom',
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
  unusableStripMode = false,
  primaryUnusableLine = null,
}) {
  const segmentBankAnchorRef = useRef(null);
  const portalHover = usePortalHoverTooltip();
  const targetsChipTipMd = tipText || closedName;
  const targetsChipTipContent = unusableStripMode ? (
    preview ? (
      <PreviewModeTooltipBody>
        <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={targetsChipTipMd} />
      </PreviewModeTooltipBody>
    ) : (
      <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={targetsChipTipMd} />
    )
  ) : preview ? (
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

  const stripOuter =
    actionsStripLayout && actionsStripIntrinsicWidth
      ? 'max-w-full min-w-0 shrink w-auto'
      : actionsStripLayout
        ? 'w-full min-w-0 basis-full'
        : 'w-full min-w-0';
  const titleBlock = actionsStripIntrinsicWidth ? 'relative block max-w-full min-w-0' : 'relative block w-full min-w-0';
  const segBankCls = actionsStripIntrinsicWidth ? 'max-w-full min-w-0 w-auto' : 'w-full min-w-0';

  return (
    <div className={stripOuter}>
      <div
        className={`${sourcePalette.groupOuter}${unusableStripMode ? ` ${ACTIONS_STRIP_UNUSABLE_BTN}` : ''}`}
        role="group"
        aria-label={`${closedName} targets`}
      >
        <Tooltip content={targetsChipTipContent} placement={titleTooltipPlacement} className={titleBlock}>
          <div className={V2_INLINE_GROUP_TITLE_ROW}>
            <span className="font-semibold text-[11px] text-dh min-w-0 shrink break-words">{closedName}</span>
            <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
            {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
          </div>
        </Tooltip>
        <div ref={segmentBankAnchorRef} className={segBankCls}>
          <V2SegmentedRowWrap
            key={`${closedName}-${ci}-stseg-${n}`}
            intrinsicWidth={actionsStripLayout && actionsStripIntrinsicWidth}
          >
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
                  if (!tDesc && !unusableStripMode) return;
                  const merged = tDesc
                    ? mergeOptionAndFeatureTooltipMarkdown(tDesc, targetFeatureDescForMerge)
                    : '';
                  const tgtTipMd =
                    unusableStripMode && primaryUnusableLine
                      ? `${primaryUnusableLine}\n\n${merged || targetsChipTipMd}`
                      : merged;
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
                  targetPickDisabled || unusableStripMode ? `${ACTIONS_STRIP_UNUSABLE_BTN} opacity-100` : ''
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
 * Adversary map pin: single-target `selectTargets` actions as one chip (pinned adversary is implicit).
 * Multi-target (`multiSelect: true`) still uses {@link GuideFeatureSegmentedSelectTargetsRow}.
 */
function GuideFeaturePinSelectTargetSingleChip({
  label,
  chipForEngine,
  chip,
  featRow,
  effectiveKey,
  chipPayloadExtras,
  pinnedOpt,
  pinId,
  tipText,
  tipContent,
  preview,
  chipTipPlacement,
  unusableStripMode,
  primaryUnusableLine,
  stripPalette,
  targetPickDisabled,
  onV2CardChip,
  bumpIsSelect,
  ci,
}) {
  const targetName =
    pinnedOpt && (pinnedOpt.name != null && String(pinnedOpt.name).trim() !== '')
      ? String(pinnedOpt.name).trim()
      : null;
  const pinClickDisabled = targetPickDisabled || unusableStripMode || !pinnedOpt;
  const defaultChipInactive = pinClickDisabled;

  return (
    <Tooltip
      content={
        preview ? (
          unusableStripMode ? (
            <PreviewModeTooltipBody>
              <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
            </PreviewModeTooltipBody>
          ) : (
            <PreviewModeTooltipBody>{tipContent}</PreviewModeTooltipBody>
          )
        ) : unusableStripMode ? (
          <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
        ) : (
          tipContent
        )
      }
      placement={chipTipPlacement ?? 'top'}
    >
      <button
        type="button"
        disabled={defaultChipInactive}
        onClick={(e) => {
          e.stopPropagation();
          if (pinClickDisabled || !pinnedOpt) return;
          onV2CardChip({
            featRow,
            chip: chipForEngine,
            featureKey: effectiveKey,
            selectOpts: { selectedTargetIds: [pinId] },
            ...chipPayloadExtras,
          });
          bumpIsSelect(ci);
        }}
        className={`inline-flex flex-col items-stretch gap-0.5 max-w-full rounded px-1.5 py-1 text-left border transition-colors ${
          defaultChipInactive
            ? `border-dh-border bg-dh-raised/50 text-dh-muted cursor-not-allowed${unusableStripMode ? ` ${ACTIONS_STRIP_UNUSABLE_BTN}` : ''}`
            : stripPalette.actionDefault
        }`}
      >
        <span className="flex items-start gap-1.5 min-w-0">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">{label}</span>
          <span className="inline-flex flex-wrap items-center gap-1 shrink-0 justify-end">
            <FeatureResourceCostIcons action={chipForEngine} iconSize={9} />
            {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
          </span>
        </span>
        {targetName ? (
          <span className="text-[10px] text-dh-muted leading-tight truncate pl-0.5" title={targetName}>
            → {targetName}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

/** Single-select isSelect: title + icons + wrapping option buttons inside the chip shell. */
function GuideFeatureIsSelectInline({
  actionsStripLayout,
  actionsStripIntrinsicWidth = false,
  titleTooltipPlacement = 'bottom',
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
  unusableStripMode = false,
  primaryUnusableLine = null,
}) {
  const segmentBankAnchorRef = useRef(null);
  const portalHover = usePortalHoverTooltip();
  const chipTipMd = featureTipMarkdown || closedName;
  const chipTipContent = unusableStripMode ? (
    preview ? (
      <PreviewModeTooltipBody>
        <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={chipTipMd} />
      </PreviewModeTooltipBody>
    ) : (
      <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={chipTipMd} />
    )
  ) : preview ? (
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

  const stripOuter =
    actionsStripLayout && actionsStripIntrinsicWidth
      ? 'max-w-full min-w-0 shrink w-auto'
      : actionsStripLayout
        ? 'w-full min-w-0 basis-full'
        : 'w-full min-w-0';
  const titleBlock = actionsStripIntrinsicWidth ? 'relative block max-w-full min-w-0' : 'relative block w-full min-w-0';
  const segBankCls = actionsStripIntrinsicWidth ? 'max-w-full min-w-0 w-auto' : 'w-full min-w-0';

  return (
    <div className={stripOuter}>
      <div
        className={`${groupOuterClass}${unusableStripMode ? ` ${ACTIONS_STRIP_UNUSABLE_BTN}` : ''}`}
        role="group"
        aria-label={String(closedName)}
      >
        <Tooltip content={chipTipContent} placement={titleTooltipPlacement} className={titleBlock}>
          <div className={V2_INLINE_GROUP_TITLE_ROW}>
            <span className="font-semibold text-[11px] text-dh min-w-0 shrink break-words">{closedName}</span>
            <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
            {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
          </div>
        </Tooltip>
        <div ref={segmentBankAnchorRef} className={segBankCls}>
          <V2SegmentedRowWrap
            key={`${effectiveKey}-${ci}-isseg-${n}`}
            intrinsicWidth={actionsStripLayout && actionsStripIntrinsicWidth}
          >
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
                  if (!rawDesc && !unusableStripMode) return;
                  const merged = rawDesc
                    ? mergeOptionAndFeatureTooltipMarkdown(rawDesc, featureDescForMerge)
                    : '';
                  const optTipMd =
                    unusableStripMode && primaryUnusableLine
                      ? `${primaryUnusableLine}\n\n${merged || chipTipMd}`
                      : merged;
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
                  selectDisabled || unusableStripMode ? `${ACTIONS_STRIP_UNUSABLE_BTN} opacity-100` : ''
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
  /** When true, only render `isToggle` chips plus `selectPresentation: 'iconGrid'` selects (compact Game Table character panel). */
  onlyIsToggle = false,
  /** Pending action banners — tentative on/off for deferred toggles (`gameTableDeferUntilBannerAck`) until GM ack. */
  pendingBanners,
  /** When `'right'`, chip tooltips open to the right of the trigger (e.g. Game Table Characters panel). */
  chipTooltipPlacement,
  /** When set (e.g. below a declarative template), passed through to `onV2CardChip` → `runV2OwnedCardChipTableAction` / `activateV2OwnedCardChip` (`placementShape` for `collectChipsForShapePlacement`). */
  placementShape,
  /** `full` — inline active + unusable (default). `activeOnly` / `unusableOnly` — sheet Actions splits globally (see `CharacterFeatureActionsBody`). */
  stripSlot = 'full',
  /** Prefix for stable keys when `stripSlot="unusableOnly"` merges rows. */
  stripKeyPrefix,
  /** Sheet Actions strip: dim this feature's chips when LOADOUT highlight hides non-selected sources. */
  dimmed = false,
  /** Master Actions strip: hug content width (no full-width shells / basis-full). */
  actionsStripIntrinsicWidth = false,
  /**
   * Adversary map pin: when set, single-target `selectTargets` chips render as one button with this
   * adversary as the implicit target (see {@link GuideFeaturePinSelectTargetSingleChip}). Omit on sheet.
   */
  pinSelectTargetInstanceId = null,
}) {
  const [isSelectNonce, setIsSelectNonce] = useState({});
  const bumpIsSelect = (ci) => {
    setIsSelectNonce((prev) => ({ ...prev, [ci]: (prev[ci] || 0) + 1 }));
  };

  const chipPayloadExtras = placementShape != null ? { placementShape } : {};
  const chipTipPlacement = chipTooltipPlacement;
  const titleRowTipPlacement = chipTipPlacement ?? 'bottom';

  const preview = interactionMode === 'preview';
  const canInteract = !preview && typeof onV2CardChip === 'function';
  const effectiveKey = featureKey || model.name;
  const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);
  if (!model.cardChips?.length) return null;
  if (
    onlyIsToggle &&
    !(model.cardChips || []).some(
      (c) =>
        c &&
        (c.isToggle || (typeof c.isSelect === 'function' && c.selectPresentation === 'iconGrid')),
    )
  ) {
    return null;
  }

  const sourcePalette = getSheetSourceChipPalette(resolveSheetSourcePaletteKey(featRow, model.sourceType));
  const stripPalette =
    actionsStripLayout && actionsStripIntrinsicWidth
      ? intrinsicWidthActionsStripPalette(sourcePalette)
      : sourcePalette;

  const chipElements = model.cardChips.map((chip, ci) => {
        const selectOpts = getSelectOptions(chip, featRow, el, v2TableContext);
        if (onlyIsToggle) {
          const isIconGridStripChip =
            typeof chip.isSelect === 'function' &&
            chip.selectPresentation === 'iconGrid' &&
            selectOpts.length >= 2;
          if (!chip.isToggle && !isIconGridStripChip) return null;
        }
        const {
          chipForEngine,
          resolvedName,
          logicDisabled,
          resourceUnaffordable,
          chipUsed,
          moveToUnusable,
          usedHint,
          primaryUnusableLine,
        } = computeActionChipUnusableState(chip, model, tableForChips, el, effectiveKey);
        const chipDisabled = logicDisabled || resourceUnaffordable;
        const engineDisableHint = chip.disableHint ?? getChipDisableHint(chipForEngine, tableForChips);
        /** Sheet unusable row (`unusableOnly`) or expanded card’s lower chip row (`full` + moved). */
        const unusableStripMode = stripSlot === 'unusableOnly' || (stripSlot === 'full' && moveToUnusable);
        const cardDisableReason =
          preview ? null : !canInteract ? null : usedHint || (chipDisabled ? engineDisableHint : null);
        const cardDisableReasonForTooltip = unusableStripMode && !preview ? null : cardDisableReason;
        const label = chipForEngine.name;
        const tipText = buildGuideCardChipTipText(chipForEngine, featRow, label);
        const tipContent = (
          <MarkdownText text={String(tipText || '')} className="text-[11px] leading-relaxed dh-md" />
        );
        const isToggle = !!chip.isToggle;
        const isSelect = typeof chip.isSelect === 'function' && selectOpts.length > 0;

        if (isSelect && selectOpts.length >= 2 && chip.selectPresentation === 'iconGrid') {
          const featureDescForMergeEl =
            typeof chipForEngine?.description === 'string' && chipForEngine.description.trim()
              ? chipForEngine.description.trim()
              : typeof featRow?.description === 'string' && featRow.description.trim()
                ? featRow.description.trim()
                : '';
          const iconGridStripOuter =
            actionsStripLayout && actionsStripIntrinsicWidth
              ? 'max-w-full min-w-0 shrink w-auto'
              : actionsStripLayout
                ? 'w-full min-w-0 basis-full'
                : 'w-full min-w-0';
          const iconGridTitleBlock = actionsStripIntrinsicWidth
            ? 'relative block max-w-full min-w-0'
            : 'relative block w-full min-w-0';
          const iconGridSegBankCls = actionsStripIntrinsicWidth
            ? 'max-w-full min-w-0 w-auto'
            : 'w-full min-w-0';
          return {
            element: (
            <div key={ci} className={iconGridStripOuter}>
              <div
                className={`${stripPalette.groupOuter}${
                  unusableStripMode ? ` ${ACTIONS_STRIP_UNUSABLE_BTN}` : ''
                }`}
                role="group"
                aria-label={String(label)}
              >
                <Tooltip content={tipContent} placement={titleRowTipPlacement} className={iconGridTitleBlock}>
                  <div className={V2_INLINE_GROUP_TITLE_ROW}>
                    <span className="font-semibold text-[11px] text-dh min-w-0 shrink break-words">{label}</span>
                    <FeatureResourceCostIcons action={chipForEngine} iconSize={9} className="shrink-0" />
                    {chip.frequency ? <FrequencyCycleChipSuffix frequency={chip.frequency} iconSize={9} /> : null}
                  </div>
                </Tooltip>
                <div className={iconGridSegBankCls}>
                  <V2SegmentedRowWrap
                    intrinsicWidth={actionsStripLayout && actionsStripIntrinsicWidth}
                    className={actionsStripLayout ? 'items-start' : ''}
                  >
                {selectOpts.map((opt) => {
                  const id = opt.id || opt.name;
                  const Icon = ELEMENT_ICONS[id] || ELEMENT_ICONS[String(id).toLowerCase()] || Zap;
                  const isActive = !!activeChanneledElement && String(id).toLowerCase() === String(activeChanneledElement).toLowerCase();
                  const cantUse = isUsed || (stressMaxed && !isActive);
                  let elementalTip = null;
                  if (!preview && !unusableStripMode) {
                    if (!canInteract) elementalTip = null;
                    else if (chipDisabled) elementalTip = engineDisableHint;
                    else if (cantUse) {
                      if (isUsed && chip.frequency) elementalTip = usedHint;
                      else if (stressMaxed && !activeChanneledElement) elementalTip = 'Stress is full; cannot channel a new element.';
                    }
                  }
                  const rawOptDesc = typeof opt.description === 'string' ? opt.description.trim() : '';
                  const mergedOptMd =
                    mergeOptionAndFeatureTooltipMarkdown(rawOptDesc, featureDescForMergeEl) || String(tipText || '');
                  const optMarkdown = (
                    <MarkdownText text={String(opt.description || '')} className="text-[11px] leading-relaxed dh-md" />
                  );
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
                      className={`${V2_INLINE_SEG_BTN_BASE} ${
                        isActive ? stripPalette.segmentOn : stripPalette.segmentOff
                      } ${unusableStripMode ? `${ACTIONS_STRIP_UNUSABLE_BTN} opacity-100` : ''} ${
                        !isActive && (cantUse || preview) ? 'opacity-60 cursor-not-allowed' : ''
                      } inline-flex items-center gap-1`}
                      aria-label={opt.name || id}
                      aria-pressed={isActive}
                    >
                      <Icon size={12} className="shrink-0" />
                      <span>{opt.name || id}</span>
                    </button>
                  );
                  return (
                    <Tooltip
                      key={String(id)}
                      label={unusableStripMode ? undefined : elementalTip || undefined}
                      content={
                        unusableStripMode ? (
                          preview ? (
                            <PreviewModeTooltipBody>
                              <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={mergedOptMd} />
                            </PreviewModeTooltipBody>
                          ) : (
                            <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={mergedOptMd} />
                          )
                        ) : preview ? (
                          <PreviewModeTooltipBody>{optMarkdown}</PreviewModeTooltipBody>
                        ) : !elementalTip ? (
                          optMarkdown
                        ) : undefined
                      }
                      placement={chipTipPlacement ?? 'bottom'}
                    >
                      {chipBtn}
                    </Tooltip>
                  );
                })}
                  </V2SegmentedRowWrap>
                </div>
                {stressMaxed && !activeChanneledElement && (
                  <span className="text-[9px] text-orange-500/70 italic whitespace-nowrap shrink-0 px-0.5">
                    Stress full — cannot channel
                  </span>
                )}
              </div>
            </div>
            ),
            moveToUnusable,
          };
        }

        if (isSelect && selectOpts.length > 0 && chip.selectPresentation !== 'iconGrid') {
          const n = isSelectNonce[ci] ?? 0;
          const selectCls = actionsStripLayout
            ? actionsStripIntrinsicWidth
              ? 'text-xs w-auto max-w-full'
              : 'text-xs w-full'
            : 'text-xs';
          /** Actions strip: chip name (e.g. "Prayer Die — Action"); expanded card: chip name. */
          const closedName = label;
          const selectDisabled = preview || !canInteract || chipDisabled || chipUsed;

          if (selectOpts.length <= V2_REVIEW_CHIP_INLINE_OPTION_MAX && !chip.multiSelect) {
            return {
              element: (
              <GuideFeatureIsSelectInline
                key={`${ci}-isseg-${n}`}
                actionsStripLayout={actionsStripLayout}
                actionsStripIntrinsicWidth={actionsStripIntrinsicWidth}
                titleTooltipPlacement={titleRowTipPlacement}
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
                groupOuterClass={stripPalette.groupOuter}
                segmentOffClass={stripPalette.segmentOff}
                tooltipWide={model.name === 'Beastform' || model.name === 'Evolution'}
                unusableStripMode={unusableStripMode}
                primaryUnusableLine={primaryUnusableLine}
              />
            ),
            moveToUnusable,
            };
          }

          const selectWrapClass =
            actionsStripLayout
              ? actionsStripIntrinsicWidth
                ? 'w-auto max-w-full min-w-0'
                : 'w-full min-w-0 basis-full'
              : undefined;
          const selectBlock = (
            <div key={`${ci}-${n}`} className={selectWrapClass}>
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
                      : unusableStripMode
                        ? primaryUnusableLine || undefined
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
                triggerClassName={
                  unusableStripMode
                    ? `${stripPalette.triggerClosed} ${ACTIONS_STRIP_UNUSABLE_BTN}`
                    : stripPalette.triggerClosed
                }
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
          );
          return {
            element: unusableStripMode ? (
                <Tooltip
                  key={`${ci}-${n}-uwrap`}
                  content={(
                    <UnusableChipTooltipBody
                      primaryLine={primaryUnusableLine}
                      markdownBody={String(tipText || '')}
                    />
                  )}
                  placement="bottom"
                  className={selectWrapClass ? `relative flex flex-col min-w-0 ${selectWrapClass}` : 'relative flex w-full min-w-0'}
                >
                  {selectBlock}
                </Tooltip>
              ) : (
                selectBlock
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

        const pinTargetId =
          pinSelectTargetInstanceId != null && pinSelectTargetInstanceId !== ''
            ? String(pinSelectTargetInstanceId)
            : null;
        const usePinSingleTargetChip =
          !!pinTargetId &&
          needsSelectTargets &&
          selectTargetOpts.length > 0 &&
          chip.multiSelect !== true;

        if (usePinSingleTargetChip) {
          const pinnedOpt = selectTargetOpts.find((o) => String(o.instanceId ?? o.id) === pinTargetId);
          const n = isSelectNonce[ci] ?? 0;
          const targetPickDisabled = preview || !canInteract || chipDisabled || chipUsed;
          return {
            element: (
              <GuideFeaturePinSelectTargetSingleChip
                key={`${ci}-pin-st-${n}`}
                label={label}
                chipForEngine={chipForEngine}
                chip={chip}
                featRow={featRow}
                effectiveKey={effectiveKey}
                chipPayloadExtras={chipPayloadExtras}
                pinnedOpt={pinnedOpt}
                pinId={pinTargetId}
                tipText={tipText}
                tipContent={tipContent}
                preview={preview}
                chipTipPlacement={chipTipPlacement}
                unusableStripMode={unusableStripMode}
                primaryUnusableLine={primaryUnusableLine}
                stripPalette={stripPalette}
                targetPickDisabled={targetPickDisabled}
                onV2CardChip={onV2CardChip}
                bumpIsSelect={bumpIsSelect}
                ci={ci}
              />
            ),
            moveToUnusable,
          };
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
              actionsStripIntrinsicWidth={actionsStripIntrinsicWidth}
              titleTooltipPlacement={titleRowTipPlacement}
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
              sourcePalette={stripPalette}
              unusableStripMode={unusableStripMode}
              primaryUnusableLine={primaryUnusableLine}
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
              label={preview || unusableStripMode ? undefined : cardDisableReasonForTooltip || undefined}
              content={
                preview ? (
                  unusableStripMode ? (
                    <PreviewModeTooltipBody>
                      <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
                    </PreviewModeTooltipBody>
                  ) : (
                    <PreviewModeTooltipBody>{tipContent}</PreviewModeTooltipBody>
                  )
                ) : unusableStripMode ? (
                  <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
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
              placement={chipTipPlacement ?? 'top'}
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
                      ? stripPalette.actionActive
                      : stripPalette.actionDefault
                } ${toggleDeferAwait ? `animate-pulse ${stripPalette.toggleDeferRing}` : ''}`}
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
        const narrativeDisableReasonForTooltip = unusableStripMode && !preview ? null : narrativeDisableReason;
        const defaultChipInactive =
          preview || chipUsed || (narrativeOnly ? !narrativeActivatable : !canInteract) || chipDisabled;
        return {
          element: (
          <Tooltip
            key={ci}
            label={
              preview || unusableStripMode
                ? undefined
                : narrativeOnly
                  ? narrativeDisableReasonForTooltip || undefined
                  : cardDisableReasonForTooltip || undefined
            }
            content={
              preview ? (
                unusableStripMode ? (
                  <PreviewModeTooltipBody>
                    <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
                  </PreviewModeTooltipBody>
                ) : (
                  <PreviewModeTooltipBody>{tipContent}</PreviewModeTooltipBody>
                )
              ) : unusableStripMode ? (
                <UnusableChipTooltipBody primaryLine={primaryUnusableLine} markdownBody={String(tipText || '')} />
              ) : narrativeOnly ? (
                !narrativeDisableReasonForTooltip ? (
                  tipContent
                ) : undefined
              ) : !cardDisableReasonForTooltip ? (
                tipContent
              ) : undefined
            }
            placement={chipTipPlacement ?? 'top'}
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
                  : stripPalette.actionDefault
              }`}
            >
              <span className="flex items-start gap-1.5 min-w-0">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
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
      if (!activeEls.length) return null;
      const keyed = activeEls.map((chipEl, i) =>
        cloneElement(chipEl, { key: `${stripKeyPrefix ?? 'chip'}-${i}` }),
      );
      if (dimmed) {
        return keyed.map((el, i) => (
          <div key={`${stripKeyPrefix ?? 'chip'}-dim-${i}`} className={SHEET_SOURCE_DIM_CLASS}>
            {el}
          </div>
        ));
      }
      return keyed;
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
        <p className="text-[9px] tracking-widest text-dh-muted/90 font-semibold uppercase">
          Used, inapplicable, or too costly
        </p>
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
 * @param {function} [props.onSheetDisplayNameEdit] — `({ bucket, key, originalName })` Game Table display name
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
  onSheetDisplayNameEdit,
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

  const rawFeatName = featRow.name;
  const enrichedTitle = model.displayName ?? rawFeatName;
  const sourceForFeatureKey =
    typeof featRow.source === 'string' && featRow.source.trim()
      ? featRow.source.trim()
      : resolveGuideSourceLabel(featRow) || '';
  const hasSheetOverride =
    sheetHighlightAbility != null
      ? !!el?.sheetDisplayNames?.abilities?.[effectiveKey]
      : !!resolveFeatureSheetDisplayCustom(
          el?.sheetDisplayNames?.features,
          effectiveKey,
          sourceForFeatureKey,
          rawFeatName,
          el,
        );
  const sheetTitleParts = sheetHighlightAbility != null
    ? getAbilitySheetLabelParts(el, effectiveKey, rawFeatName)
    : getFeatureSheetLabelParts(el, effectiveKey, rawFeatName, sourceForFeatureKey);
  const titleLabel = hasSheetOverride
    ? (sheetTitleParts.parenthetical != null
      ? `${sheetTitleParts.primary} (${sheetTitleParts.parenthetical})`
      : sheetTitleParts.primary)
    : enrichedTitle;

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
        <div className="relative w-full min-w-0 flex items-start -m-1 p-1 rounded transition-colors group hover:bg-dh-hover/40">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 flex items-start gap-1 text-left rounded p-0 hover:bg-transparent"
        >
          {open ? <ChevronDown size={11} className="text-dh-muted shrink-0 mt-0.5" /> : <ChevronRight size={11} className="text-dh-muted shrink-0 mt-0.5" />}
          <div className="relative min-w-0 flex-1 flex items-start">
          {typeof onSheetDisplayNameEdit === 'function' && (
            <button
              type="button"
              title="Custom name"
              onClick={(e) => {
                e.stopPropagation();
                onSheetDisplayNameEdit({
                  bucket: sheetHighlightAbility != null ? 'abilities' : 'features',
                  key: effectiveKey,
                  originalName: rawFeatName,
                });
              }}
              className={`absolute left-0 top-0.5 z-10 inline-flex items-center justify-center p-0.5 rounded text-dh-muted hover:text-sky-400 transition-opacity leading-none ${
                hasSheetOverride
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
              }`}
            >
              <Sticker size={10} className="block shrink-0" aria-hidden />
            </button>
          )}
          <div
            className={`min-w-0 flex-1 flex flex-col gap-1 transition-[padding] duration-75 ${
              typeof onSheetDisplayNameEdit === 'function'
                ? hasSheetOverride
                  ? 'pl-5'
                  : 'pl-0 group-hover:pl-5'
                : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 w-full">
              {hasSheetOverride && sheetTitleParts.parenthetical != null ? (
                <SheetDisplayLabelInline
                  primary={sheetTitleParts.primary}
                  parenthetical={sheetTitleParts.parenthetical}
                  primaryClassName="text-sm font-semibold text-dh leading-snug min-w-0 shrink-0 max-w-full"
                  parenClassName="text-[9px] font-normal text-dh-muted leading-snug shrink-0"
                />
              ) : (
                <span className="text-sm font-semibold text-dh leading-snug min-w-0 shrink-0 max-w-full">{titleLabel}</span>
              )}
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
          </div>
        </button>
        </div>
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
