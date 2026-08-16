import { Timer, Plus, Pencil, Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateId } from '../lib/helpers.js';
import { deriveKindFromCountdownLabel, normalizeSessionCountdownEntry } from '../lib/session-countdowns.js';
import { SessionCountdownEditorModal } from './modals/SessionCountdownEditorModal.jsx';

/**
 * @param {object} props
 * @param {object} props.row
 * @param {boolean} props.isGm
 * @param {(id: string, partial: object) => void} props.patch
 * @param {(row: object) => void} props.onEdit
 * @param {string} props.className
 */
function SessionCountdownCard({ row, isGm, patch, onEdit, className, trackerOverlay }) {
  const title = [row.label?.trim() ? row.label : 'Countdown', row.sourceRef ? 'Linked to feature' : '']
    .filter(Boolean)
    .join(' — ');
  const gmOnly = row.visibility === 'gm';
  const hoverProps = trackerOverlay
    ? trackerOverlay.triggerProps((e) => ({
      kind: 'countdown',
      row,
      top: e.currentTarget.getBoundingClientRect().top,
      bottom: e.currentTarget.getBoundingClientRect().bottom,
    }))
    : {};

  return (
    <div data-testid="encounter-countdown-card" className={className} {...hoverProps}>
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-start gap-1.5">
          {isGm ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                patch(row.id, { visibility: gmOnly ? 'players' : 'gm' });
              }}
              className="mt-0.5 shrink-0 rounded p-0.5 text-dh-muted hover:bg-dh-hover/60 hover:text-dh"
              title={gmOnly ? 'GM only — click to show players' : 'Visible to players — click for GM only'}
              aria-label={gmOnly ? 'Show to players' : 'GM only'}
              aria-pressed={gmOnly}
            >
              {gmOnly ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          ) : gmOnly ? (
            <EyeOff size={12} className="mt-0.5 shrink-0 text-dh-muted" title="GM only" aria-hidden />
          ) : (
            <Eye size={12} className="mt-0.5 shrink-0 text-dh-muted" title="Visible to players" aria-hidden />
          )}
          <p className="min-w-0 flex-1 text-xs font-medium text-dh break-words leading-snug" title={title}>
            {row.label?.trim() ? row.label : 'Countdown'}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex min-w-0 items-center gap-0.5">
            {isGm ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patch(row.id, { current: Math.max(0, (row.current ?? 0) - 1) });
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-dh-hover text-[10px] font-bold text-dh hover:bg-red-900/50"
                  aria-label="Decrease countdown"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-dh-hope">{row.current ?? 0}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patch(row.id, { current: (row.current ?? 0) + 1 });
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-dh-hover text-[10px] font-bold text-dh hover:bg-emerald-900/40"
                  aria-label="Increase countdown"
                >
                  +
                </button>
              </>
            ) : (
              <span className="text-sm font-bold tabular-nums text-dh-hope">{row.current ?? 0}</span>
            )}
            <span className="text-[10px] text-dh-muted whitespace-nowrap">/ {row.start ?? 0}</span>
          </div>
          {isGm && (
            <button
              type="button"
              title="Edit countdown"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(row);
              }}
              className="shrink-0 rounded p-1 text-dh-muted hover:text-dh hover:bg-dh-hover"
              aria-label="Edit countdown"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array<object>} props.sessionCountdowns
 * @param {boolean} props.isGm
 * @param {(op: object) => void} [props.onTableOp] — GM-only; posts session countdown ops
 * @param {'panel' | 'section'} [props.variant] — `panel`: collapsible card (default). `section`: subtitle + card rows for Encounter column.
 * @param {string} [props.sectionTitle] — uppercase-friendly label when `variant="section"`
 * @param {object} [props.trackerOverlay] — shared Encounter hover overlay (left-of-aside detail panel)
 */
export function SessionCountdownsPanel({
  sessionCountdowns = [],
  isGm,
  onTableOp,
  variant = 'panel',
  sectionTitle = 'Countdowns',
  trackerOverlay,
}) {
  const [open, setOpen] = useState(true);
  const [editorRow, setEditorRow] = useState(null);
  const rows = useMemo(() => (Array.isArray(sessionCountdowns) ? sessionCountdowns : []), [sessionCountdowns]);

  const editorTarget = useMemo(() => {
    if (!editorRow?.id) return null;
    return rows.find((r) => r.id === editorRow.id) ?? editorRow;
  }, [editorRow, rows]);

  const addBlank = () => {
    if (!onTableOp) return;
    const id = generateId();
    const entry = normalizeSessionCountdownEntry({
      id,
      label: 'New countdown',
      kind: 'standard',
      start: 6,
      current: 6,
      visibility: 'players',
      autoStandard: true,
      autoDynamic: false,
    });
    onTableOp({ op: 'session-countdown-upsert', entry });
    setEditorRow(entry);
  };

  const patch = (id, partial) => {
    onTableOp?.({ op: 'session-countdown-patch', id, patch: partial });
  };

  const remove = (id) => {
    onTableOp?.({ op: 'session-countdown-remove', id });
  };

  if (!isGm && rows.length === 0) return null;

  if (variant === 'section') {
    return (
      <>
        <div className="space-y-2">
          {(sectionTitle || isGm) && (
            <div className="flex items-center justify-between gap-2">
              {sectionTitle ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">{sectionTitle}</p>
              ) : (
                <span />
              )}
              {isGm && (
                <button
                  type="button"
                  onClick={addBlank}
                  title="Add countdown"
                  data-prep-target="build"
                  className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            {rows.map((row) => (
              <SessionCountdownCard
                key={row.id}
                row={row}
                isGm={isGm}
                patch={patch}
                onEdit={setEditorRow}
                trackerOverlay={trackerOverlay}
                className="rounded-lg border border-dh-strong bg-dh-surface px-2.5 py-2"
              />
            ))}
          </div>
        </div>
        {isGm && (
          <SessionCountdownEditorModal
            open={!!editorTarget}
            row={editorTarget}
            onClose={() => setEditorRow(null)}
            onApplyPatch={(partial) => editorTarget && patch(editorTarget.id, partial)}
            onRemove={() => editorTarget && remove(editorTarget.id)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-dh-strong bg-dh-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-2.5 py-2 flex items-center gap-2 text-left hover:bg-dh-raised/50 transition-colors"
        >
          <Timer size={14} className="text-dh-hope shrink-0" />
          <span className="text-xs font-semibold text-dh uppercase tracking-wider flex-1">Session countdowns</span>
          {rows.length > 0 && (
            <span className="text-[10px] text-dh-muted tabular-nums">{rows.length}</span>
          )}
        </button>
        {open && (
          <div className="border-t border-dh-border px-2.5 py-2 space-y-2 max-h-64 overflow-y-auto">
            {rows.length === 0 && isGm && (
              <p className="text-[10px] text-dh-muted leading-snug">
                Track Progress / Consequence countdowns from GM Moves or add one manually. Use the pencil to set kind, visibility, and automation.
              </p>
            )}
            {rows.map((row) => (
              <SessionCountdownCard
                key={row.id}
                row={row}
                isGm={isGm}
                patch={patch}
                onEdit={setEditorRow}
                trackerOverlay={trackerOverlay}
                className="rounded border border-dh-border bg-dh-raised/40 px-2 py-1.5"
              />
            ))}
            {isGm && (
              <button
                type="button"
                onClick={addBlank}
                className="w-full flex items-center justify-center gap-1 rounded border border-dashed border-dh-strong py-1 text-[10px] text-dh-muted hover:text-dh hover:bg-dh-hover/60"
              >
                <Plus size={12} /> Add countdown
              </button>
            )}
          </div>
        )}
      </div>
      {isGm && (
        <SessionCountdownEditorModal
          open={!!editorTarget}
          row={editorTarget}
          onClose={() => setEditorRow(null)}
          onApplyPatch={(partial) => editorTarget && patch(editorTarget.id, partial)}
          onRemove={() => editorTarget && remove(editorTarget.id)}
        />
      )}
    </>
  );
}

export function buildTrackedSessionEntryFromFeature({ feature, cd, cdIdx, sourceName }) {
  const kind = deriveKindFromCountdownLabel(cd.label);
  const id = generateId();
  const label = `${sourceName || ''} ${feature?.name || ''}`.trim().slice(0, 120) || cd.label || 'Countdown';
  return normalizeSessionCountdownEntry({
    id,
    label,
    kind,
    start: cd.value,
    current: cd.value,
    visibility: 'players',
    sourceRef: {
      cardKey: feature.cardKey,
      featureKey: feature.featureKey,
      cdIdx,
    },
    autoStandard: kind === 'standard',
    autoDynamic: kind === 'progress' || kind === 'consequence',
  });
}

export function buildLinkedPairFromFeatureCountdowns({ feature, cds, sourceName, groupId }) {
  if (!Array.isArray(cds) || cds.length < 2) return [];
  const gid = groupId || generateId();
  const out = [];
  for (let i = 0; i < 2; i++) {
    const cd = cds[i];
    const kind = deriveKindFromCountdownLabel(cd.label);
    out.push(
      normalizeSessionCountdownEntry({
        id: generateId(),
        label: `${(sourceName || '').trim()} ${(feature?.name || '').trim()} (${cd.label || `slot ${i + 1}`})`.slice(0, 120),
        kind,
        start: cd.value,
        current: cd.value,
        visibility: 'players',
        linkedGroupId: gid,
        sourceRef: {
          cardKey: feature.cardKey,
          featureKey: feature.featureKey,
          cdIdx: i,
        },
        autoStandard: kind === 'standard',
        autoDynamic: kind === 'progress' || kind === 'consequence',
      })
    );
  }
  return out;
}
