import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FormRow } from './FormRow.jsx';
import { ImageEditor } from './ImageEditor.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { getLibraryFilterConfig } from '../../lib/library-filter-config.js';
import { TIERS } from '../../lib/constants.js';

const ABILITY_LEVEL_MIN = 1;
const ABILITY_LEVEL_MAX = 9;

/**
 * Fallback editor for SRD library items without a dedicated form (weapons, abilities, etc.).
 * Controlled: `value` + `onChange`.
 */
export function GenericSrdLibraryForm({
  value,
  onChange,
  collection,
  onImageSaved,
  formData,
}) {
  const cfg = getLibraryFilterConfig(collection);
  const data = value;
  const update = useCallback((patch) => {
    onChange({ ...data, ...patch });
  }, [data, onChange]);

  const jsonRef = useRef(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (jsonRef.current === document.activeElement) return;
    setJsonText(JSON.stringify(data, null, 2));
    setJsonError('');
  }, [data]);

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Root must be a JSON object');
      }
      const id = data.id ?? parsed.id;
      onChange(id != null ? { ...parsed, id } : parsed);
      setJsonError('');
    } catch (e) {
      setJsonError(e?.message || 'Invalid JSON');
    }
  };

  const tierMax = TIERS?.length ? Math.max(...TIERS) : 4;

  return (
    <div className="space-y-4">
      <FormRow label="Name">
        <input
          type="text"
          value={data.name ?? ''}
          onChange={(e) => update({ name: e.target.value })}
          className="w-full bg-dh-inset border border-dh-border rounded p-2 text-dh"
          placeholder="Name"
        />
      </FormRow>

      <FormRow
        label={
          <span className="inline-flex items-center gap-1">
            Description
            <MarkdownHelpTooltip />
          </span>
        }
      >
        <textarea
          value={data.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
          rows={6}
          className="w-full bg-dh-inset border border-dh-border rounded p-2 text-dh text-sm min-h-[120px]"
          placeholder="Markdown supported"
        />
      </FormRow>

      {cfg.rankMode === 'tier' && (
        <FormRow label="Tier">
          <input
            type="number"
            min={1}
            max={tierMax}
            value={data.tier ?? 1}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              update({ tier: Number.isFinite(n) ? Math.min(tierMax, Math.max(1, n)) : 1 });
            }}
            className="w-28 bg-dh-inset border border-dh-border rounded p-2 text-dh"
          />
        </FormRow>
      )}

      {cfg.rankMode === 'level' && (
        <FormRow label="Level">
          <input
            type="number"
            min={ABILITY_LEVEL_MIN}
            max={ABILITY_LEVEL_MAX}
            value={data.level ?? 1}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              update({
                level: Number.isFinite(n)
                  ? Math.min(ABILITY_LEVEL_MAX, Math.max(ABILITY_LEVEL_MIN, n))
                  : 1,
              });
            }}
            className="w-28 bg-dh-inset border border-dh-border rounded p-2 text-dh"
          />
        </FormRow>
      )}

      <FormRow label="Images">
        <ImageEditor
          imageUrl={data.imageUrl}
          _additionalImages={data._additionalImages}
          onChange={({ imageUrl, _additionalImages }) => update({ imageUrl, _additionalImages })}
          onImageSaved={onImageSaved}
          collection={collection}
          formData={formData ?? data}
          inline
        />
      </FormRow>

      <div className="border border-dh-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setJsonOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-dh bg-dh-raised/80 hover:bg-dh-hover"
        >
          {jsonOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          All fields (JSON)
        </button>
        {jsonOpen && (
          <div className="p-3 border-t border-dh-border space-y-2">
            <p className="text-xs text-dh-muted">
              Edit the full item as JSON. Apply merges into the form above. Invalid JSON is not saved.
            </p>
            <textarea
              ref={jsonRef}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError('');
              }}
              onBlur={applyJson}
              rows={16}
              spellCheck={false}
              className="w-full font-mono text-xs bg-dh-inset border border-dh-border rounded p-2 text-dh"
            />
            {jsonError ? (
              <p className="text-xs text-red-400">{jsonError}</p>
            ) : null}
            <button
              type="button"
              onClick={applyJson}
              className="text-xs px-3 py-1.5 rounded bg-dh-hover hover:bg-dh-hover text-dh"
            >
              Apply JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
