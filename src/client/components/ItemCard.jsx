import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import {
  resolveV2FeatureSourcePath,
  resolveV2LibraryItemSourcePath,
} from '../../features-v2/resolve-feature-source-path.js';
import { SOURCE_BADGE, isOwnItem } from '../lib/constants.js';
import { showLibraryTierShield, showLibraryLevelBadge } from '../lib/library-tier-subtitle.js';
import { ItemActionButtons } from './ItemActionButtons.jsx';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import { LevelBadge } from './LevelBadge.jsx';
import { LibraryItemDisplayContent, SceneLibraryCard } from './library/LibraryItemDisplayContent.jsx';
import { LibraryItemImageThumb } from './library/LibraryItemImageThumb.jsx';
import { getLibraryItemImageUrls } from '../lib/library-item-image-urls.js';
import {
  LIBRARY_CARD_DETAIL_ZOOM,
  LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT,
} from '../lib/library-card-dimensions.js';
import {
  computeResizedLibraryWidth,
  computeResizedLibraryHeight,
} from '../lib/library-card-snap.js';
import { MarkdownText } from '../lib/markdown.js';
import { V2SourceInspectButton } from './V2SourceInspectButton.jsx';

export function ItemCard({
  item,
  tab,
  data,
  onView,
  onEdit,
  onDelete,
  onClone,
  onAddToTable,
  /** When set (e.g. Library), Play opens a table picker instead of adding immediately. */
  ownedTables = null,
  partySize = 4,
  partyTier = 1,
  showSourceBadge = true,
  srdData = null,
  characters = [],
  /** Library grid: pixel width (default 360). */
  cardWidth = 360,
  /** Library grid: pixel height (default 176, Tailwind h-44). */
  cardHeight = 176,
  /**
   * Paginated library only: drag bottom/right edges to resize global card dimensions (same as sliders).
   */
  libraryResize = null,
}) {
  const isOwn = isOwnItem(item);
  const badge = showSourceBadge ? (SOURCE_BADGE[item._source] ?? SOURCE_BADGE.own) : null;
  const popularity = item.popularity ?? ((item.clone_count || 0) + (item.play_count || 0));

  const tierByName = showLibraryTierShield(tab, item);
  const levelByName = showLibraryLevelBadge(tab, item);
  const showPreview = cardHeight >= LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT;
  const showCompactTitleThumb = !showPreview && getLibraryItemImageUrls(item).length > 0;
  /** Scene cards with a map: fill the preview without CSS zoom so the map can use leftover height after lists truncate. */
  const sceneMapFillPreview =
    showPreview && tab === 'scenes' && Boolean(item?.maps?.[0]?.mapImageUrl);
  const v2LibrarySourcePath = useMemo(() => {
    if (tab === 'features' && item?._resolveV2) {
      return resolveV2FeatureSourcePath({ ...item._resolveV2, name: item.name });
    }
    return item?._source === 'srd' ? resolveV2LibraryItemSourcePath(tab, item) : null;
  }, [tab, item]);

  const previewClipRef = useRef(null);
  const previewContentRef = useRef(null);
  const [previewClipped, setPreviewClipped] = useState(false);

  const resizeDragRef = useRef(null);

  const applyLibraryResizePointerMove = useCallback(
    (e) => {
      const d = resizeDragRef.current;
      if (!d || !libraryResize) return;
      const { mode, startX, startY, startWidth, startHeight } = d;
      if (mode === 'right') {
        const dx = e.clientX - startX;
        const next = computeResizedLibraryWidth(
          startWidth,
          dx,
          libraryResize.widthMin,
          libraryResize.widthMax,
          libraryResize.snapWidths
        );
        libraryResize.onWidthChange(next);
      } else if (mode === 'bottom') {
        const dy = e.clientY - startY;
        const next = computeResizedLibraryHeight(
          startHeight,
          dy,
          libraryResize.heightMin,
          libraryResize.heightMax
        );
        libraryResize.onHeightChange(next);
      } else if (mode === 'corner') {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const w = computeResizedLibraryWidth(
          startWidth,
          dx,
          libraryResize.widthMin,
          libraryResize.widthMax,
          libraryResize.snapWidths
        );
        const h = computeResizedLibraryHeight(
          startHeight,
          dy,
          libraryResize.heightMin,
          libraryResize.heightMax
        );
        libraryResize.onWidthChange(w);
        libraryResize.onHeightChange(h);
      }
    },
    [libraryResize]
  );

  const endLibraryResizePointer = useCallback(() => {
    const d = resizeDragRef.current;
    resizeDragRef.current = null;
    if (!d?.captureEl || d.pointerId == null) return;
    try {
      if (d.captureEl.hasPointerCapture(d.pointerId)) {
        d.captureEl.releasePointerCapture(d.pointerId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onResizeRightPointerDown = useCallback(
    (e) => {
      if (!libraryResize) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeDragRef.current = {
        mode: 'right',
        pointerId: e.pointerId,
        captureEl: e.currentTarget,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: cardWidth,
        startHeight: cardHeight,
      };
    },
    [libraryResize, cardWidth, cardHeight]
  );

  const onResizeBottomPointerDown = useCallback(
    (e) => {
      if (!libraryResize) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeDragRef.current = {
        mode: 'bottom',
        pointerId: e.pointerId,
        captureEl: e.currentTarget,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: cardWidth,
        startHeight: cardHeight,
      };
    },
    [libraryResize, cardWidth, cardHeight]
  );

  const onResizeCornerPointerDown = useCallback(
    (e) => {
      if (!libraryResize) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeDragRef.current = {
        mode: 'corner',
        pointerId: e.pointerId,
        captureEl: e.currentTarget,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: cardWidth,
        startHeight: cardHeight,
      };
    },
    [libraryResize, cardWidth, cardHeight]
  );

  const onResizeHandlePointerMove = useCallback(
    (e) => {
      if (!resizeDragRef.current) return;
      applyLibraryResizePointerMove(e);
    },
    [applyLibraryResizePointerMove]
  );

  const onResizeHandlePointerUp = useCallback(() => {
    endLibraryResizePointer();
  }, [endLibraryResizePointer]);

  const onResizeHandlePointerCancel = useCallback(() => {
    endLibraryResizePointer();
  }, [endLibraryResizePointer]);

  const measurePreviewClipped = useCallback(() => {
    const el = previewClipRef.current;
    if (!el) {
      setPreviewClipped(false);
      return;
    }
    setPreviewClipped(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    if (!showPreview) {
      setPreviewClipped(false);
      return;
    }
    measurePreviewClipped();
  }, [
    measurePreviewClipped,
    item?.id,
    tab,
    cardWidth,
    cardHeight,
    showPreview,
    partySize,
    partyTier,
  ]);

  useEffect(() => {
    if (!showPreview) return;
    const clip = previewClipRef.current;
    const inner = previewContentRef.current;
    if (!clip) return;
    const ro = new ResizeObserver(() => measurePreviewClipped());
    ro.observe(clip);
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [measurePreviewClipped, showPreview, item?.id, tab]);

  /**
   * Preview cards: open from the body when there's more to read (ellipsis) or the item is yours to edit.
   * Compact cards (no preview): always open — otherwise there's no way to see full details.
   */
  const cardClickOpensModal = !showPreview || isOwn || Boolean(onEdit) || previewClipped;

  const hasTablePick = ownedTables?.length && onAddToTable;
  const hasTableAdd = !ownedTables?.length && onAddToTable;
  const hasAdd = Boolean(hasTablePick || hasTableAdd);
  const hasClone = Boolean(onClone);
  const hasEdit = Boolean(onEdit);
  const hasDelete = Boolean(isOwn && onDelete);
  const hasV2Inspect = Boolean(v2LibrarySourcePath);
  const hasAnyRowAction = hasAdd || hasClone || hasEdit || hasDelete || hasV2Inspect;
  const hasSourceBadge = Boolean(badge && showSourceBadge);
  const showBadgeHoverSwap = hasSourceBadge && hasAnyRowAction;

  const rowActions = (
    <>
      {v2LibrarySourcePath ? (
        <V2SourceInspectButton relativePath={v2LibrarySourcePath} variant="card" />
      ) : null}
      <ItemActionButtons
        variant="card"
        stopPropagation={false}
        isOwn={isOwn}
        canEdit={Boolean(onEdit)}
        itemName={item.name}
        addToTableMenu={
          ownedTables?.length && onAddToTable
            ? { tables: ownedTables, onPick: (tableId) => onAddToTable(item, tab, tableId) }
            : undefined
        }
        onAddToTable={
          !ownedTables?.length && onAddToTable ? () => onAddToTable(item, tab) : undefined
        }
        onClone={onClone ? () => onClone(item) : undefined}
        onEdit={onEdit ? () => onEdit(item) : undefined}
        onDelete={isOwn && onDelete ? () => onDelete(tab, item.id) : undefined}
      />
    </>
  );

  const rowActionsWrap = (
    <div
      className="flex shrink-0 items-center gap-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {rowActions}
    </div>
  );

  return (
    <div
      onClick={() => {
        if (!cardClickOpensModal) return;
        onView(item);
      }}
      style={{ width: cardWidth, height: cardHeight }}
      className={`dh-library-item-card bg-dh-surface border border-dh-border rounded-lg transition-colors group overflow-hidden flex flex-col max-w-full shrink-0 relative ${
        cardClickOpensModal
          ? 'cursor-pointer hover:border-dh-strong hover:bg-dh-raised/50'
          : 'cursor-default'
      }`}
    >
      <div
        className={`h-full min-h-0 min-w-0 flex flex-col overflow-hidden px-2 pt-1.5 pb-1 ${showPreview ? '' : 'justify-start'}`}
      >
        {/* Title row: rank chrome, name (truncate), optional thumb, then source badge or actions (same grid cell — no swap wiggle). */}
        <div className="flex w-full shrink-0 min-h-0 min-w-0 items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-1">
            {tierByName ? (
              <TierShieldBadge
                tier={item.tier}
                scaledFromTier={item._scaledFromTier}
                className="shrink-0"
              />
            ) : null}
            {tab !== 'features' && levelByName ? <LevelBadge level={item.level} className="shrink-0" /> : null}
          </div>
          <h3 className="min-h-0 min-w-0 flex-1 truncate text-left font-bold text-sm leading-tight text-white transition-colors group-hover:text-red-400">
            {item.name}
          </h3>
          {showCompactTitleThumb ? (
            <LibraryItemImageThumb item={item} variant="card" compact />
          ) : null}
          {showBadgeHoverSwap ? (
            <div className="inline-grid shrink-0 grid-cols-1 grid-rows-1 justify-items-end">
              <div
                className="dh-library-card-actions-swap pointer-events-none col-start-1 row-start-1 flex items-center justify-end opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
              >
                {rowActionsWrap}
              </div>
              <div
                className="dh-library-card-badge-swap col-start-1 row-start-1 flex items-center justify-end opacity-100 transition-opacity duration-150 group-hover:pointer-events-none group-hover:opacity-0"
              >
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          ) : hasSourceBadge && !hasAnyRowAction ? (
            <span
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : hasAnyRowAction ? (
            rowActionsWrap
          ) : null}
        </div>

        {tab === 'features' && (item._scope || item._parentName) ? (
          <p className="text-[10px] text-dh-muted/90 truncate shrink-0 -mt-0.5 mb-0.5">
            {item._scope}
            {item._parentName != null && item._parentName !== '' ? ` · ${item._parentName}` : ''}
          </p>
        ) : null}

        {popularity > 0 && (
          <div className="mt-0.5 flex shrink-0 justify-center">
            <span
              className="inline-flex items-center gap-0.5 rounded border border-orange-700/60 bg-orange-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300"
              title={`${item.clone_count || 0} clones · ${item.play_count || 0} plays`}
            >
              <Flame size={9} />
              {popularity}
            </span>
          </div>
        )}

        {/*
          Use CSS zoom (not transform:scale) so layout + clipping work inside flex/virtualized rows.
          Transform scaling kept the modal-sized layout box huge and often produced an empty clip region.
          Scene cards with a map skip zoom and fill the preview so the map keeps its aspect
          preferred size, grows into leftover height, and shrinks only after lists below are truncated.
        */}
        {showPreview ? (
        sceneMapFillPreview ? (
        <div
          ref={previewClipRef}
          className="relative flex-1 min-h-0 overflow-hidden rounded border border-dh-border/80 bg-dh-canvas/50 pointer-events-none"
        >
          <div ref={previewContentRef} className="h-full min-h-0 min-w-0 p-0.5">
            <SceneLibraryCard item={item} compact fill />
          </div>
        </div>
        ) : (
        <div className="relative flex-1 min-h-0 overflow-hidden rounded border border-dh-border/80 bg-dh-canvas/50 pointer-events-none">
          <div
            ref={previewClipRef}
            className="h-full w-full overflow-hidden p-1.5 text-left"
            style={{ zoom: LIBRARY_CARD_DETAIL_ZOOM }}
          >
            <div ref={previewContentRef} className="min-w-0">
              {tab === 'features' ? (
                item.description ? (
                  <MarkdownText
                    text={item.description}
                    className="text-[10px] text-dh-muted leading-snug line-clamp-[12]"
                  />
                ) : (
                  <p className="text-[10px] text-dh-muted leading-snug line-clamp-[12]">—</p>
                )
              ) : (
              <LibraryItemDisplayContent
                layout="libraryCard"
                item={item}
                collection={tab}
                data={data}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                srdData={srdData}
                cardKey={`library-card-${item.id ?? 'new'}`}
              />
              )}
            </div>
          </div>
          {previewClipped ? (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 rounded-b bg-gradient-to-t from-dh-canvas/95 via-dh-canvas/50 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute bottom-1 left-1/2 z-30 -translate-x-1/2 text-center text-lg font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                aria-hidden
              >
                …
              </div>
            </>
          ) : null}
        </div>
        )
        ) : null}
      </div>
      {libraryResize ? (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize card height"
            className="pointer-events-auto absolute bottom-0 left-0 z-[11] h-2 cursor-ns-resize touch-none right-2 rounded-bl-md"
            onPointerDown={onResizeBottomPointerDown}
            onPointerMove={onResizeHandlePointerMove}
            onPointerUp={onResizeHandlePointerUp}
            onPointerCancel={onResizeHandlePointerCancel}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize card width"
            className="pointer-events-auto absolute top-0 right-0 bottom-2 z-[11] w-2 cursor-ew-resize touch-none rounded-tr-md"
            onPointerDown={onResizeRightPointerDown}
            onPointerMove={onResizeHandlePointerMove}
            onPointerUp={onResizeHandlePointerUp}
            onPointerCancel={onResizeHandlePointerCancel}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            role="separator"
            aria-label="Resize card width and height"
            className="pointer-events-auto absolute bottom-0 right-0 z-[12] h-2 w-2 cursor-nwse-resize touch-none rounded-br-md"
            onPointerDown={onResizeCornerPointerDown}
            onPointerMove={onResizeHandlePointerMove}
            onPointerUp={onResizeHandlePointerUp}
            onPointerCancel={onResizeHandlePointerCancel}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      ) : null}
    </div>
  );
}
