import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Map as MapIcon } from 'lucide-react';
import { normalizeMapArtistFields, normalizeMapName } from '../../lib/map-artist.js';

/**
 * Edit a map's display name and optional artist credit.
 * @param {boolean} props.open
 * @param {string} [props.initialName]
 * @param {string} [props.initialArtist]
 * @param {string} [props.initialArtistUrl]
 * @param {() => void} props.onClose
 * @param {(payload: { name: string, artist: string, artistUrl: string }) => void} props.onSave
 */
export function MapDetailsDialog({
  open,
  initialName = '',
  initialArtist = '',
  initialArtistUrl = '',
  onClose,
  onSave,
}) {
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [artistUrl, setArtistUrl] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(String(initialName ?? ''));
    setArtist(String(initialArtist ?? ''));
    setArtistUrl(String(initialArtistUrl ?? ''));
    const id = window.setTimeout(() => {
      const el = nameRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open, initialName, initialArtist, initialArtistUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const nameOk = !!normalizeMapName(name);
  const artistPopulated = !!String(artist).trim();

  const handleSave = () => {
    const nextName = normalizeMapName(name);
    if (!nextName) return;
    onSave({ name: nextName, ...normalizeMapArtistFields(artist, artistUrl) });
    onClose();
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-details-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-dh-border bg-dh-canvas shadow-xl p-4 text-dh"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <MapIcon size={16} className="text-sky-400/90 shrink-0" aria-hidden />
          <h2 id="map-details-title" className="text-sm font-semibold">
            Edit map
          </h2>
        </div>
        <label className="block">
          <span className="text-[10px] font-medium text-dh-muted">Name</span>
          <input
            ref={nameRef}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-sky-500/60"
            placeholder="Map"
          />
        </label>
        <label className="block mt-3">
          <span className="text-[10px] font-medium text-dh-muted">Artist</span>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-sky-500/60"
            placeholder="Optional"
          />
        </label>
        <label className="block mt-3">
          <span className="text-[10px] font-medium text-dh-muted">Artist URL</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={artistUrl}
            disabled={!artistPopulated}
            onChange={(e) => setArtistUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-sky-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={artistPopulated ? 'https://…' : 'Add an artist first'}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dh-border text-dh-muted hover:bg-dh-hover/50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!nameOk}
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-700/80 hover:bg-sky-600 text-white border border-sky-600/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sky-700/80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
