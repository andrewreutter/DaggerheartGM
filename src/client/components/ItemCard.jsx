import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { resolveV2LibraryItemSourcePath } from '../../features-v2/resolve-feature-source-path.js';
import { SOURCE_BADGE, isOwnItem, needsHodEnrich } from '../lib/constants.js';
import { showLibraryTierShield, showLibraryLevelBadge } from '../lib/library-tier-subtitle.js';
import { ItemActionButtons } from './ItemActionButtons.jsx';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import { LevelBadge } from './LevelBadge.jsx';
import {
  LibraryItemCardCompactRow,
  LibraryItemDisplayContent,
} from './library/LibraryItemDisplayContent.jsx';
import {
  LIBRARY_CARD_DETAIL_ZOOM,
  LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT,
} from '../lib/library-card-dimensions.js';
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
}) {
  const isOwn = isOwnItem(item);
  const badge = showSourceBadge ? (SOURCE_BADGE[item._source] ?? SOURCE_BADGE.own) : null;
  const popularity = item.popularity ?? ((item.clone_count || 0) + (item.play_count || 0));
  const isEnriching = needsHodEnrich(item);

  const tierByName = showLibraryTierShield(tab, item);
  const levelByName = showLibraryLevelBadge(tab, item);
  const showPreview = cardHeight >= LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT;
  const v2LibrarySourcePath = useMemo(
    () => (item?._source === 'srd' ? resolveV2LibraryItemSourcePath(tab, item) : null),
    [tab, item],
  );

  const previewClipRef = useRef(null);
  const previewContentRef = useRef(null);
  const [previewClipped, setPreviewClipped] = useState(false);

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
    isEnriching,
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
  const cardClickOpensModal = !showPreview || isOwn || previewClipped;

  return (
    <div
      onClick={() => {
        if (!cardClickOpensModal) return;
        onView(item);
      }}
      style={{ width: cardWidth, height: cardHeight }}
      className={`bg-dh-surface border border-dh-border rounded-lg transition-colors group overflow-hidden flex flex-col max-w-full shrink-0 relative ${
        cardClickOpensModal
          ? 'cursor-pointer hover:border-dh-strong hover:bg-dh-raised/50'
          : 'cursor-default'
      }`}
    >
      <div
        className={`h-full min-h-0 min-w-0 flex flex-col overflow-hidden px-2 pt-1.5 pb-1 ${showPreview ? '' : 'justify-center'}`}
      >
        {/* Title row: rank chrome, then name + source badge (left-aligned), then actions — no centered title column. */}
        <div className="flex w-full shrink-0 min-h-0 min-w-0 items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-1">
            {tierByName ? (
              <TierShieldBadge
                tier={item.tier}
                scaledFromTier={item._scaledFromTier}
                className="shrink-0"
              />
            ) : null}
            {levelByName ? <LevelBadge level={item.level} className="shrink-0" /> : null}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-start gap-1.5 overflow-hidden">
            <h3 className="min-w-0 flex-1 truncate text-left font-bold text-sm leading-tight text-white transition-colors group-hover:text-red-400">
              {item.name}
            </h3>
            {badge && (
              <span
                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <div
            className="flex shrink-0 items-center justify-end gap-0"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {v2LibrarySourcePath ? (
              <V2SourceInspectButton relativePath={v2LibrarySourcePath} variant="card" />
            ) : null}
            <ItemActionButtons
              variant="card"
              stopPropagation
              isOwn={isOwn}
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
              onEdit={isOwn && onEdit ? () => onEdit(item) : undefined}
              onDelete={isOwn && onDelete ? () => onDelete(tab, item.id) : undefined}
            />
          </div>
        </div>

        {!showPreview ? <LibraryItemCardCompactRow item={item} /> : null}

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
        */}
        {showPreview ? (
        <div className="relative flex-1 min-h-0 overflow-hidden rounded border border-dh-border/80 bg-dh-canvas/50 pointer-events-none">
          <div
            ref={previewClipRef}
            className="h-full w-full overflow-hidden p-1.5 text-left"
            style={{ zoom: LIBRARY_CARD_DETAIL_ZOOM }}
          >
            <div ref={previewContentRef} className="min-w-0">
              <LibraryItemDisplayContent
                layout="libraryCard"
                item={item}
                collection={tab}
                data={data}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                srdData={srdData}
                enriching={isEnriching}
                cardKey={`library-card-${item.id ?? 'new'}`}
              />
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
        ) : null}
      </div>
    </div>
  );
}
