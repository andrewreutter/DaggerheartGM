import { useEffect, useRef, useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { ImageEditor } from './ImageEditor.jsx';
import { MapTableEditor } from './MapTableEditor.jsx';
import { MapAiImageBuilderPanel } from '../MapAiImageBuilderPanel.jsx';
import {
  DEFAULT_MAP_SIZE_FT,
  MAP_SIZE_FT_MAX,
  MAP_SIZE_FT_MIN,
  getMapDimensionsFt,
} from '../../lib/map-dimensions-ft.js';
import {
  editorSliceToLibraryMap,
  libraryMapImageUrl,
  libraryMapToEditorSlice,
  persistLibraryMap,
} from '../../lib/map-library.js';
import { imageGenEnabled } from '../../lib/api.js';
import { useAiUiPreference } from '../../lib/ai-ui-preference-context.jsx';
import { shouldShowImageGenAiUi } from '../../lib/ai-ui-visibility.js';

function MapSizeFields({ fd, onPatch }) {
  const mapSizeFt = fd.mapSizeFt ?? DEFAULT_MAP_SIZE_FT;
  const mapDimension = fd.mapDimension === 'height' ? 'height' : 'width';
  const { mapWidthFt, mapHeightFt } = getMapDimensionsFt(fd);
  const wxh = `${Math.round(mapWidthFt)}' × ${Math.round(mapHeightFt)}'`;
  return (
    <FormRow label="Size">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`px-2 py-1 rounded text-xs ${
            mapDimension === 'width' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'
          }`}
          onClick={() => onPatch({ mapDimension: 'width' })}
        >
          Width
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded text-xs ${
            mapDimension === 'height' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'
          }`}
          onClick={() => onPatch({ mapDimension: 'height' })}
        >
          Height
        </button>
        <input
          type="number"
          min={MAP_SIZE_FT_MIN}
          max={MAP_SIZE_FT_MAX}
          aria-label="Map size in feet"
          value={mapSizeFt}
          onChange={(e) => {
            const v = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, parseInt(e.target.value, 10) || DEFAULT_MAP_SIZE_FT));
            onPatch({ mapSizeFt: v });
          }}
          className="bg-dh-inset border border-dh-border rounded p-1.5 text-dh w-24"
        />
        <span className="text-xs text-dh-muted">{wxh}</span>
      </div>
    </FormRow>
  );
}

/**
 * Details + Map editor for `collection: 'maps'`.
 * Controlled: `value` + `onChange`. Uncontrolled: `initial` + `onSave`.
 */
export function MapForm({
  initial,
  value,
  onChange,
  onSave,
  onImageSaved,
  omitPublicCheckbox = false,
}) {
  const isControlled = value !== undefined;
  const [localData, setLocalData] = useState(() => persistLibraryMap(initial || {}));
  const [activeTab, setActiveTab] = useState(() => (
    (isControlled ? value : initial)?.name || libraryMapImageUrl(isControlled ? value : initial)
      ? 'map'
      : 'details'
  ));
  const { hideAiUi } = useAiUiPreference();
  const showAi = shouldShowImageGenAiUi(imageGenEnabled, hideAiUi);

  const fd = persistLibraryMap(isControlled ? (value || {}) : localData);
  const latestFdRef = useRef(fd);
  latestFdRef.current = fd;

  const emit = (next) => {
    const stamped = persistLibraryMap({ ...latestFdRef.current, ...next });
    latestFdRef.current = stamped;
    if (isControlled) onChange(stamped);
    else setLocalData(stamped);
  };

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    emit(fd);
    // Seed once so new maps persist the empty library shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (field, val) => emit({ [field]: val });

  const tabBtnClass = (tab) =>
    `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-red-500 text-dh'
        : 'border-transparent text-dh-muted hover:text-dh'
    }`;

  const editorSlice = libraryMapToEditorSlice(fd);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div className="shrink-0 flex items-center gap-1 border-b border-dh-border mb-3" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'details'} className={tabBtnClass('details')} onClick={() => setActiveTab('details')}>
          Details
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'map'} className={tabBtnClass('map')} onClick={() => setActiveTab('map')}>
          Map
        </button>
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'details' ? '' : 'invisible absolute pointer-events-none h-0 overflow-hidden'}`}>
        <FormRow label="Name">
          <input
            type="text"
            value={fd.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full"
            data-testid="map-form-name"
          />
        </FormRow>
        <FormRow label="Artist">
          <input
            type="text"
            value={fd.artist || ''}
            onChange={(e) => updateField('artist', e.target.value)}
            className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full"
          />
        </FormRow>
        <FormRow label="Artist URL">
          <input
            type="url"
            value={fd.artistUrl || ''}
            onChange={(e) => updateField('artistUrl', e.target.value)}
            className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full"
          />
        </FormRow>
        <MapSizeFields fd={fd} onPatch={(patch) => emit(patch)} />
        <FormRow label="Map art (optional)">
          <ImageEditor
            imageUrl={libraryMapImageUrl(fd)}
            _additionalImages={fd._additionalImages}
            onChange={({ imageUrl, _additionalImages }) => emit({
              imageUrl,
              mapImageUrl: imageUrl,
              _additionalImages,
            })}
            onImageSaved={onImageSaved}
            collection="maps"
            formData={fd}
            inline
          />
        </FormRow>
        {showAi && (
          <FormRow label="Generate with AI">
            <MapAiImageBuilderPanel
              mapSizeFt={fd.mapSizeFt}
              mapDimension={fd.mapDimension}
              mapImageNaturalWidth={fd.mapImageNaturalWidth}
              mapImageNaturalHeight={fd.mapImageNaturalHeight}
              mapImageUrl={libraryMapImageUrl(fd)}
              savedMapAiImagePrompt={fd.mapAiImagePrompt}
              compact
              showCancel={false}
              onMapConfigChange={(patch) => emit({
                ...patch,
                imageUrl: patch.mapImageUrl ?? fd.imageUrl,
              })}
            />
          </FormRow>
        )}
        {!omitPublicCheckbox && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted mb-4">
            <input
              type="checkbox"
              checked={!!fd.is_public}
              onChange={(e) => updateField('is_public', e.target.checked)}
              className="accent-blue-500"
              data-testid="map-form-public"
            />
            Make Public
          </label>
        )}
        {onSave && !isControlled && (
          <button type="button" onClick={() => onSave(fd)} className="px-3 py-1.5 rounded bg-sky-800 text-white text-sm">
            Save
          </button>
        )}
      </div>
      <div className={`flex-1 min-h-0 min-w-0 flex ${activeTab === 'map' ? '' : 'invisible absolute pointer-events-none'}`}>
        <MapTableEditor
          value={editorSlice}
          onChange={(tableSlice) => emit(editorSliceToLibraryMap(tableSlice, latestFdRef.current))}
        />
      </div>
    </div>
  );
}
