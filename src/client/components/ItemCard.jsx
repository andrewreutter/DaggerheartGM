import { Flame } from 'lucide-react';
import { SOURCE_BADGE, isOwnItem, needsHodEnrich } from '../lib/constants.js';
import { showLibraryTierShield } from '../lib/library-tier-subtitle.js';
import { ItemActionButtons } from './ItemActionButtons.jsx';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import {
  LibraryItemCardCompactRow,
  LibraryItemDisplayContent,
} from './library/LibraryItemDisplayContent.jsx';
import {
  LIBRARY_CARD_DETAIL_ZOOM,
  LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT,
} from '../lib/library-card-dimensions.js';

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
  const showPreview = cardHeight >= LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT;

  return (
    <div
      onClick={() => onView(item)}
      style={{ width: cardWidth, height: cardHeight }}
      className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors group overflow-hidden flex flex-col max-w-full shrink-0 relative"
    >
      <div
        className={`h-full min-h-0 min-w-0 flex flex-col overflow-hidden px-2 pt-1.5 pb-1 ${showPreview ? '' : 'justify-center'}`}
      >
        <div className="grid w-full shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 min-h-0 min-w-0">
          <div className="flex min-w-0 justify-start">
            {tierByName ? (
              <TierShieldBadge
                tier={item.tier}
                scaledFromTier={item._scaledFromTier}
                className="shrink-0"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 items-center justify-start gap-1.5 overflow-hidden">
            <h3 className="min-w-0 truncate text-left font-bold text-sm leading-tight text-white transition-colors group-hover:text-red-400">
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
          <div className="flex min-w-0 justify-end">
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
        <div className="flex-1 min-h-0 overflow-hidden rounded border border-slate-800/80 bg-slate-950/50 pointer-events-none">
          <div
            className="h-full w-full overflow-hidden p-1.5 text-left"
            style={{ zoom: LIBRARY_CARD_DETAIL_ZOOM }}
          >
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
        ) : null}
      </div>
    </div>
  );
}
