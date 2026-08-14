import { Loader2 } from 'lucide-react';
import { LibraryItemDisplayContent } from '../library/LibraryItemDisplayContent.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { MarkdownText } from '../../lib/markdown.js';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { CharacterForm } from '../forms/CharacterForm.jsx';
import { GenericSrdLibraryForm } from '../forms/GenericSrdLibraryForm.jsx';
import { MapImportCameraEditor } from './MapImportCameraEditor.jsx';
/**
 * Library-style review: live preview (left) + controlled form (right), or encounter note editor for notes.
 */
export function UnifiedImportReviewPane({
  selectedRow,
  footerMakePublic,
  importLibraryData,
  libraryBrowseData,
  partySize,
  partyTier,
  onDraftChange,
  mapViewportAspect = 16 / 9,
}) {
  if (!selectedRow) {
    return <p className="text-sm text-dh-muted p-4">Select a slice on the left to preview and edit its import.</p>;
  }

  if (selectedRow.parseError) {
    return <p className="text-sm text-red-400 px-4 py-2">{selectedRow.parseError}</p>;
  }

  if (!selectedRow.draft || !selectedRow.draftCollection) {
    return (
      <div className="flex items-center gap-2 text-sm text-dh-muted p-6">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        Resolving import preview…
      </div>
    );
  }

  const col = selectedRow.draftCollection;
  const draft = { ...selectedRow.draft, is_public: footerMakePublic };
  const replace = (nextDraft) => onDraftChange(selectedRow.id, nextDraft);

  if (col === 'map') {
    const d = selectedRow.draft;
    const extra = Array.isArray(d.mapCameraExtraNorms) ? d.mapCameraExtraNorms : [];
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <p className="text-sm text-dh-muted">This slice adds a battle map. Drag rectangles to create extra camera views (same aspect as your map viewport).</p>
        <MapImportCameraEditor
          mapImageUrl={d.mapImageUrl}
          mapImageNaturalWidth={d.mapImageNaturalWidth}
          mapImageNaturalHeight={d.mapImageNaturalHeight}
          viewportAspect={mapViewportAspect}
          rectsNorm={extra}
          onRectsChange={(next) => replace({ ...d, mapCameraExtraNorms: next })}
        />
        <p className="text-xs text-dh-muted font-mono">
          {d.mapImageNaturalWidth}×{d.mapImageNaturalHeight}px
        </p>
      </div>
    );
  }

  if (col === 'notes') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
        {draft.imageUrl ? (
          <div className="shrink-0 overflow-hidden rounded-lg border border-dh-border bg-dh-inset/40">
            <img src={draft.imageUrl} alt="" className="max-h-40 w-full object-contain object-left" />
          </div>
        ) : null}
        {Array.isArray(draft._additionalImages) && draft._additionalImages.length ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            {draft._additionalImages.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="overflow-hidden rounded-lg border border-dh-border bg-dh-inset/40 max-w-[min(100%,200px)]"
              >
                <img src={url} alt="" className="max-h-36 w-full object-contain object-left" />
              </div>
            ))}
          </div>
        ) : null}
        <label className="block shrink-0">
          <span className="text-xs font-semibold text-dh-muted">Title</span>
          <input
            type="text"
            value={draft.name || ''}
            onChange={(e) => replace({ ...selectedRow.draft, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-dh-strong"
            placeholder="Short label"
          />
        </label>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-semibold text-dh-muted">Body (markdown)</span>
            <MarkdownHelpTooltip />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
            <div className="min-h-[200px] overflow-y-auto rounded-lg border border-dh-border bg-dh-inset/40 p-3">
              <MarkdownText text={draft.body || '—'} className="dh-md text-sm text-dh" />
            </div>
            <textarea
              value={draft.body || ''}
              onChange={(e) => replace({ ...selectedRow.draft, body: e.target.value })}
              className="min-h-[200px] w-full resize-y rounded-lg border border-dh-strong bg-dh-raised p-3 font-mono text-xs text-dh outline-none focus:border-dh-strong"
              placeholder="Note text…"
            />
          </div>
        </div>
      </div>
    );
  }

  const sharedBrowse = libraryBrowseData || {};
  const dup = importLibraryData?.[col] || [];

  const previewPane = (
    <div className="flex flex-col h-full overflow-hidden bg-dh-surface/40">
      <div className="flex-1 overflow-y-auto p-4 relative min-h-0">
        <LibraryItemDisplayContent
          item={draft}
          collection={col}
          data={sharedBrowse}
          partySize={partySize}
          partyTier={partyTier}
          isOwn
          cardKey="import-preview"
          layout="default"
        />
      </div>
    </div>
  );

  const formWrap = (formEl) => (
    <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
      <div className="w-full md:w-[42%] shrink-0 border-b md:border-b-0 md:border-r border-dh-border overflow-hidden flex flex-col min-h-[200px]">
        {previewPane}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto p-4 min-h-[200px]">{formEl}</div>
    </div>
  );

  if (col === 'adversaries') {
    return formWrap(
      <AdversaryForm
        value={draft}
        onChange={(next) => replace(next)}
        featureLibraryPortal={null}
        omitPublicCheckbox
      />,
    );
  }

  if (col === 'environments') {
    return formWrap(
      <EnvironmentForm value={draft} onChange={(next) => replace(next)} featureLibraryPortal={null} omitPublicCheckbox />,
    );
  }

  if (col === 'adventures') {
    return formWrap(
      <AdventureForm value={draft} onChange={(next) => replace(next)} data={sharedBrowse} onMergeAdversary={undefined} omitPublicCheckbox />,
    );
  }

  if (col === 'characters') {
    return formWrap(
      <CharacterForm
        value={draft}
        onChange={(next) => replace(next)}
        levelingToolsSessionKey={String(selectedRow.id)}
      />,
    );
  }

  return formWrap(
    <GenericSrdLibraryForm
      value={draft}
      onChange={(next) => replace(next)}
      collection={col}
      formData={draft}
      existingItems={dup}
    />,
  );
}
