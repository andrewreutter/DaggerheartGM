import { useEffect, useRef, useState } from 'react';
import { Timer, Eye, EyeOff, Trash2 } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { CountdownRollReferencePanel } from '../CountdownRollReference.jsx';
import {
  COUNTDOWN_LOOPING_LABELS,
  COUNTDOWN_LOOPING_MODES,
  countdownShowsElaboratedStart,
  isCountdownStartDice,
  parseCountdownStartNumber,
} from '../../lib/session-countdowns.js';

/**
 * GM editor for a single session countdown (label, kind, visibility, automation, start/current, remove).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {object | null} props.row — normalized session countdown row
 * @param {() => void} props.onClose
 * @param {(patch: object) => void} props.onApplyPatch — merged fields applied in one `session-countdown-patch`
 * @param {() => void} props.onRemove
 * @param {(formula: string, displayName: string) => Promise<number>} [props.onRollStart] — live table only
 */
export function SessionCountdownEditorModal({ open, row, onClose, onApplyPatch, onRemove, onRollStart }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('standard');
  const [visibility, setVisibility] = useState('players');
  const [autoStandard, setAutoStandard] = useState(false);
  const [autoDynamic, setAutoDynamic] = useState(false);
  const [looping, setLooping] = useState('none');
  const [startFormula, setStartFormula] = useState('');
  const [startPending, setStartPending] = useState(false);
  const [start, setStart] = useState(0);
  const [current, setCurrent] = useState(0);
  const [rolling, setRolling] = useState(false);
  const titleRef = useRef(null);

  // Depend on `row?.id`, not `row`: table_state snapshots use a new object reference every SSE tick,
  // which would re-run this effect, reset fields, and steal focus from other controls.
  useEffect(() => {
    if (!open || !row?.id) return;
    setLabel(row.label ?? '');
    setKind(row.kind === 'progress' || row.kind === 'consequence' ? row.kind : 'standard');
    setVisibility(row.visibility === 'gm' ? 'gm' : 'players');
    setAutoStandard(!!row.autoStandard);
    setAutoDynamic(!!row.autoDynamic);
    setLooping(COUNTDOWN_LOOPING_MODES.includes(row.looping) ? row.looping : 'none');
    setStartFormula(row.startFormula ?? (row.start != null ? String(row.start) : ''));
    setStartPending(!!row.startPending);
    setStart(row.start ?? 0);
    setCurrent(row.current ?? 0);
    const t = window.setTimeout(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit `row`; see above
  }, [open, row?.id]);

  if (!row) return null;

  const formulaTrimmed = startFormula.trim();
  const formulaIsDice = isCountdownStartDice(formulaTrimmed);
  const showElaboratedStart = countdownShowsElaboratedStart({
    startFormula: formulaTrimmed,
    start,
    startPending,
  });
  const showCurrent = !(formulaIsDice && startPending);

  const handleSave = () => {
    const asNumber = parseCountdownStartNumber(formulaTrimmed);
    const nextStart = formulaIsDice
      ? (startPending ? 0 : Math.max(0, Number(start) || 0))
      : (showElaboratedStart ? Math.max(0, Number(start) || 0) : (asNumber ?? Math.max(0, Number(start) || 0)));
    const nextCurrent = formulaIsDice && startPending ? 0 : Math.max(0, Number(current) || 0);
    onApplyPatch({
      label: label.trim() || 'Countdown',
      kind,
      visibility,
      autoStandard,
      autoDynamic,
      looping,
      startFormula: formulaTrimmed || undefined,
      startPending: formulaIsDice ? startPending : false,
      start: nextStart,
      current: nextCurrent,
    });
    onClose();
  };

  const handleFormulaChange = (next) => {
    setStartFormula(next);
    if (isCountdownStartDice(next.trim())) {
      setStartPending(true);
      return;
    }
    setStartPending(false);
    const n = parseCountdownStartNumber(next.trim());
    if (n != null) {
      setStart(n);
      setCurrent(n);
    }
  };

  const handleRollStartClick = async () => {
    const formula = startFormula.trim();
    if (!onRollStart || !isCountdownStartDice(formula) || !row?.id) return;
    setRolling(true);
    try {
      const total = await onRollStart(formula, `${label.trim() || row.label || 'Countdown'} start`);
      setStart(total);
      setCurrent(total);
      setStartPending(false);
      onApplyPatch({
        start: total,
        current: total,
        startPending: false,
        startFormula: formula,
        looping,
      });
    } finally {
      setRolling(false);
    }
  };

  const handleRemove = () => {
    if (!window.confirm('Remove this countdown from the table?')) return;
    onRemove();
    onClose();
  };

  return (
    <FullPageOverlay
      open={open}
      onClose={onClose}
      zIndexClass="z-[200]"
      maxWidthClass="max-w-5xl"
      heightClass="h-[min(88vh,720px)]"
      containerClassName="p-4 sm:p-6"
    >
      <FullPageOverlayHeader
        title="Edit countdown"
        titleId="session-countdown-editor-title"
        icon={Timer}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex max-h-full flex-col gap-3 pt-1">
            <label className="block">
              <span className="text-xs font-semibold text-dh-muted">Name</span>
              <input
                ref={titleRef}
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-dh-strong"
                placeholder="Label"
                aria-labelledby="session-countdown-editor-title"
              />
            </label>

            <div>
              <span className="text-xs font-semibold text-dh-muted" id="session-countdown-kind-label">
                Kind
              </span>
              <div
                className="mt-1 grid w-full max-w-xl grid-cols-3 overflow-hidden rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong"
                role="group"
                aria-labelledby="session-countdown-kind-label"
              >
                {[
                  { value: 'standard', label: 'Standard' },
                  { value: 'progress', label: 'Progress' },
                  { value: 'consequence', label: 'Consequence' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKind(opt.value)}
                    aria-pressed={kind === opt.value}
                    className={`min-w-0 px-2 py-1.5 text-sm font-medium transition-colors ${
                      kind === opt.value
                        ? 'bg-sky-950/50 text-sky-200 ring-1 ring-inset ring-sky-600/40'
                        : 'bg-dh-raised text-dh-muted hover:bg-dh-hover hover:text-dh'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {kind === 'standard' ? (
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoStandard}
                  onChange={(e) => setAutoStandard(e.target.checked)}
                  className="rounded border-dh-strong"
                />
                <span className="text-sm text-dh">Auto-advance on PC action rolls (−1)</span>
              </label>
            ) : null}
            {kind === 'progress' || kind === 'consequence' ? (
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoDynamic}
                  onChange={(e) => setAutoDynamic(e.target.checked)}
                  className="rounded border-dh-strong"
                />
                <span className="text-sm text-dh">Auto-advance on dynamic DC chart</span>
              </label>
            ) : null}

            <div>
              <span className="text-xs font-semibold text-dh-muted" id="session-countdown-looping-label">
                Looping
              </span>
              <div
                className="mt-1 grid w-full max-w-xl grid-cols-2 overflow-hidden rounded-md border border-dh-strong shadow-sm divide-x divide-y divide-dh-strong sm:grid-cols-4 sm:divide-y-0"
                role="group"
                aria-labelledby="session-countdown-looping-label"
              >
                {COUNTDOWN_LOOPING_MODES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLooping(value)}
                    aria-pressed={looping === value}
                    className={`min-w-0 px-2 py-1.5 text-sm font-medium transition-colors ${
                      looping === value
                        ? 'bg-sky-950/50 text-sky-200 ring-1 ring-inset ring-sky-600/40'
                        : 'bg-dh-raised text-dh-muted hover:bg-dh-hover hover:text-dh'
                    }`}
                  >
                    {COUNTDOWN_LOOPING_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-dh-muted">
                After the effect triggers, click Loop on the card. Increasing/decreasing adjust the start by 1 (floor 0).
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-dh-muted">Start</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={startFormula}
                  onChange={(e) => handleFormulaChange(e.target.value)}
                  className="w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh tabular-nums outline-none focus:border-dh-strong"
                  placeholder="8 or 1d4"
                  spellCheck={false}
                  aria-label="Start"
                />
                {onRollStart && formulaIsDice ? (
                  <button
                    type="button"
                    disabled={rolling}
                    onClick={handleRollStartClick}
                    className="shrink-0 rounded-lg border border-dh-hope/40 px-3 py-2 text-sm font-semibold text-dh-hope hover:bg-dh-hover disabled:opacity-50"
                  >
                    Roll start
                  </button>
                ) : null}
              </div>
              {formulaIsDice && startPending ? (
                <p className="mt-1 text-[10px] text-amber-400/90">Not rolled yet — shown as {formulaTrimmed} until you roll.</p>
              ) : (
                <p className="mt-1 text-[10px] leading-snug text-dh-muted">
                  A number is the start. Dice (`1d4`) stay a formula until rolled; Loop re-rolls them.
                </p>
              )}
            </label>

            {showElaboratedStart || showCurrent ? (
              <div className={`grid gap-3 ${showElaboratedStart && showCurrent ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {showElaboratedStart ? (
                  <label className="block">
                    <span className="text-xs font-semibold text-dh-muted">
                      {formulaIsDice ? 'Last roll' : 'Starting value'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={start}
                      onChange={(e) => {
                        setStart(e.target.value === '' ? 0 : Number(e.target.value));
                        if (formulaIsDice) setStartPending(false);
                      }}
                      className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh tabular-nums outline-none focus:border-dh-strong"
                    />
                  </label>
                ) : null}
                {showCurrent ? (
                  <label className="block">
                    <span className="text-xs font-semibold text-dh-muted">Current value</span>
                    <input
                      type="number"
                      min={0}
                      value={current}
                      onChange={(e) => setCurrent(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh tabular-nums outline-none focus:border-dh-strong"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              tabIndex={0}
              onClick={() => setVisibility(visibility === 'gm' ? 'players' : 'gm')}
              className="flex items-center gap-2 rounded-lg border border-dh-border bg-dh-raised/60 px-3 py-2 text-left text-sm text-dh hover:bg-dh-hover/60"
            >
              {visibility === 'gm' ? <EyeOff size={18} className="text-dh-muted shrink-0" /> : <Eye size={18} className="text-dh-muted shrink-0" />}
              <span>{visibility === 'gm' ? 'GM only (hidden from players)' : 'Visible to players'}</span>
            </button>

            {row.sourceRef ? (
              <p className="text-[11px] text-emerald-500/90">Linked to feature text — values stay in sync with the table where applicable.</p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-dh-border pt-3">
              <button
                type="button"
                tabIndex={0}
                onClick={handleSave}
                className="rounded-lg bg-dh-hope/90 px-4 py-2 text-sm font-semibold text-dh-canvas hover:bg-dh-hope"
              >
                Save
              </button>
              <button
                type="button"
                tabIndex={0}
                onClick={onClose}
                className="rounded-lg border border-dh-border px-4 py-2 text-sm text-dh-muted hover:bg-dh-hover/60"
              >
                Cancel
              </button>
              <button
                type="button"
                tabIndex={0}
                onClick={handleRemove}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-800/60 px-3 py-2 text-sm text-red-300 hover:bg-red-950/40"
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>
        </div>

        <aside
          className="min-h-0 w-full shrink-0 overflow-y-auto border-t border-dh-border bg-dh-raised/20 px-3 py-3 lg:w-[min(22rem,100%)] lg:border-l lg:border-t-0"
          aria-label="Roll outcome reference"
        >
          <CountdownRollReferencePanel kind={kind} autoStandard={autoStandard} autoDynamic={autoDynamic} />
        </aside>
      </div>
    </FullPageOverlay>
  );
}
