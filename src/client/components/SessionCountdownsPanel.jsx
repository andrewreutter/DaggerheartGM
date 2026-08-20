import { Timer, Plus, Eye, EyeOff, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateId } from '../lib/helpers.js';
import {
  applyCountdownLoop,
  countdownCanLoop,
  countdownFieldsFromParsedCd,
  COUNTDOWN_LOOPING_LABELS,
  deriveKindFromCountdownLabel,
  isCountdownStartDice,
  normalizeSessionCountdownEntry,
} from '../lib/session-countdowns.js';
import { COUNTDOWN_KIND_LABELS } from './CountdownRollReference.jsx';
import {
  ENCOUNTER_OVERLAY_FALLBACK_RECT,
  stopEncounterOverlayFromInteractive,
} from '../lib/encounter-overlay-interactive.js';

/**
 * @param {object} props
 * @param {object} props.row
 * @param {boolean} props.isGm
 * @param {(id: string, partial: object) => void} props.patch
 * @param {string} props.className
 */
function SessionCountdownCard({
  row,
  isGm,
  patch,
  className,
  trackerOverlay,
  onRollStart,
  onLoop,
  rolling,
  chromeHoverProps = {},
}) {
  const title = [row.label?.trim() ? row.label : 'Countdown', row.sourceRef ? 'Linked to feature' : '']
    .filter(Boolean)
    .join(' — ');
  const gmOnly = row.visibility === 'gm';
  const kindLabel = COUNTDOWN_KIND_LABELS[row.kind] || COUNTDOWN_KIND_LABELS.standard;
  const isAuto = row.kind === 'standard' ? !!row.autoStandard : !!row.autoDynamic;
  const hoverProps = trackerOverlay
    ? trackerOverlay.triggerProps((e) => ({
      kind: 'countdown',
      row,
      top: e.currentTarget.getBoundingClientRect().top,
      bottom: e.currentTarget.getBoundingClientRect().bottom,
    }))
    : {};

  return (
    <div data-testid="encounter-countdown-card" className={`${className} ${trackerOverlay ? 'cursor-pointer' : ''}`} {...hoverProps} {...chromeHoverProps}>
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-start gap-1.5">
          {isGm ? (
            <button
              type="button"
              onClick={(e) => {
                stopEncounterOverlayFromInteractive(e);
                patch(row.id, { visibility: gmOnly ? 'players' : 'gm' });
              }}
              onMouseDown={stopEncounterOverlayFromInteractive}
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
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-dh-raised/80 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dh-muted">
            {kindLabel}
          </span>
          <span className="rounded bg-dh-raised/80 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dh-muted">
            {isAuto ? 'Auto' : 'Manual'}
          </span>
          {row.looping && row.looping !== 'none' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-dh-raised/80 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dh-muted">
              <Repeat size={9} aria-hidden />
              {COUNTDOWN_LOOPING_LABELS[row.looping] || row.looping}
            </span>
          ) : null}
          {row.sourceRef ? (
            <span className="rounded bg-emerald-950/50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90">
              Linked
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex min-w-0 items-center gap-0.5">
            {row.looping && row.looping !== 'none' ? (
              <span
                className="mr-0.5 text-dh-muted"
                title={COUNTDOWN_LOOPING_LABELS[row.looping] || 'Loop'}
                aria-label={COUNTDOWN_LOOPING_LABELS[row.looping] || 'Loop'}
              >
                <Repeat size={11} />
              </span>
            ) : null}
            {row.startPending && row.startFormula ? (
              <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-dh-hope">
                {row.startFormula}
              </span>
            ) : isGm ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    stopEncounterOverlayFromInteractive(e);
                    patch(row.id, { current: Math.max(0, (row.current ?? 0) - 1) });
                  }}
                  onMouseDown={stopEncounterOverlayFromInteractive}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-dh-hover text-[10px] font-bold text-dh hover:bg-red-900/50"
                  aria-label="Decrease countdown"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-dh-hope">{row.current ?? 0}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    stopEncounterOverlayFromInteractive(e);
                    patch(row.id, { current: (row.current ?? 0) + 1 });
                  }}
                  onMouseDown={stopEncounterOverlayFromInteractive}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-dh-hover text-[10px] font-bold text-dh hover:bg-emerald-900/40"
                  aria-label="Increase countdown"
                >
                  +
                </button>
              </>
            ) : (
              <span className="text-sm font-bold tabular-nums text-dh-hope">{row.current ?? 0}</span>
            )}
            {!(row.startPending && row.startFormula) ? (
              <span className="text-[10px] text-dh-muted whitespace-nowrap">/ {row.start ?? 0}</span>
            ) : null}
          </div>
          {isGm && (
            <div className="flex shrink-0 items-center gap-0.5">
              {row.startPending && row.startFormula && onRollStart ? (
                <button
                  type="button"
                  disabled={rolling}
                  title="Roll starting value"
                  onClick={(e) => {
                    stopEncounterOverlayFromInteractive(e);
                    onRollStart(row);
                  }}
                  onMouseDown={stopEncounterOverlayFromInteractive}
                  className="rounded px-1 py-0.5 text-[10px] font-semibold text-dh-hope hover:bg-dh-hover disabled:opacity-50"
                >
                  Roll start
                </button>
              ) : null}
              {row.looping && row.looping !== 'none' ? (
                <button
                  type="button"
                  disabled={rolling || !countdownCanLoop(row)}
                  title={countdownCanLoop(row) ? 'Loop — restore start value' : 'Loop when the clock is at 0'}
                  onClick={(e) => {
                    stopEncounterOverlayFromInteractive(e);
                    onLoop?.(row);
                  }}
                  onMouseDown={stopEncounterOverlayFromInteractive}
                  className="rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover disabled:opacity-40"
                >
                  Loop
                </button>
              ) : null}
            </div>
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
 * @param {object} [props.trackerOverlay] — shared Encounter click-to-pin overlay (left-of-aside editor panel)
 * @param {object} [props.chromeHoverProps] — section-level map-chrome tooltip (title + add + cards)
 */
export function SessionCountdownsPanel({
  sessionCountdowns = [],
  isGm,
  onTableOp,
  variant = 'panel',
  sectionTitle = 'Countdowns',
  trackerOverlay,
  onRollCountdown,
  chromeHoverForRow,
  addChromeHoverProps = {},
  chromeHoverProps = {},
}) {
  const [open, setOpen] = useState(true);
  const [rollingId, setRollingId] = useState(null);
  const rows = useMemo(() => (Array.isArray(sessionCountdowns) ? sessionCountdowns : []), [sessionCountdowns]);

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
    trackerOverlay?.show({
      kind: 'countdown',
      row: entry,
      ...ENCOUNTER_OVERLAY_FALLBACK_RECT,
    });
  };

  const patch = (id, partial) => {
    onTableOp?.({ op: 'session-countdown-patch', id, patch: partial });
  };

  const handleRollStart = async (row) => {
    if (!row?.id || !isCountdownStartDice(row.startFormula) || !onRollCountdown) return;
    setRollingId(row.id);
    try {
      const total = await onRollCountdown(row.startFormula, `${row.label || 'Countdown'} start`);
      patch(row.id, { start: total, current: total, startPending: false });
    } finally {
      setRollingId(null);
    }
  };

  const handleLoop = async (row) => {
    if (!row?.id || !countdownCanLoop(row)) return;
    let startFormulaTotal;
    if (isCountdownStartDice(row.startFormula) && onRollCountdown) {
      setRollingId(row.id);
      try {
        startFormulaTotal = await onRollCountdown(row.startFormula, `${row.label || 'Countdown'} loop`);
      } catch {
        setRollingId(null);
        return;
      }
      setRollingId(null);
    }
    const next = applyCountdownLoop({
      start: row.start,
      startFormulaTotal,
      looping: row.looping,
    });
    patch(row.id, { ...next, startPending: false });
  };

  const cardProps = (row) => ({
    row,
    isGm,
    patch,
    trackerOverlay,
    onRollStart: onRollCountdown ? handleRollStart : undefined,
    onLoop: handleLoop,
    rolling: rollingId === row.id,
  });

  if (!isGm && rows.length === 0) return null;

  if (variant === 'section') {
    return (
      <div className="space-y-2" {...chromeHoverProps}>
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
              {...cardProps(row)}
              className="rounded-lg border border-dh-strong bg-dh-surface px-2.5 py-2"
            />
          ))}
        </div>
      </div>
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
                Track Progress / Consequence countdowns from GM Moves or add one manually. Click a card to edit kind, visibility, and automation.
              </p>
            )}
            {rows.map((row) => (
              <SessionCountdownCard
                key={row.id}
                {...cardProps(row)}
                chromeHoverProps={chromeHoverForRow?.(row)}
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
    ...countdownFieldsFromParsedCd(cd),
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
        ...countdownFieldsFromParsedCd(cd),
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
