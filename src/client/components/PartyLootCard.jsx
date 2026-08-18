import { useState } from 'react';
import { Package, X } from 'lucide-react';
import { formatGold } from '../lib/character-gold.js';
import { addInventoryEntries } from '../lib/character-inventory.js';
import { GoldTracker, CharacterInventoryList, Section } from './CharacterDisplay.jsx';
import { InventoryItemPickerModal } from './modals/InventoryItemPickerModal.jsx';

/**
 * Characters-panel card for table-scoped party gold / inventory.
 * Same chrome as {@link GameTableCharacterListCard} (`w-56` sidebar).
 */
export function PartyLootCard({ gold = 0, itemCount = 0, sheetTriggerProps = {} }) {
  const n = Math.max(0, Math.floor(Number(itemCount) || 0));
  return (
    <div
      className="rounded-lg border overflow-hidden bg-dh-surface cursor-pointer flex flex-col min-h-0 min-w-0 border-dh-border"
      {...sheetTriggerProps}
    >
      <div className="px-2.5 py-1.5 border-b border-dh-border flex items-center gap-1.5 hover:bg-dh-hover transition-colors">
        <Package size={10} className="text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-dh truncate flex-1">Party Loot</span>
      </div>
      <div className="px-2.5 py-2 space-y-0.5">
        <p className="text-[11px] text-dh">{formatGold(gold)}</p>
        <p className="text-[11px] text-dh-muted">{n} item{n !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

/**
 * Slim one-column Party Loot sheet (same overlay slot as the character sheet).
 */
export function PartyLootSheet({
  partyLoot,
  editable,
  onGoldChange,
  onInventoryChange,
  moveDestinations,
  onMoveItem,
  onClose,
  overlayRef,
  overlayHandlers,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const gold = partyLoot?.gold ?? 0;
  const inventory = partyLoot?.inventory || [];

  return (
    <div
      ref={overlayRef}
      className="fixed z-[55] flex flex-row gap-2 items-start max-w-[calc(100vw-14rem-8px)] min-w-0"
      style={{
        left: 'calc(14rem + 8px)',
        top: 90,
        height: 'calc(100dvh - 98px)',
      }}
      {...overlayHandlers}
    >
      <div
        className="flex flex-col rounded-xl border border-dh-strong bg-dh-surface shadow-2xl overflow-hidden max-h-full h-full min-h-0 shrink-0 min-w-0"
        style={{ width: 'min(22rem, calc(100vw - 14rem - 8px))' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-dh-strong bg-dh-canvas shrink-0">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dh">
            <Package size={16} className="text-amber-400" />
            Party Loot
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-dh-muted hover:text-dh hover:bg-dh-hover"
            aria-label="Close Party Loot"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <Section label="Inventory">
            <div className="mb-1.5">
              <GoldTracker
                gold={gold}
                editable={editable}
                onChange={editable ? onGoldChange : undefined}
              />
            </div>
            <CharacterInventoryList
              inventory={inventory}
              editable={editable}
              onChange={editable ? onInventoryChange : undefined}
              onOpenPicker={editable ? () => setPickerOpen(true) : undefined}
              moveDestinations={editable ? moveDestinations : undefined}
              onMoveItem={editable ? onMoveItem : undefined}
            />
          </Section>
        </div>
      </div>
      {pickerOpen && editable && (
        <InventoryItemPickerModal
          onClose={() => setPickerOpen(false)}
          onConfirm={(entries) => {
            onInventoryChange?.(addInventoryEntries(inventory, entries));
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
