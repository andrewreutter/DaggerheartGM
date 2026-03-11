import { useState } from 'react';
import { Edit, Trash2, Play, Copy } from 'lucide-react';
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
  const addClass = variant === 'header'
    ? `text-slate-500 hover:text-white hover:bg-slate-800`
    : 'text-slate-400 hover:text-white';
  const cloneClass = variant === 'header'
    ? 'text-slate-500 hover:text-violet-400 hover:bg-slate-800'
    : 'text-slate-400 hover:text-violet-400';
  const editClass = variant === 'header'
    ? 'text-slate-500 hover:text-blue-400 hover:bg-slate-800'
    : 'text-slate-400 hover:text-blue-400';
  const deleteClass = variant === 'header'
    ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800'
    : 'text-slate-400 hover:text-red-400';

  const buttons = (
    <>
      {onAddToTable && (
        <Tooltip label="Add to Game Table">
          <button
            onClick={handleAddToTable}
            aria-label="Add to Game Table"
            className={`${base} transition-colors duration-150 ${addedToTable ? 'text-yellow-400' : addClass}`}
          >
            <Play size={ICON_SIZE} aria-hidden />
          </button>
        </Tooltip>
      )}
      {onClone && (
        <Tooltip label={cloningStatus || 'Clone to My Library'}>
          <button
            onClick={handleClone}
            disabled={!!cloningStatus}
            aria-label={cloningStatus || 'Clone to My Library'}
            className={`${base} ${cloneClass} transition-colors disabled:opacity-60`}
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
            className={`${base} ${editClass} transition-colors`}
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
            className={`${base} ${deleteClass} transition-colors`}
          >
            <Trash2 size={ICON_SIZE} aria-hidden />
          </button>
        </Tooltip>
      )}
    </>
  );

  const content = (
    <div className={`flex items-center gap-1 ${variant === 'card' ? '' : 'shrink-0'}`}>
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

