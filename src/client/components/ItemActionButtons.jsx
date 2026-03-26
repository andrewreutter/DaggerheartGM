import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, Play, Copy, ExternalLink } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';

const ICON_SIZE = 14;

/**
 * Shared action buttons for item cards and detail modals.
 * Renders Add to Table, Clone, Edit, Delete with consistent visibility logic:
 * - Add to Table: when onAddToTable
 * - Clone: when onClone
 * - Edit: when isOwn && onEdit
 * - Delete: when isOwn && onDelete
 *
 * @param {Object} props
 * @param {() => void} [props.onAddToTable]
 * @param {{ tables: { id: string, name: string }[], onPick: (tableId: string) => void }} [props.addToTableMenu]
 * @param {() => void} [props.onClone]
 * @param {() => void} [props.onEdit]
 * @param {() => void} [props.onDelete]
 * @param {boolean} props.isOwn
 * @param {string} [props.cloningStatus] - When set, Clone button is disabled (e.g. "Cloning...")
 * @param {'card'|'header'} [props.variant='card'] - card: compact for list; header: p-1.5 rounded for modal
 * @param {boolean} [props.stopPropagation] - When true, wrap in div that stops click propagation (for card)
 */
export function ItemActionButtons({
  onAddToTable,
  addToTableMenu,
  onClone,
  onEdit,
  onDelete,
  isOwn,
  itemName = '',
  cloningStatus = '',
  variant = 'card',
  stopPropagation = false,
}) {
  const [addedToTable, setAddedToTable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const useTableMenu = addToTableMenu?.tables?.length > 0;

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      setMenuStyle(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_MIN_W = 200;
    const GAP = 4;
    let left = rect.left;
    if (left + MENU_MIN_W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - MENU_MIN_W - 8);
    setMenuStyle({
      position: 'fixed',
      zIndex: 100,
      top: rect.bottom + GAP,
      left,
      minWidth: MENU_MIN_W,
      maxWidth: Math.min(320, window.innerWidth - 16),
    });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      // Portal menu is outside the trigger; must exclude or mousedown closes before row click fires.
      if (menuRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleAddToTable = () => {
    if (!onAddToTable) return;
    onAddToTable();
    setAddedToTable(true);
    setTimeout(() => setAddedToTable(false), 900);
  };

  const handleClone = () => {
    if (!onClone || cloningStatus) return;
    onClone();
  };

  const handleDelete = () => {
    if (!onDelete) return;
    const label = itemName ? `"${itemName}"` : 'this item';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    onDelete();
  };

  const base = variant === 'header' ? 'p-1.5 rounded' : '';
  /** Card list: compact square targets; icons stay aligned without large gaps between glyphs. */
  const cardIconWrap =
    variant === 'card' ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded' : '';
  const addClass = variant === 'header'
    ? `text-dh-muted hover:text-white hover:bg-dh-hover`
    : 'text-dh-muted hover:text-white';
  const cloneClass = variant === 'header'
    ? `text-dh-muted hover:text-violet-400 hover:bg-dh-hover`
    : 'text-dh-muted hover:text-violet-400';
  const editClass = variant === 'header'
    ? `text-dh-muted hover:text-blue-400 hover:bg-dh-hover`
    : 'text-dh-muted hover:text-blue-400';
  const deleteClass = variant === 'header'
    ? `text-dh-muted hover:text-red-400 hover:bg-dh-hover`
    : 'text-dh-muted hover:text-red-400';

  const addButton = useTableMenu ? (
    <Tooltip label="Add to Game Table">
      <button
        ref={triggerRef}
        type="button"
        onClick={e => {
          e.stopPropagation();
          setMenuOpen(o => !o);
        }}
        aria-label="Add to Game Table"
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        className={`${base} ${cardIconWrap} transition-colors duration-150 ${addedToTable ? 'text-dh-hope' : addClass} ${menuOpen ? 'text-dh-hope-soft' : ''}`}
      >
        <Play size={ICON_SIZE} aria-hidden />
      </button>
    </Tooltip>
  ) : onAddToTable ? (
    <Tooltip label="Add to Game Table">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          handleAddToTable();
        }}
        aria-label="Add to Game Table"
        className={`${base} ${cardIconWrap} transition-colors duration-150 ${addedToTable ? 'text-dh-hope' : addClass}`}
      >
        <Play size={ICON_SIZE} aria-hidden />
      </button>
    </Tooltip>
  ) : null;

  const tableMenuPortal = menuOpen && useTableMenu && menuStyle && createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Choose game table"
      className="rounded-lg border border-dh-strong bg-dh-surface shadow-xl shadow-black/40 max-h-[min(50vh,280px)] flex flex-col overflow-hidden"
      style={menuStyle}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="shrink-0 px-3 py-2 border-b border-dh-border/90 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-dh-muted">
          Add to game table...
        </span>
        <ExternalLink size={12} className="shrink-0 text-dh-muted" aria-hidden title="Opens in a new tab" />
      </div>
      <div className="overflow-y-auto py-1 min-h-0">
      {addToTableMenu.tables.map(t => (
        <a
          key={t.id}
          href={`/table/${encodeURIComponent(t.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          role="option"
          className="group w-full text-left px-3 py-2 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors flex items-center justify-between gap-2 min-w-0 no-underline"
          title={`${t.name || t.id} — opens in a new tab`}
          aria-label={`${t.name?.trim() || 'Untitled table'}, add to this table and open in a new tab`}
          onClick={e => {
            e.stopPropagation();
            addToTableMenu?.onPick?.(t.id);
            setMenuOpen(false);
            setAddedToTable(true);
            setTimeout(() => setAddedToTable(false), 900);
          }}
        >
          <span className="truncate min-w-0">{t.name?.trim() || 'Untitled table'}</span>
          <ExternalLink size={14} className="shrink-0 text-dh-muted group-hover:text-dh" aria-hidden />
        </a>
      ))}
      </div>
    </div>,
    document.body
  );

  const buttons = (
    <>
      {(useTableMenu || onAddToTable) && addButton}
      {tableMenuPortal}
      {onClone && (
        <Tooltip label={cloningStatus || 'Clone to My Library'}>
          <button
            onClick={handleClone}
            disabled={!!cloningStatus}
            aria-label={cloningStatus || 'Clone to My Library'}
            className={`${base} ${cardIconWrap} ${cloneClass} transition-colors disabled:opacity-60`}
          >
            <Copy size={ICON_SIZE} aria-hidden />
          </button>
        </Tooltip>
      )}
      {isOwn && onEdit && (
        <Tooltip label="Edit">
          <button
            onClick={onEdit}
            aria-label="Edit"
            className={`${base} ${cardIconWrap} ${editClass} transition-colors`}
          >
            <Edit size={ICON_SIZE} aria-hidden />
          </button>
        </Tooltip>
      )}
      {isOwn && onDelete && (
        <Tooltip label="Delete">
          <button
            onClick={handleDelete}
            aria-label="Delete"
            className={`${base} ${cardIconWrap} ${deleteClass} transition-colors`}
          >
            <Trash2 size={ICON_SIZE} aria-hidden />
          </button>
        </Tooltip>
      )}
    </>
  );

  const content = (
    <div
      className={`flex items-center shrink-0 ${variant === 'card' ? 'gap-0' : 'gap-1'}`}
    >
      {buttons}
    </div>
  );

  if (stopPropagation) {
    return (
      <div onClick={e => e.stopPropagation()}>
        {content}
      </div>
    );
  }
  return content;
}
