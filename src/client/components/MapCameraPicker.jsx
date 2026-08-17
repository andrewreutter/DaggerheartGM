import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Map as MapIcon, Pencil } from 'lucide-react';
import { normalizeMapArtistFields, normalizeMapName, resolveMapArtistCredit } from '../lib/map-artist.js';
import {
  DEFAULT_MAP_SIZE_FT,
  MAP_SIZE_FT_MAX,
  MAP_SIZE_FT_MIN,
  getMapDimensionsFt,
} from '../lib/map-dimensions-ft.js';
import {
  MAP_CAMERA_PICKER_CAMERAS_TITLE_PX,
  MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX,
  MAP_CAMERA_PICKER_HEADER_PX,
  MAP_CAMERA_PICKER_MAPS_TITLE_PX,
  MAP_CAMERA_PICKER_OVERLAY_PADDING_PX,
  MAP_CAMERA_PICKER_ROW_RULE_PAD_PX,
  MAP_CAMERA_PICKER_ROW_TITLE_GAP_PX,
  MAP_CAMERA_PICKER_ROW_TITLE_PX,
  mapCameraPickerAlignDelta,
  mapCameraPickerMapsColumnWidthRem,
  mapCameraPickerOverlayStyle,
  mapCameraPickerRibbonWidthRem,
  mapCameraPickerSectionGapRem,
} from '../lib/map-camera-picker.js';

function HeaderTitle({ Icon, label, fontSizePx, onAdd }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold leading-none text-dh-muted"
      style={{ fontSize: fontSizePx }}
    >
      <Icon size={fontSizePx} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span>{label}</span>
      {typeof onAdd === 'function' ? (
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 rounded border px-1.5 py-0.5 font-semibold leading-none text-violet-300/90 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35"
          style={{ fontSize: fontSizePx }}
          data-testid={label === 'Maps' ? 'map-camera-picker-add-map' : 'map-camera-picker-add-camera'}
        >
          + Add
        </button>
      ) : null}
    </div>
  );
}

const FIELD_CLASS =
  'h-[1.125rem] w-full min-w-0 rounded border border-dh-border/70 bg-dh-raised/80 px-1 text-[10px] leading-none text-dh outline-none placeholder:text-dh-muted/70 focus:border-sky-500/60 disabled:cursor-not-allowed disabled:opacity-50';

function useDraft(value) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);
  return [draft, setDraft];
}

export function MapCameraViewTitle({
  value,
  onCommit,
  disabled,
  align = 'center',
  ariaLabel = 'Camera name',
  size = 'sm',
  className = '',
}) {
  const [draft, setDraft] = useDraft(value || '');
  const commit = () => {
    const next = String(draft ?? '').trim();
    if (!next || next === (value || '')) {
      setDraft(value || '');
      return;
    }
    onCommit(next);
  };
  const alignClass = align === 'left' ? 'text-left' : 'text-center';
  const sizeClass = size === 'md' ? 'text-xs leading-tight font-medium' : 'text-[10px] leading-tight';
  if (disabled) {
    return (
      <span className={`block truncate text-dh-muted ${sizeClass} ${alignClass} ${className}`} title={value}>
        {value}
      </span>
    );
  }
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value || '');
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full bg-transparent text-dh outline-none border-b border-transparent focus:border-sky-500/60 ${sizeClass} ${alignClass} ${className}`}
    />
  );
}

function MapPickerSizeFields({ map, canEdit, onSizeChange, onFocusChange }) {
  const mapSizeFt = map?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT;
  const mapDimension = map?.mapDimension === 'height' ? 'height' : 'width';
  const [sizeInput, setSizeInput] = useDraft(String(mapSizeFt));
  const { mapWidthFt, mapHeightFt } = getMapDimensionsFt(map);
  const wxh = `${Math.round(mapWidthFt)}' × ${Math.round(mapHeightFt)}'`;

  const commitSize = () => {
    const v = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, parseInt(sizeInput, 10) || DEFAULT_MAP_SIZE_FT));
    setSizeInput(String(v));
    if (v !== mapSizeFt) onSizeChange?.({ mapSizeFt: v });
  };

  if (!canEdit) {
    return (
      <div className="text-[9px] leading-tight text-dh-muted italic" title={wxh}>
        {wxh}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-0.5 min-w-0">
        <span className="w-7 shrink-0 text-[9px] leading-none text-dh-muted">Size</span>
        <button
          type="button"
          className={`px-1 py-0.5 rounded text-[9px] leading-none transition-colors ${
            mapDimension === 'width' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'
          }`}
          onClick={() => onSizeChange?.({ mapDimension: 'width' })}
        >
          W
        </button>
        <button
          type="button"
          className={`px-1 py-0.5 rounded text-[9px] leading-none transition-colors ${
            mapDimension === 'height' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'
          }`}
          onClick={() => onSizeChange?.({ mapDimension: 'height' })}
        >
          H
        </button>
        <input
          type="number"
          min={MAP_SIZE_FT_MIN}
          max={MAP_SIZE_FT_MAX}
          aria-label="Map size in feet"
          value={sizeInput}
          onChange={(e) => setSizeInput(e.target.value)}
          onFocus={() => onFocusChange?.(1)}
          onBlur={() => {
            onFocusChange?.(-1);
            commitSize();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className={`${FIELD_CLASS} w-10 text-right`}
        />
        <span className="text-[9px] leading-none text-dh-muted">ft</span>
      </div>
      <div className="pl-7 text-[9px] leading-tight text-dh-muted italic">{wxh}</div>
    </div>
  );
}

function MapPickerMetaFields({ map, canEdit, onCommitArtist, onSizeChange, onFocusChange }) {
  const artistValue = map?.artist || '';
  const urlValue = map?.artistUrl || '';
  const [artist, setArtist] = useDraft(artistValue);
  const [artistUrl, setArtistUrl] = useDraft(urlValue);
  const credit = resolveMapArtistCredit(map);

  const commit = () => {
    const fields = normalizeMapArtistFields(artist, artistUrl);
    setArtist(fields.artist);
    setArtistUrl(fields.artistUrl);
    if (fields.artist === (artistValue || '').trim() && fields.artistUrl === (urlValue || '').trim()) {
      return;
    }
    onCommitArtist(fields);
  };

  const fieldFocus = {
    onFocus: () => onFocusChange?.(1),
    onBlur: () => {
      onFocusChange?.(-1);
      commit();
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
  };

  if (!canEdit) {
    return (
      <div className="flex w-[8.5rem] shrink-0 flex-col justify-start gap-0.5 self-start min-w-0">
        <MapPickerSizeFields map={map} canEdit={false} />
        {credit ? (
          credit.href ? (
            <a
              href={credit.href}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[9px] leading-tight text-sky-400/90 hover:text-sky-300"
              title={`Map by ${credit.artist}`}
              onClick={(e) => e.stopPropagation()}
            >
              {credit.artist}
            </a>
          ) : (
            <div className="truncate text-[9px] leading-tight text-dh-muted" title={credit.artist}>
              {credit.artist}
            </div>
          )
        ) : null}
      </div>
    );
  }

  const artistPopulated = !!String(artist).trim();

  return (
    <div className="flex w-[8.5rem] shrink-0 flex-col justify-start gap-0.5 self-start min-w-0">
      <MapPickerSizeFields
        map={map}
        canEdit
        onSizeChange={onSizeChange}
        onFocusChange={onFocusChange}
      />
      <label className="flex items-center gap-1 min-w-0">
        <span className="w-7 shrink-0 text-[9px] leading-none text-dh-muted">Artist</span>
        <input
          type="text"
          aria-label="Map artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Optional"
          className={FIELD_CLASS}
          {...fieldFocus}
        />
      </label>
      <label className="flex items-center gap-1 min-w-0">
        <span className="w-7 shrink-0 text-[9px] leading-none text-dh-muted">URL</span>
        <input
          type="text"
          inputMode="url"
          autoComplete="url"
          aria-label="Map artist URL"
          value={artistUrl}
          disabled={!artistPopulated}
          onChange={(e) => setArtistUrl(e.target.value)}
          placeholder={artistPopulated ? 'https://…' : 'Artist first'}
          className={FIELD_CLASS}
          {...fieldFocus}
        />
      </label>
    </div>
  );
}

/**
 * Current-camera chip (aligned with the Zoom title) + hover overlay of every map row.
 * Overlay is portaled so `position: fixed` stays viewport-relative.
 */
export const MapCameraPicker = forwardRef(function MapCameraPicker(
  {
    show = false,
    isTouch = false,
    canEdit = false,
    trigger,
    rows = [],
    alignTo = 'camera',
    onRenameMap,
    onRenameMapView,
    onMapSizeChange,
    onAddMap,
    onEditMap,
    onAddCamera,
    onOpenChange,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [alignDelta, setAlignDelta] = useState({ x: 0, y: 0 });
  const triggerWrapRef = useRef(null);
  const overlayRef = useRef(null);
  const firstTileRef = useRef(null);
  const focusedCountRef = useRef(0);
  const pointerInsideRef = useRef(false);
  const hideTimerRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;

  const measureTrigger = useCallback(() => {
    const el = triggerWrapRef.current;
    if (!el) return;
    setTriggerRect(el.getBoundingClientRect());
  }, []);

  const forceClose = useCallback(() => {
    focusedCountRef.current = 0;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setOpen(false);
  }, []);

  const closeIfIdle = useCallback(() => {
    if (focusedCountRef.current > 0) return;
    forceClose();
  }, [forceClose]);

  const scheduleClose = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      closeIfIdle();
    }, 150);
  }, [closeIfIdle]);

  const cancelClose = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const markPointerInside = useCallback(() => {
    pointerInsideRef.current = true;
    cancelClose();
  }, [cancelClose]);

  const markPointerLeft = useCallback(() => {
    pointerInsideRef.current = false;
    if (!isTouch) scheduleClose();
  }, [isTouch, scheduleClose]);

  const openPicker = useCallback(() => {
    pointerInsideRef.current = true;
    cancelClose();
    setAlignDelta({ x: 0, y: 0 });
    measureTrigger();
    setOpen(true);
  }, [cancelClose, measureTrigger]);

  useImperativeHandle(ref, () => ({ close: forceClose, isOpen: open }), [forceClose, open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    measureTrigger();
    const align = () => {
      measureTrigger();
      const triggerEl = triggerWrapRef.current;
      const firstEl = firstTileRef.current;
      if (!triggerEl || !firstEl) return;
      const next = mapCameraPickerAlignDelta(triggerEl.getBoundingClientRect(), firstEl.getBoundingClientRect());
      if (next.x === 0 && next.y === 0) return;
      setAlignDelta((prev) => ({ x: prev.x + next.x, y: prev.y + next.y }));
    };
    align();
    const onWin = () => {
      setAlignDelta({ x: 0, y: 0 });
      measureTrigger();
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, measureTrigger, triggerRect?.left, triggerRect?.top]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      forceClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, forceClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const t = e.target;
      if (overlayRef.current?.contains(t)) return;
      if (triggerWrapRef.current?.contains(t)) return;
      forceClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, forceClose]);

  const onFocusChange = useCallback((delta) => {
    focusedCountRef.current = Math.max(0, focusedCountRef.current + delta);
    if (delta > 0) cancelClose();
    else if (focusedCountRef.current === 0 && !pointerInsideRef.current) scheduleClose();
  }, [cancelClose, scheduleClose]);

  if (!show || !trigger) return null;

  const overlayStyle = open
    ? mapCameraPickerOverlayStyle(triggerRect, {
        alignDelta,
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
      })
    : null;

  const overlay = open && overlayStyle && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={overlayRef}
          role="dialog"
          aria-label="Maps and cameras"
          data-testid="map-camera-picker-overlay"
          className="fixed z-[53] max-h-[min(70vh,calc(100dvh-1rem))] max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border border-dh-border bg-dh-canvas/95 shadow-xl"
          style={{
            ...overlayStyle,
            padding: MAP_CAMERA_PICKER_OVERLAY_PADDING_PX,
          }}
          onMouseEnter={markPointerInside}
          onMouseLeave={isTouch ? undefined : markPointerLeft}
        >
          <div className="flex flex-col">
            <div
              className="flex shrink-0 items-center font-semibold leading-none text-dh-muted"
              style={{
                height: MAP_CAMERA_PICKER_HEADER_PX,
                marginBottom: MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX,
                gap: mapCameraPickerSectionGapRem(),
              }}
            >
              <div className="flex shrink-0 items-end" style={{ width: mapCameraPickerMapsColumnWidthRem() }}>
                <HeaderTitle Icon={MapIcon} label="Maps" fontSizePx={MAP_CAMERA_PICKER_MAPS_TITLE_PX} onAdd={onAddMap} />
              </div>
              <div className="flex shrink-0 justify-end">
                <div
                  className="flex items-end"
                  style={{ minWidth: mapCameraPickerRibbonWidthRem(Math.max(0, ...rows.map((r) => (r.cameras || []).length))) }}
                >
                  <HeaderTitle Icon={Camera} label="Cameras" fontSizePx={MAP_CAMERA_PICKER_CAMERAS_TITLE_PX} onAdd={onAddCamera} />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((row, idx) => {
                const cameras = row.cameras || [];
                const alignLastCamera = idx === 0 && alignTo !== 'map' && cameras.length > 0;
                const alignMapTile = idx === 0 && !alignLastCamera;
                const mapName = row.map?.name || 'Map';
                return (
                  <div
                    key={row.key}
                    className="flex min-w-0 flex-col border-t border-dh-border"
                    style={{ paddingTop: MAP_CAMERA_PICKER_ROW_RULE_PAD_PX }}
                  >
                    <div
                      className="flex items-end min-w-0"
                      style={{
                        height: MAP_CAMERA_PICKER_ROW_TITLE_PX,
                        marginBottom: MAP_CAMERA_PICKER_ROW_TITLE_GAP_PX,
                        gap: mapCameraPickerSectionGapRem(),
                      }}
                    >
                      <div className="shrink-0 min-w-0" style={{ width: mapCameraPickerMapsColumnWidthRem() }}>
                        <MapCameraViewTitle
                          value={mapName}
                          align="left"
                          ariaLabel="Map name"
                          size="md"
                          disabled={!canEdit || typeof onRenameMap !== 'function'}
                          onCommit={(name) => {
                            const next = normalizeMapName(name);
                            if (!next) return;
                            onRenameMap?.(row.map.id, next, {
                              artist: row.map.artist,
                              artistUrl: row.map.artistUrl,
                            });
                          }}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 items-end justify-end gap-1.5">
                        {cameras.map((cam) => (
                          <div
                            key={`${cam.key}-title`}
                            className="w-[4.75rem] shrink-0"
                            onFocusCapture={() => onFocusChange(1)}
                            onBlurCapture={() => onFocusChange(-1)}
                          >
                            <MapCameraViewTitle
                              value={cam.view?.name || 'View'}
                              disabled={!canEdit || typeof onRenameMapView !== 'function'}
                              onCommit={(name) => onRenameMapView?.(cam.view.id, name)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start min-w-0" style={{ gap: mapCameraPickerSectionGapRem() }}>
                      <div
                        className="flex shrink-0 items-start gap-1.5"
                        style={{ width: mapCameraPickerMapsColumnWidthRem() }}
                      >
                        <div ref={alignMapTile ? firstTileRef : undefined} className="shrink-0">
                          {row.mapTile}
                        </div>
                        <MapPickerMetaFields
                          map={row.map}
                          canEdit={canEdit && typeof onRenameMap === 'function'}
                          onCommitArtist={(fields) => onRenameMap?.(row.map.id, row.map.name, fields)}
                          onSizeChange={(patch) => onMapSizeChange?.(row.map, patch)}
                          onFocusChange={onFocusChange}
                        />
                        {canEdit && typeof onEditMap === 'function' && row.map?.libraryMapId && (
                          <button
                            type="button"
                            title="Edit map"
                            aria-label="Edit map"
                            className="shrink-0 p-1 rounded text-dh-muted hover:text-dh hover:bg-dh-hover"
                            onClick={() => onEditMap(row.map)}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 items-start justify-end gap-1.5">
                        {cameras.map((cam, camIdx) => (
                          <div
                            key={cam.key}
                            ref={alignLastCamera && camIdx === cameras.length - 1 ? firstTileRef : undefined}
                          >
                            {cam.tile}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={triggerWrapRef}
        data-testid="map-camera-picker-trigger"
        className={`pointer-events-auto ${open ? 'invisible' : ''}`}
        onMouseEnter={isTouch ? undefined : openPicker}
        onMouseLeave={isTouch ? undefined : markPointerLeft}
        onClick={isTouch ? () => (openRef.current ? forceClose() : openPicker()) : undefined}
      >
        {trigger}
      </div>
      {overlay}
    </>
  );
});
