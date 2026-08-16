import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { FeatureDescription } from './FeatureDescription.jsx';
import {
  DEFAULT_GM_MOVES,
  FEAR_FAILURE_START,
  FEAR_SUCCESS_END,
  FEAR_SUCCESS_START,
  HOPE_END,
  buildConsolidatedGmMovesMenu,
  gmMovesMenuCount,
} from '../lib/gm-moves-menu.js';
import {
  arrangeGmMovesSection,
  encounterSourceOrder,
  inCameraAdversaryCardKeys,
  livingAdversaryCardKeys,
  pickTallestGmSection,
} from '../lib/gm-moves-layout.js';
import { extractGmFeatureWhenClause } from '../lib/helpers.js';
import { PortalHoverTooltipLayer, usePortalHoverTooltip } from '../lib/portal-hover-tooltip.jsx';
import { useHoverOverlay } from '../lib/useHoverOverlay.js';
import { useTouchDevice } from '../lib/useTouchDevice.js';

/**
 * Track which living adversary types overlap the current camera viewport.
 * @param {Array<object>} activeElements
 */
export function useGmMovesCameraPartition(activeElements) {
  const activeElementsRef = useRef(activeElements);
  activeElementsRef.current = activeElements;
  const mapViewportFtRef = useRef(null);
  const inViewAdvSigRef = useRef('');
  const [inViewAdvCardKeys, setInViewAdvCardKeys] = useState(() => new Set());
  const [mapViewportKnown, setMapViewportKnown] = useState(false);

  const sync = useCallback(() => {
    const vp = mapViewportFtRef.current;
    const known = !!(vp && vp.width > 0 && vp.height > 0);
    const keys = known ? inCameraAdversaryCardKeys(activeElementsRef.current, vp) : new Set();
    const sig = `${known ? '1' : '0'}:${[...keys].sort().join(',')}`;
    if (sig === inViewAdvSigRef.current) return;
    inViewAdvSigRef.current = sig;
    setMapViewportKnown(known);
    setInViewAdvCardKeys(keys);
  }, []);

  const onViewportFt = useCallback((viewportFt) => {
    mapViewportFtRef.current = viewportFt ?? null;
    sync();
  }, [sync]);

  useEffect(() => {
    sync();
  }, [activeElements, sync]);

  return { inViewAdvCardKeys, mapViewportKnown, onViewportFt };
}

function MovesSectionCard({ title, children }) {
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-dh-border bg-gradient-to-b from-dh-surface to-dh-raised/80 p-2">
      <span className="text-sm font-semibold uppercase tracking-wider text-dh-muted">{title}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GmMovesFeaturePreview({ feature }) {
  return (
    <div>
      <div className="text-xs font-semibold text-white mb-1.5">{feature.name}</div>
      {feature.sourceName ? (
        <div className="text-[10px] text-dh-muted mb-1.5">{feature.sourceName}</div>
      ) : null}
      {feature.description ? (
        <FeatureDescription description={feature.description} />
      ) : null}
    </div>
  );
}

export function useGmMovesOverlay() {
  const isTouch = useTouchDevice();
  return useHoverOverlay({ hideDelay: 150, isTouch, mode: 'click', getClickToggleKey: () => 'gm-moves' });
}

export function GmMovesTrigger({ overlay, activeElements = [], characterCount = 1 }) {
  const count = gmMovesMenuCount(buildConsolidatedGmMovesMenu(activeElements, characterCount));
  return (
    <div
      data-testid="gm-moves-trigger"
      className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors cursor-pointer ${overlay.isOpen ? 'border-dh-hope/60 bg-dh-inset' : 'border-dh-strong bg-dh-surface hover:border-dh-hope/40'}`}
      {...overlay.triggerProps(true)}
    >
      <Zap size={14} className="text-dh-hope shrink-0" />
      <span className="text-xs font-semibold text-dh uppercase tracking-wider flex-1">GM Moves</span>
      {count > 0 ? <span className="text-[10px] text-dh-muted tabular-nums">{count}</span> : null}
    </div>
  );
}

/**
 * Scene-editor GM Moves overlay (preview: no dice / Fear spend).
 * Parent must be `position: relative`; overlay covers the map, left of the w-56 aside.
 */
export function GmMovesOverlay({
  overlay,
  activeElements = [],
  characterCount = 1,
  inViewAdvCardKeys,
  mapViewportKnown = false,
}) {
  const isTouch = useTouchDevice();
  const portalTooltip = usePortalHoverTooltip();
  const [offCameraOpen, setOffCameraOpen] = useState(false);
  const [showStripLegend, setShowStripLegend] = useState(false);

  const menu = useMemo(
    () => buildConsolidatedGmMovesMenu(activeElements, characterCount),
    [activeElements, characterCount],
  );
  const sourceOrder = useMemo(() => encounterSourceOrder(activeElements), [activeElements]);
  const adversaryCardKeys = useMemo(() => livingAdversaryCardKeys(activeElements), [activeElements]);
  const arrangeOpts = useMemo(() => ({
    sourceOrder,
    inViewAdvKeys: inViewAdvCardKeys,
    adversaryCardKeys,
    viewportKnown: mapViewportKnown,
  }), [sourceOrder, inViewAdvCardKeys, adversaryCardKeys, mapViewportKnown]);

  const prArranged = useMemo(
    () => arrangeGmMovesSection([...(menu.Passives ?? []), ...(menu.Reactions ?? [])], arrangeOpts),
    [menu, arrangeOpts],
  );
  const actionsArranged = useMemo(
    () => arrangeGmMovesSection(menu.Actions ?? [], arrangeOpts),
    [menu, arrangeOpts],
  );
  const fearArranged = useMemo(
    () => arrangeGmMovesSection(menu['Fear Actions'] ?? [], arrangeOpts),
    [menu, arrangeOpts],
  );
  const tall = pickTallestGmSection(
    prArranged.inView.length,
    actionsArranged.inView.length,
    fearArranged.inView.length,
  );

  useEffect(() => {
    if (!overlay.isOpen) portalTooltip.hide();
  }, [overlay.isOpen, portalTooltip.hide]);

  useEffect(() => {
    if (!overlay.isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      overlay.close();
      portalTooltip.hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay.isOpen, overlay.close, portalTooltip.hide]);

  const showFeatureTip = (e, feature) => {
    portalTooltip.showFromPointerEvent(e, {
      wide: true,
      renderInner: <GmMovesFeaturePreview feature={feature} />,
    });
  };

  const renderPassiveChip = (feature) => {
    const whenText = extractGmFeatureWhenClause(feature.description);
    return (
      <button
        type="button"
        key={`${feature.cardKey}-${feature.featureKey}`}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dh-strong bg-dh-raised/90 px-2 py-1 text-left text-xs text-dh transition-colors hover:border-dh-hope/40"
        onMouseEnter={(ev) => {
          if (isTouch) return;
          showFeatureTip(ev, feature);
        }}
        onMouseLeave={() => portalTooltip.scheduleClose()}
        onClick={(ev) => {
          if (!isTouch) return;
          showFeatureTip(ev, feature);
        }}
      >
        <span className="min-w-0 flex-1 truncate font-medium leading-snug">{whenText || feature.name}</span>
        <span className="shrink-0 text-[10px] text-dh-muted">{feature.sourceName}</span>
      </button>
    );
  };

  const renderFeatureRow = (feature) => (
    <div
      key={`${feature.cardKey}-${feature.featureKey}-${feature.name}`}
      onMouseEnter={(ev) => {
        if (isTouch) return;
        showFeatureTip(ev, feature);
      }}
      onMouseLeave={() => {
        if (isTouch) return;
        portalTooltip.scheduleClose();
      }}
      onClick={(ev) => {
        if (!isTouch) return;
        showFeatureTip(ev, feature);
      }}
      className="group flex w-full cursor-default rounded border border-dh-strong bg-dh-raised/50 text-left transition-all hover:bg-dh-raised hover:border-r-yellow-500"
    >
      {feature._isRoleMove && (
        <div className="flex shrink-0 gap-[3px] py-1.5 pl-1">
          <div className="h-full w-1 rounded-full bg-dh-hope/90" />
          <div className="h-full w-1 rounded-full bg-fuchsia-500/85" />
        </div>
      )}
      <div className="min-w-0 flex-1 p-2">
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-dh">
            {feature.name}
          </span>
          <span className="shrink-0 rounded bg-dh-surface px-1.5 py-0.5 text-[10px] text-dh-muted">{feature.sourceName}</span>
        </div>
        {!feature._isRoleMove && feature.featureKey !== 'attack' && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-dh-muted">
            <FeatureDescription description={feature.description} />
          </p>
        )}
      </div>
    </div>
  );

  const renderOffCameraFold = (offCamera, renderItem, listClassName) => {
    if (offCamera.length === 0) return null;
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setOffCameraOpen((o) => !o)}
          className="flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wider text-dh-muted hover:bg-dh-hover/40 hover:text-dh"
        >
          {offCameraOpen
            ? <ChevronDown size={11} className="shrink-0" />
            : <ChevronRight size={11} className="shrink-0" />}
          Off camera
          <span className="font-normal normal-case tracking-normal tabular-nums">({offCamera.length})</span>
        </button>
        {offCameraOpen && (
          <div className={listClassName}>{offCamera.map(renderItem)}</div>
        )}
      </div>
    );
  };

  const prSection = (
    <MovesSectionCard title="Passives & Reactions">
      <div className="pr-0.5">
        {prArranged.inView.length === 0 && prArranged.offCamera.length === 0 ? (
          <span className="text-xs text-dh-muted">—</span>
        ) : (
          <>
            {prArranged.inView.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {prArranged.inView.map(renderPassiveChip)}
              </div>
            )}
            {renderOffCameraFold(prArranged.offCamera, renderPassiveChip, 'mt-1 flex flex-wrap gap-1.5')}
          </>
        )}
      </div>
    </MovesSectionCard>
  );
  const actionsSection = (
    <MovesSectionCard title="Actions">
      <div className="space-y-1.5 pr-0.5">
        {actionsArranged.inView.length === 0 && actionsArranged.offCamera.length === 0 ? (
          <span className="text-xs text-dh-muted">—</span>
        ) : (
          <>
            {actionsArranged.inView.map(renderFeatureRow)}
            {renderOffCameraFold(actionsArranged.offCamera, renderFeatureRow, 'mt-1 space-y-1.5')}
          </>
        )}
      </div>
    </MovesSectionCard>
  );
  const fearSection = (
    <MovesSectionCard title="Fear Actions">
      <div className="space-y-1.5 pr-0.5">
        {fearArranged.inView.length === 0 && fearArranged.offCamera.length === 0 ? (
          <span className="text-xs text-dh-muted">—</span>
        ) : (
          <>
            {fearArranged.inView.map(renderFeatureRow)}
            {renderOffCameraFold(fearArranged.offCamera, renderFeatureRow, 'mt-1 space-y-1.5')}
          </>
        )}
      </div>
    </MovesSectionCard>
  );

  const mainColumns = (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      {tall === 'pr' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{prSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {fearSection}
            {actionsSection}
          </div>
        </>
      )}
      {tall === 'actions' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{actionsSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {prSection}
            {fearSection}
          </div>
        </>
      )}
      {tall === 'fear' && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2">{fearSection}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {prSection}
            {actionsSection}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {overlay.isOpen && (
        <div
          ref={overlay.overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="scene-gm-moves-title"
          className="absolute z-20 flex min-h-0"
          style={{ top: 8, left: 8, right: '14.5rem', bottom: 8 }}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-dh-strong bg-dh-surface shadow-2xl">
            <div className="z-10 shrink-0 rounded-t-xl border-b border-dh-strong bg-dh-canvas p-3">
              <h2 id="scene-gm-moves-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dh">
                <Zap size={16} className="text-dh-hope" /> GM Moves
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="flex items-start gap-2 p-2">
                <div className="flex w-52 shrink-0 flex-col self-start overflow-hidden rounded-lg border border-dh-border bg-dh-surface/90">
                  <div className="shrink-0 border-b border-dh-border bg-dh-canvas px-2 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-dh-muted">Default Moves</span>
                  </div>
                  <div className="p-2">
                    <div className="flex gap-2">
                      <div
                        className="relative w-4 shrink-0 cursor-default"
                        onMouseEnter={() => { if (!isTouch) setShowStripLegend(true); }}
                        onMouseLeave={() => { if (!isTouch) setShowStripLegend(false); }}
                        onClick={() => { if (isTouch) setShowStripLegend((v) => !v); }}
                      >
                        <div className="absolute left-0 w-1 rounded-full bg-dh-hope/90" style={{ top: 0, height: `${(HOPE_END / DEFAULT_GM_MOVES.length) * 100}%` }} />
                        <div className="absolute left-[5px] w-1 rounded-full bg-fuchsia-500/85" style={{ top: `${(FEAR_SUCCESS_START / DEFAULT_GM_MOVES.length) * 100}%`, height: `${((FEAR_SUCCESS_END - FEAR_SUCCESS_START) / DEFAULT_GM_MOVES.length) * 100}%` }} />
                        <div className="absolute left-[10px] w-1 rounded-full bg-blue-900" style={{ top: `${(FEAR_FAILURE_START / DEFAULT_GM_MOVES.length) * 100}%`, bottom: 0 }} />
                        {showStripLegend && (
                          <div className="pointer-events-none absolute left-6 top-0 z-50 w-48 rounded-lg border border-dh-strong bg-dh-raised p-3 shadow-xl">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-dh-muted">When to use</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-dh-hope" />
                                <span className="text-xs text-dh">Failure with Hope</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-fuchsia-500" />
                                <span className="text-xs text-dh">Success with Fear</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-blue-900" />
                                <span className="text-xs text-dh">Failure with Fear</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {DEFAULT_GM_MOVES.map((move, idx) => (
                          <div
                            key={idx}
                            onMouseEnter={(e) => {
                              if (isTouch) return;
                              portalTooltip.showFromPointerEvent(e, {
                                wide: true,
                                label: move.name,
                                description: move.example,
                              });
                            }}
                            onMouseLeave={() => portalTooltip.scheduleClose()}
                            onClick={(e) => {
                              if (!isTouch) return;
                              portalTooltip.showFromPointerEvent(e, {
                                wide: true,
                                label: move.name,
                                description: move.example,
                              });
                            }}
                            className="w-full cursor-default rounded px-2 py-1 text-left text-xs leading-snug text-dh transition-colors hover:bg-dh-raised"
                          >
                            {move.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {mainColumns}
                  {activeElements.length === 0 && (
                    <div className="text-center text-xs text-dh-muted">
                      No active elements. Add adversaries or environments to populate GM Moves.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PortalHoverTooltipLayer
        tooltip={portalTooltip.tooltip}
        tooltipRef={portalTooltip.tooltipRef}
        scheduleClose={portalTooltip.scheduleClose}
        clearLeaveTimer={portalTooltip.clearLeaveTimer}
      />
    </>
  );
}
