import { useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { ImageGenerator } from '../ImageGenerator.jsx';

/**
 * List-based image editor for item forms. Supports add/remove images via URL,
 * designate primary (art URL), and integrates with AI ImageGenerator.
 *
 * Props:
 *   imageUrl          — primary art URL
 *   _additionalImages — array of extra image URLs
 *   onChange          — ({ imageUrl, _additionalImages }) => void
 *   onImageSaved      — (url, opts?) => void; for AI-generated images
 *   collection        — 'adversaries' | 'environments' | 'scenes' | 'adventures'
 *   formData          — current form data (for ImageGenerator prompt)
 *   inline            — boolean; compact layout for tight forms
 */
export function ImageEditor({ imageUrl, _additionalImages, onChange, onImageSaved, collection, formData, inline = false }) {
  const [addUrl, setAddUrl] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  const additional = Array.isArray(_additionalImages) ? _additionalImages : [];
  const allImages = [imageUrl, ...additional].filter(Boolean);

  const handleChange = (updates) => {
    onChange({
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : imageUrl,
      _additionalImages: updates._additionalImages !== undefined ? updates._additionalImages : additional,
    });
  };

  const handleAddUrl = () => {
    const url = addUrl?.trim();
    if (!url) return;
    if (!imageUrl) {
      handleChange({ imageUrl: url });
    } else {
      handleChange({ _additionalImages: [...additional, url] });
    }
    setAddUrl('');
    setShowAddInput(false);
  };

  const handleRemove = (url) => {
    if (url === imageUrl) {
      handleChange({
        imageUrl: additional[0] || '',
        _additionalImages: additional.slice(1),
      });
    } else {
      handleChange({ _additionalImages: additional.filter(u => u !== url) });
    }
  };

  const handleSetPrimary = (url) => {
    if (url === imageUrl) return;
    handleChange({
      imageUrl: url,
      _additionalImages: [imageUrl, ...additional.filter(u => u !== url)],
    });
  };

  const handleImageGenerated = (url) => {
    if (!imageUrl) {
      handleChange({ imageUrl: url });
    } else {
      handleChange({ _additionalImages: [...additional, url] });
    }
    onImageSaved?.(url, { _additionalImages: !imageUrl ? additional : [...additional, url] });
  };

  const truncateUrl = (url) => {
    if (typeof url !== 'string') return '';
    if (url.startsWith('data:')) return 'data:image/…';
    try {
      const u = new URL(url);
      const path = u.pathname.slice(-40);
      return path.length < u.pathname.length ? '…' + path : url;
    } catch {
      return url.length > 45 ? url.slice(0, 42) + '…' : url;
    }
  };

  const panelClass = inline
    ? 'p-3 border border-slate-800 rounded-lg bg-slate-900/50'
    : 'mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50';

  return (
    <div className={panelClass}>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowAddInput(s => !s)}
          className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-sm rounded px-3 py-2 text-slate-300 hover:text-white outline-none transition-colors"
        >
          <Plus size={14} /> Add image
        </button>
        <ImageGenerator
          formData={formData}
          collection={collection}
          onImageGenerated={handleImageGenerated}
          inline={inline}
        />
      </div>

      {showAddInput && (
        <div className="flex gap-2 mb-3">
          <input
            type="url"
            placeholder="https://... or paste data URL"
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={!addUrl?.trim()}
            className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            Add
          </button>
        </div>
      )}

      {allImages.length > 0 && (
        <div className="space-y-2">
          {allImages.map((url, idx) => {
            const isPrimary = url === imageUrl;
            return (
              <div
                key={url.slice(0, 80) + idx}
                className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0 shrink">
                  <div className="w-10 h-10 rounded overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                    {isPrimary ? 'Primary' : 'Additional'}
                  </span>
                  <span className="text-sm text-slate-300 truncate" title={url}>
                    {truncateUrl(url)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(url)}
                      className="p-1 text-slate-500 hover:text-amber-400"
                      title="Set as primary"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(url)}
                    className="p-1 text-slate-500 hover:text-red-500"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
