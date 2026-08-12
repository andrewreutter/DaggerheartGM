import { Swords } from 'lucide-react';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { omitShapeId, getBoundObject, setBoundObject } from '../lib/json-schema-dh.js';
import { generateId } from '../lib/helpers.js';
import { TokenSizeFields } from './forms/TokenSizeFields.jsx';
import { roundTokenSizeMultiplier } from '../lib/token-size.js';
import { ImageEditor } from './forms/ImageEditor.jsx';

function SchemaSection({ label, children, labelUppercase = true }) {
  return (
    <div className="space-y-1">
      <p
        className={`text-[9px] tracking-widest text-dh-muted font-semibold ${labelUppercase ? 'uppercase' : ''}`}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function orderedPropertyKeys(jsonSchema) {
  const props = jsonSchema?.properties;
  if (!props || typeof props !== 'object') return [];
  return Object.keys(props);
}

/**
 * @param {object} props
 * @param {object} props.jsonSchema — author fragment (properties + required)
 * @param {object} props.data — payload (sheet: resolved card; editor: bound object)
 * @param {'sheet'|'editor'} props.mode
 * @param {boolean} [props.preview]
 * @param {(fieldKey: string, schema: object) => void} [props.onFieldRoll] — sheet: attack rolls only
 * @param {(filled: number) => void} [props.onTrackedSetFilled]
 * @param {(path: string[], value: unknown) => void | ((patch: object) => void)} [props.onEditorChange] — editor: either set one (possibly nested) key by path segments, or (single-object-argument form) atomically merge multiple top-level sibling keys — see `sizeMultiplierPair`
 * @param {(url: string, opts?: object) => void} [props.onImageSaved] — editor: called after an image is saved to the server; injected path is forwarded for nested saves
 */
export function DeclarativeSchemaCardBody({
  jsonSchema,
  data,
  mode,
  preview = false,
  onFieldRoll,
  onTrackedSetFilled,
  onEditorChange,
  onImageSaved,
  /** Sheet: hide keys shown in the card header (e.g. name, species). */
  skipKeys,
}) {
  const props = jsonSchema?.properties;
  if (!props || typeof props !== 'object') return null;
  const keys = orderedPropertyKeys(jsonSchema);
  const nodes = [];
  const skip = skipKeys instanceof Set ? skipKeys : null;

  for (const key of keys) {
    if (skip?.has(key)) continue;
    const sub = props[key];
    if (!sub || typeof sub !== 'object') continue;
    const t = sub.type;
    const title = sub.title != null ? String(sub.title) : key;
    const val = data?.[key];

    if (t === 'trackedState') {
      const maxKey = key === 'currentStress' ? 'maxStress' : null;
      const maxVal = maxKey != null && data?.[maxKey] != null ? Number(data[maxKey]) : null;
      const total = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : 1;
      const filled = typeof val === 'number' ? val : 0;
      if (mode === 'sheet') {
        nodes.push(
          <div key={key} className="flex items-center gap-1">
            {onTrackedSetFilled && !preview ? (
              <CheckboxTrack
                total={total}
                filled={filled}
                onSetFilled={onTrackedSetFilled}
                trackKind="stress"
                label={title}
                verbs={['Mark', 'Clear']}
              />
            ) : (
              <span className="text-[11px] text-dh-muted">
                {title} {filled}/{total}
              </span>
            )}
          </div>,
        );
      } else {
        nodes.push(
          <div key={key} className="flex items-center gap-1">
            <CheckboxTrack
              total={total}
              filled={filled}
              onSetFilled={(n) => onEditorChange?.([key], n)}
              trackKind="stress"
              label={title}
              verbs={['Mark', 'Clear']}
            />
          </div>,
        );
      }
      continue;
    }

    if (t === 'sizeMultiplierPair') {
      const widthKey = sub.widthKey || 'tokenSizeWidth';
      const lengthKey = sub.lengthKey || 'tokenSizeLength';
      const linkedKey = sub.linkedKey || 'tokenSizeLinked';
      const width = data?.[widthKey] != null ? roundTokenSizeMultiplier(data[widthKey]) : 1;
      const length = data?.[lengthKey] != null ? roundTokenSizeMultiplier(data[lengthKey]) : 1;
      const linked = data?.[linkedKey] !== false;

      if (mode === 'sheet') {
        if (width === 1 && length === 1) continue;
        nodes.push(
          <div key={key} className="text-[11px] text-dh-muted">
            Size {width.toFixed(1)}x × {length.toFixed(1)}x
          </div>,
        );
        continue;
      }

      nodes.push(
        <div key={key}>
          <label className="text-[10px] text-dh-muted block mb-1">{title}</label>
          <TokenSizeFields
            value={{ tokenSizeWidth: width, tokenSizeLength: length, tokenSizeLinked: linked }}
            onChange={(patch) => {
              const remapped = {};
              if ('tokenSizeWidth' in patch) remapped[widthKey] = patch.tokenSizeWidth;
              if ('tokenSizeLength' in patch) remapped[lengthKey] = patch.tokenSizeLength;
              if ('tokenSizeLinked' in patch) remapped[linkedKey] = patch.tokenSizeLinked;
              onEditorChange?.(remapped);
            }}
          />
        </div>,
      );
      continue;
    }

    if (t === 'imagePortrait') {
      if (mode === 'sheet') {
        // Rendered in the card header, not the body — skip here.
        continue;
      }
      nodes.push(
        <div key={key}>
          <label className="text-[10px] text-dh-muted block mb-1">{title}</label>
          <ImageEditor
            imageUrl={data?.imageUrl ?? null}
            _additionalImages={data?._additionalImages ?? []}
            onChange={(u) => onEditorChange?.(u)}
            onImageSaved={onImageSaved}
            collection="companion"
            formData={data}
            inline
          />
        </div>,
      );
      continue;
    }

    if (t === 'attack') {
      const has = !!(typeof val === 'string' && val.trim());
      if (mode === 'sheet') {
        nodes.push(
          <SchemaSection key={key} label={title}>
            {!preview && onFieldRoll && has ? (
              <button
                type="button"
                onClick={() => onFieldRoll(key, sub)}
                className="text-[11px] rounded px-1.5 py-0.5 border bg-dh-raised border-dh-border text-dh hover:bg-dh-hover/60 hover:border-sky-600 cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Swords size={10} className="text-sky-400 shrink-0" />
                <span>{val}</span>
                <span className="text-dh-muted">— d6 Melee</span>
              </button>
            ) : (
              <div className="text-[11px] text-dh">{has ? `${val} — d6 Melee` : '—'}</div>
            )}
          </SchemaSection>,
        );
      } else {
        nodes.push(
          <div key={key}>
            <label className="text-[10px] text-dh-muted block mb-0.5">{title}</label>
            <input
              type="text"
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => onEditorChange?.([key], e.target.value)}
              className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none"
              placeholder="e.g. Bite, Claw"
            />
            <p className="text-[10px] text-dh-muted mt-0.5">Defaults to d6 Melee</p>
          </div>,
        );
      }
      continue;
    }

    if (t === 'array' && sub.items?.type === 'object' && sub.items.properties) {
      const arr = Array.isArray(val) ? val : [];
      const itemProps = sub.items.properties;
      const itemKeys = Object.keys(itemProps);
      nodes.push(
        <SchemaSection key={key} label={sub.title || title}>
          {mode === 'sheet' ? (
            <div className="flex flex-wrap gap-1">
              {arr.map((exp, i) => (
                <span
                  key={exp?.id || i}
                  className="text-[11px] rounded px-1.5 py-0.5 border bg-dh-raised border-dh-border text-dh"
                >
                  {exp?.name}
                  {exp?.score != null && <span className="font-bold ml-1 text-sky-400">+{exp.score}</span>}
                </span>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {arr.map((exp, i) => (
                <div key={exp?.id || i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={exp?.name || ''}
                    onChange={(e) => {
                      const next = [...arr];
                      next[i] = { ...next[i], name: e.target.value };
                      onEditorChange?.([key], next);
                    }}
                    className="flex-1 bg-dh-raised border border-dh-border rounded px-2 py-1 text-sm text-dh focus:border-sky-500 focus:outline-none"
                    placeholder="Experience name"
                  />
                  <input
                    type="number"
                    min={itemProps.score?.minimum ?? 1}
                    value={exp?.score ?? itemProps.score?.default ?? 2}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      const next = [...arr];
                      next[i] = { ...next[i], score: Number.isFinite(n) ? n : 2 };
                      onEditorChange?.([key], next);
                    }}
                    className="w-14 bg-dh-raised border border-dh-border rounded px-1 py-1 text-sm text-dh tabular-nums text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (arr.length <= (sub.minItems ?? 2)) return;
                      const next = arr.filter((_, j) => j !== i);
                      onEditorChange?.([key], next);
                    }}
                    disabled={arr.length <= (sub.minItems ?? 2)}
                    className="text-dh-muted hover:text-red-400 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onEditorChange?.([key], [...arr, { name: '', score: 2, id: generateId() }])
                }
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                + Add Experience
              </button>
            </div>
          )}
        </SchemaSection>,
      );
      continue;
    }

    if (t === 'string') {
      if (mode === 'editor') {
        nodes.push(
          <div key={key}>
            <label className="text-[10px] text-dh-muted block mb-0.5">{title}</label>
            <input
              type="text"
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => onEditorChange?.([key], e.target.value)}
              className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none"
            />
          </div>,
        );
      } else {
        nodes.push(
          <div key={key} className="text-[11px] text-dh">
            <span className="text-dh-muted">{title}: </span>
            <span>{typeof val === 'string' ? val : '—'}</span>
          </div>,
        );
      }
      continue;
    }

    if (t === 'integer') {
      if (mode === 'editor') {
        const min = sub.minimum ?? undefined;
        const max = sub.maximum ?? undefined;
        nodes.push(
          <div key={key}>
            <label className="text-[10px] text-dh-muted block mb-0.5">{title}</label>
            <input
              type="number"
              min={min}
              max={max}
              value={val ?? sub.default ?? ''}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onEditorChange?.([key], Number.isFinite(n) ? n : sub.default ?? 0);
              }}
              className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none"
            />
          </div>,
        );
      } else {
        if (key === 'maxStress') {
          continue;
        }
        if (key === 'evasion') {
          const maxS = data?.maxStress;
          nodes.push(
            <div key="eva-row" className="flex gap-2 text-[11px] text-dh-muted flex-wrap">
              <span className="font-bold text-cyan-400/80">EVA {typeof val === 'number' ? val : sub.default ?? 10}</span>
              {typeof maxS === 'number' && <span>· Max stress {maxS}</span>}
            </div>,
          );
        } else {
          nodes.push(
            <div key={key} className="text-[11px] text-dh">
              <span className="text-dh-muted">{title}: </span>
              <span className="tabular-nums">{typeof val === 'number' ? val : '—'}</span>
            </div>,
          );
        }
      }
    }
  }

  return <div className="space-y-2 flex-1 min-h-0">{nodes}</div>;
}

/**
 * @param {object} props
 * @param {string} props.featureName
 * @param {object} props.jsonSchema
 * @param {object} props.data
 * @param {boolean} [props.preview]
 * @param {(fieldKey: string, schema: object) => void} [props.onFieldRoll]
 * @param {(filled: number) => void} [props.onTrackedSetFilled]
 * @param {(url: string) => void} [props.onOpenImageLightbox] — when provided and the card has an imageUrl, a clickable portrait thumbnail is shown in the header
 */
export function DeclarativeSchemaSheetCard({
  featureName,
  jsonSchema,
  data,
  preview = false,
  onFieldRoll,
  onTrackedSetFilled,
  onOpenImageLightbox,
  /** Optional ReactNode rendered inside the card border, below the body — use for action chips. */
  chipsSlot,
}) {
  const clean = omitShapeId(data);
  const headerName = typeof clean.name === 'string' ? clean.name : '';
  const headerSpecies = typeof clean.species === 'string' ? clean.species : '';
  const portraitUrl = typeof clean.imageUrl === 'string' && clean.imageUrl ? clean.imageUrl : null;
  return (
    <div className="bg-dh-raised border border-dh-border rounded-xl shadow-2xl overflow-hidden flex flex-col min-w-[14rem]">
      <div className="px-3 py-2 border-b dh-tint-spellcast-strip shrink-0">
        <p className="text-[10px] uppercase tracking-widest dh-text-spellcast-header-sub font-semibold">
          {featureName}
        </p>
        <div className="flex items-center gap-2 min-w-0">
          {portraitUrl && (
            <button
              type="button"
              onClick={() => onOpenImageLightbox?.(portraitUrl)}
              className="shrink-0 rounded-full overflow-hidden border border-dh-strong hover:border-white transition-colors focus:outline-none focus:ring-1 focus:ring-white"
              style={{ width: 32, height: 32 }}
              title="View portrait"
            >
              <img src={portraitUrl} alt={headerName || 'Companion'} className="w-full h-full object-cover" draggable={false} />
            </button>
          )}
          <div className="min-w-0">
            {headerName !== '' && <div className="font-semibold text-dh truncate">{headerName}</div>}
            {headerSpecies.trim() !== '' && <div className="text-[11px] text-dh-muted">{headerSpecies}</div>}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2 flex-1 min-h-0">
        <DeclarativeSchemaCardBody
          jsonSchema={jsonSchema}
          data={clean}
          mode="sheet"
          preview={preview}
          onFieldRoll={onFieldRoll}
          onTrackedSetFilled={onTrackedSetFilled}
          skipKeys={new Set(['name', 'species', 'imageUrl', '_additionalImages'])}
        />
      </div>
      {chipsSlot && (
        <div className="px-3 pb-3 pt-1 border-t border-dh-border/50">
          {chipsSlot}
        </div>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.featureName
 * @param {object} props.jsonSchema
 * @param {object} props.bind — `{ kind: 'character', path: string }`
 * @param {object} props.formCharacter — full form row (`recomputeCharacter` output)
 * @param {(nextCharacter: object) => void} props.setCharacter — same contract as CharacterForm `set`
 * @param {(url: string, opts?: object) => void} [props.onImageSaved] — threaded from CharacterForm; the `path` from `bind` is injected into opts automatically so nested image saves go to the right sub-object
 */
export function DeclarativeSchemaEditorCard({ featureName, jsonSchema, bind, formCharacter, setCharacter, onImageSaved }) {
  const path = bind?.path || 'companion';
  const raw = getBoundObject(formCharacter, path);
  const data =
    raw && typeof raw === 'object'
      ? raw
      : {
          name: '',
          species: '',
          evasion: 10,
          attackName: '',
          maxStress: 3,
          currentStress: 0,
          experiences: [
            { name: '', score: 2, id: generateId() },
            { name: '', score: 2, id: generateId() },
          ],
        };

  /**
   * Two call shapes:
   * - `onEditorChange(pathSegs, value)` — set one (possibly nested) key by path segments.
   * - `onEditorChange(patch)` — atomically merge multiple top-level sibling keys (e.g.
   *   `sizeMultiplierPair`'s linked width+length update, which must land in one state update).
   */
  const onEditorChange = (pathSegsOrPatch, value) => {
    const next = { ...data };
    if (Array.isArray(pathSegsOrPatch)) {
      const pathSegs = pathSegsOrPatch;
      if (pathSegs.length === 1) {
        next[pathSegs[0]] = value;
      } else {
        let cur = next;
        for (let i = 0; i < pathSegs.length - 1; i++) {
          const k = pathSegs[i];
          cur[k] = cur[k] && typeof cur[k] === 'object' ? { ...cur[k] } : {};
          cur = cur[k];
        }
        cur[pathSegs[pathSegs.length - 1]] = value;
      }
    } else if (pathSegsOrPatch && typeof pathSegsOrPatch === 'object') {
      Object.assign(next, pathSegsOrPatch);
    }
    const nextChar = setBoundObject(formCharacter, path, next);
    setCharacter(nextChar);
  };

  const handleImageSaved = onImageSaved
    ? (url, opts) => onImageSaved(url, { ...opts, path: bind?.path })
    : undefined;

  return (
    <div className="rounded-lg border border-dh-border bg-dh-canvas/20 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-dh">{featureName}</p>
      <DeclarativeSchemaCardBody
        jsonSchema={jsonSchema}
        data={data}
        mode="editor"
        preview={false}
        onEditorChange={onEditorChange}
        onImageSaved={handleImageSaved}
        skipKeys={new Set()}
      />
    </div>
  );
}
