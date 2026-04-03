import { Check, Undo2, Redo2 } from 'lucide-react';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import { LevelBadge } from './LevelBadge.jsx';
import { CharacterIdentitySourceBadges } from './CharacterDisplay.jsx';
import { useCharacterSheetSourceBadgeHover } from './CharacterSheetSourceHighlight.jsx';
import { SOURCE_BADGE } from '../lib/constants.js';
import { V2SourceInspectButton } from './V2SourceInspectButton.jsx';
import {
  CHARACTER_TABLE_EDITOR_DRAWER_WIDTH,
  CHARACTER_TABLE_SHEET_COLUMN_WIDTH,
} from '../lib/character-table-layout.js';

/**
 * Full-width title strip above the Game Table pinned character sheet + editor columns.
 * Neutral surface (matches card chrome, not magic/violet strip). When the editor is open,
 * undo/redo sit in the segment aligned with the editor column width below.
 */
export function GameTableCharacterSheetTitleBar({
  el,
  item,
  editDrawerOpen,
  onEdit,
  onDone,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isSaving = false,
  showUnsavedDirtyHint = false,
  userHasInteractedWithEditor = false,
  savedFlash = false,
  v2LibrarySourcePath = null,
  showIncomplete = true,
  /** Matches the sheet column width in GMTableView. */
  sheetColumnWidth = CHARACTER_TABLE_SHEET_COLUMN_WIDTH,
  /** Matches the editor drawer width. */
  editorColumnWidth = CHARACTER_TABLE_EDITOR_DRAWER_WIDTH,
  /** When true, Done is disabled (e.g. character AI build in flight). */
  doneDisabled = false,
  /** Current slider value (1…maxLevelForPreview); only used when edit drawer open and max > 1 */
  levelPreview = 1,
  onLevelPreviewChange,
  /** Saved character level from the editor (slider max). */
  maxLevelForPreview = 1,
}) {
  const nm = el?.name || 'Unnamed Character';
  const badge = item?._source ? (SOURCE_BADGE[item._source] ?? SOURCE_BADGE.own) : null;
  const maxLv = Math.max(1, Math.floor(Number(maxLevelForPreview) || 1));
  const showLevelSlider = editDrawerOpen && maxLv > 1 && typeof onLevelPreviewChange === 'function';
  const sliderVal = Math.min(Math.max(1, Math.floor(Number(levelPreview) || 1)), maxLv);
  const sliderIsPreview = showLevelSlider && sliderVal < maxLv;

  const saveStatus = (() => {
    if (!editDrawerOpen) return null;
    if (isSaving) {
      return <span className="text-xs shrink-0 text-dh-muted">Saving…</span>;
    }
    if (showUnsavedDirtyHint && userHasInteractedWithEditor) {
      return <span className="text-xs text-amber-400/90 shrink-0">Unsaved changes…</span>;
    }
    if (savedFlash) {
      return (
        <span className="text-xs text-emerald-400/90 shrink-0 inline-flex items-center gap-1">
          <Check size={14} className="shrink-0" aria-hidden />
          Saved
        </span>
      );
    }
    return null;
  })();

  const libraryBadgeHover = useCharacterSheetSourceBadgeHover();

  const undoRedo =
    editDrawerOpen && onUndo && onRedo ? (
      <>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Redo2 size={14} />
        </button>
      </>
    ) : null;

  return (
    <div className="flex flex-row items-stretch border-b border-dh-border bg-dh-canvas/20 shrink-0 min-w-0">
      <div
        className={`flex items-center gap-2 min-w-0 px-3 py-2.5 ${editDrawerOpen ? 'border-r border-dh-border/50 shrink-0' : 'flex-1'}`}
        style={editDrawerOpen ? { width: sheetColumnWidth, minWidth: 0 } : undefined}
      >
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          <TierShieldBadge tier={el?.tier ?? 1} scaledFromTier={el?._scaledFromTier} size="md" />
          {el?.level != null && <LevelBadge level={el.level} size="md" />}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <span
            className="text-lg font-bold text-dh leading-tight min-w-0 max-w-[min(100%,28rem)] truncate"
            title={nm}
          >
            {nm}
          </span>
          <CharacterIdentitySourceBadges el={el} showIncomplete={showIncomplete}>
            {badge && (
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.className}`}
                title="Library source"
                {...libraryBadgeHover('library')}
              >
                {badge.label}
              </span>
            )}
          </CharacterIdentitySourceBadges>
        </div>
      </div>

      {editDrawerOpen && (
        <div
          className="flex items-center justify-between gap-3 min-w-0 px-3 py-2.5 border-l border-dh-border/50 shrink-0"
          style={{ width: editorColumnWidth }}
        >
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {undoRedo}
            {showLevelSlider ? (
              <label
                className="flex flex-row items-center gap-2 flex-1 min-w-0 max-w-[min(100%,18rem)] text-dh-muted"
                title="Preview the sheet and editor at a past level (read-only). Slide back to current level to edit."
              >
                <span className="flex flex-col gap-0.5 shrink-0 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-dh leading-none whitespace-nowrap">
                    Level view
                  </span>
                  {/* Fixed slot so “preview” does not shift layout when toggling */}
                  <span className="text-xs tabular-nums font-semibold leading-tight whitespace-nowrap min-h-[1.125rem]">
                    {sliderVal} / {maxLv}
                    <span
                      className={`font-medium ${sliderIsPreview ? 'text-red-400/90' : 'text-transparent select-none'}`}
                      aria-hidden={!sliderIsPreview}
                    >
                      {' '}
                      · preview
                    </span>
                  </span>
                </span>
                <span className="inline-flex min-w-0 max-w-[14rem] flex-1 items-center sm:min-w-[10rem]">
                  <input
                    type="range"
                    min={1}
                    max={maxLv}
                    step={1}
                    value={sliderVal}
                    onChange={(e) => onLevelPreviewChange(Number(e.target.value))}
                    className={`relative top-0.5 h-1.5 w-full min-w-[6rem] cursor-pointer appearance-none rounded-full bg-dh-hover ${
                      sliderIsPreview ? 'accent-red-500' : 'accent-cyan-500'
                    }`}
                    aria-valuemin={1}
                    aria-valuemax={maxLv}
                    aria-valuenow={sliderVal}
                    aria-label={`Level preview ${sliderVal} of ${maxLv}`}
                  />
                </span>
              </label>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-0">
            {saveStatus}
            {v2LibrarySourcePath ? <V2SourceInspectButton relativePath={v2LibrarySourcePath} variant="header" /> : null}
            <button
              type="button"
              onClick={onDone}
              disabled={doneDisabled}
              title={doneDisabled ? 'Cancel AI build or wait to close' : undefined}
              className="text-xs font-medium text-dh px-2 py-1 rounded-md border border-dh-strong/40 hover:bg-dh-raised/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {!editDrawerOpen && (
        <div className="flex justify-end items-center gap-1.5 px-3 py-2.5 shrink-0 min-w-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-medium text-dh px-2 py-1 rounded-md border border-dh-strong/40 hover:bg-dh-raised/50 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
