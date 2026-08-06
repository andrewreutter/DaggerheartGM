import { useEffect, useRef, useState } from 'react';
import { Dices, ChevronUp, RotateCcw } from 'lucide-react';
import { ManualDiceBuilder } from './ManualDiceBuilder.jsx';
import { MANUAL_DICE_SIZES } from '../lib/manual-dice-roll-text.js';
import { isReactionRoll } from '../lib/reaction-roll-display.js';

// Per-sub-item accent colors: Hope → amber, Fear → purple, damage → red, else sky/green
// Reaction rolls (SRD: Reaction Rolls) don't generate Hope or Fear, so their Hope/Fear dice
// use the neutral scheme instead of the amber/purple Hope/Fear accents.
function subItemColor(pre, isReaction) {
  const p = (pre || '').toLowerCase();
  if (!isReaction) {
    if (/hope/.test(p)) return { label: 'text-dh-hope-soft', bracket: 'text-dh-hope', expr: 'text-dh-hope', result: 'text-dh font-bold' };
    if (/fear/.test(p)) return { label: 'text-purple-400', bracket: 'text-purple-500', expr: 'text-purple-300', result: 'text-purple-300 font-bold' };
  }
  if (/damage|dmg/.test(p)) return { label: 'text-red-400',    bracket: 'text-red-500',    expr: 'text-red-300',    result: 'text-red-300 font-bold' };
  return { label: 'text-dh', bracket: 'text-sky-400', expr: 'text-sky-300', result: 'text-green-400 font-bold' };
}

// Detect Daggerheart Hope/Fear structure from subItems
function parseDaggerheartRoll(subItems) {
  let hopeResult = null;
  let fearResult = null;
  let total = 0;
  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    const result = parseInt(sub.result, 10);
    if (isNaN(result)) continue;
    total += result;
    if (/hope/i.test(sub.pre || '')) hopeResult = result;
    else if (/fear/i.test(sub.pre || '')) fearResult = result;
  }
  if (hopeResult === null || fearResult === null) return null;
  const dominant = hopeResult === fearResult ? 'critical' : hopeResult > fearResult ? 'hope' : 'fear';
  return { total, hopeResult, fearResult, dominant };
}

function CompoundRoll({ subItems, isReaction }) {
  const dh = parseDaggerheartRoll(subItems);
  const actionItems = subItems.filter(s => !/damage/i.test(s.pre || ''));
  const damageItems = subItems.filter(s => /damage/i.test(s.pre || ''));

  return (
    <span>
      {actionItems.map((sub, i) => {
        const c = subItemColor(sub.pre, isReaction);
        return (
          <span key={i}>
            {sub.pre
              ? <span className={c.label}>{sub.pre}</span>
              : (i > 0 && sub.input ? ' ' : null)
            }
            {sub.input && (
              <>
                <span className={`${c.bracket} font-bold`}>[</span>
                <span className={c.expr}>{sub.input} </span>
                <span className="text-dh-muted">= </span>
                <span className={c.result}>{sub.result || '…'}</span>
                <span className={`${c.bracket} font-bold`}>]</span>
              </>
            )}
            {sub.post && <span className="text-dh">{sub.post}</span>}
          </span>
        );
      })}
      {dh && (
        <span className="ml-1">
          <span className="text-dh-muted">= </span>
          <span className="text-white font-bold">{dh.total}</span>
          {dh.dominant === 'critical' ? (
            <span className="text-yellow-300 font-semibold"> Critical!</span>
          ) : !isReaction ? (
            <>
              <span className="text-dh-muted"> with </span>
              <span className={dh.dominant === 'hope' ? 'text-dh-hope font-semibold' : 'text-purple-400 font-semibold'}>
                {dh.dominant === 'hope' ? 'Hope' : 'Fear'}
              </span>
            </>
          ) : null}
        </span>
      )}
      {damageItems.map((sub, i) => {
        const c = subItemColor(sub.pre);
        return (
          <span key={i}>
            <span className="text-dh-muted"> for </span>
            <span className={`${c.bracket} font-bold`}>[</span>
            <span className={c.expr}>{sub.input} </span>
            <span className="text-dh-muted">= </span>
            <span className={c.result}>{sub.result || '…'}</span>
            <span className={`${c.bracket} font-bold`}>]</span>
            {sub.post && <span className={c.label}>{sub.post}</span>}
            <span className={c.label}> damage</span>
          </span>
        );
      })}
    </span>
  );
}

function LogEntry({ roll, compact, rollBuilder, onRollAgain }) {
  const isAction = !!roll._action;
  const isCompound = Array.isArray(roll.subItems) && roll.subItems.length > 0;
  const time = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const canRollAgain = !isAction && roll.rollText && rollBuilder;

  return (
    <div
      className={
        compact
          ? 'group px-2 py-1 rounded bg-dh-raised/60 flex items-center gap-2 max-w-[min(20rem,55vw)] shrink-0 min-w-0'
          : 'group px-2 py-1 rounded bg-dh-raised/60 flex items-baseline gap-2'
      }
    >
      <div
        className={`flex-1 font-mono text-xs min-w-0 ${compact ? 'truncate whitespace-nowrap overflow-hidden' : ''}`}
      >
        {isAction && (
          <span>
            <span className="text-dh">{(roll.rollUser || roll.characterName || '').trim() || '—'}</span>
            <span className="text-dh-muted">: </span>
            <span className="text-dh font-medium">{roll.actionName || 'Action'}</span>
            {roll.actionText && !compact && (
              <span className="block text-[10px] text-dh-muted mt-0.5 max-w-full whitespace-pre-line break-words">
                {roll.actionText.length > 120 ? roll.actionText.slice(0, 120) + '…' : roll.actionText}
              </span>
            )}
          </span>
        )}
        {!isAction && isCompound && <CompoundRoll subItems={roll.subItems} isReaction={isReactionRoll(roll)} />}
        {!isAction && !isCompound && <span className="text-dh-muted italic">roll</span>}
      </div>
      {time && <span className="text-[10px] text-dh-muted shrink-0 tabular-nums">{time}</span>}
      {/* Roll again affordance — visible on hover when the entry has a rollText */}
      {canRollAgain && (
        compact ? (
          <button
            type="button"
            title="Roll again"
            onClick={(e) => { e.stopPropagation(); onRollAgain(roll); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-surface"
            aria-label="Roll again"
          >
            <RotateCcw size={10} />
          </button>
        ) : (
          <button
            type="button"
            title="Roll again"
            onClick={(e) => { e.stopPropagation(); onRollAgain(roll); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-dh-muted hover:text-dh hover:bg-dh-surface whitespace-nowrap"
            aria-label="Roll again"
          >
            <RotateCcw size={10} />
            Roll again
          </button>
        )
      )}
    </div>
  );
}

/**
 * Persistent title bar (single row, used in both open and collapsed states) that opens
 * action/roll history as an overlay above itself.
 * rolls — array of roll and action notification objects (maintained by GMTableView)
 * rollBuilder — optional { onRoll(rollText, displayName), displayName }; when present, shows dice builder (GM and players)
 */
const STRIP_MAX_ROLLS = 16;

export function ActionLog({ rolls = [], rollBuilder }) {
  const [open, setOpen] = useState(false);
  // When on, the dice builder stays visible even while the full log is collapsed —
  // only the header and scrollable log list hide; the footer strip still shows.
  const [keepDiceOpen, setKeepDiceOpen] = useState(false);
  const scrollRef = useRef(null);
  const stripScrollRef = useRef(null);
  const overlayRef = useRef(null);
  const diceContentRef = useRef(null);
  // Natural (unclipped) rendered height of the dice builder's content, independent of the
  // ancestor's animated max-height/overflow-hidden clip — used to reserve real layout space
  // for it when pinned open (see reservedMapHeight below).
  const [diceContentHeight, setDiceContentHeight] = useState(0);

  // Builder state lifted here so it survives the overlay being closed (ManualDiceBuilder unmounts).
  const [dualityOn, setDualityOn] = useState(false);
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, 0]))
  );
  const [modifier, setModifier] = useState(0);

  const stripRolls = rolls.slice(-STRIP_MAX_ROLLS);

  // The dice builder itself stays mounted whenever the full log is open OR "keep dice open"
  // is checked — this avoids remounting (and reinitializing the 3D preview) every time the
  // log collapses/expands while the checkbox is on.
  const showDiceBuilder = !!rollBuilder && (open || keepDiceOpen);
  // The sliding panel is visible whenever it has anything to show inside it.
  const panelVisible = open || showDiceBuilder;
  // While the log is collapsed but dice are pinned open, the floating panel shows only the
  // dice builder. Reserve that much real (in-flow) layout space above the panel's anchor so
  // the battle map shrinks to make room instead of the panel floating over it. When the full
  // log is open, the panel is a transient overlay again and reserves nothing.
  const reservedMapHeight = (!open && keepDiceOpen) ? diceContentHeight : 0;

  // Track the dice builder's natural content height via ResizeObserver so the reserved space
  // above always matches it exactly, regardless of the ancestor's max-height clip/animation.
  useEffect(() => {
    const el = diceContentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setDiceContentHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rollBuilder]);

  // Auto-scroll to bottom when overlay opens or new entries arrive while open
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rolls, open]);

  // Collapsed strip: keep the viewport pinned to the newest entries (right side)
  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [rolls]);

  // Close overlay when clicking outside of it
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  /** Re-send a log entry's exact original rollText (does not repopulate the builder fields). */
  function handleRollAgain(roll) {
    if (!rollBuilder || !roll?.rollText) return;
    rollBuilder.onRoll(roll.rollText, rollBuilder.displayName);
    setOpen(false);
  }

  return (
    <>
      {/* Reserves real layout space (shrinking the battle map above) equal to the pinned dice
          builder's rendered height, so the floating panel below never has to overlap the map. */}
      <div
        aria-hidden
        className="shrink-0"
        style={{ height: reservedMapHeight, transition: 'height 200ms ease-out' }}
      />
      {/* Wrapper is relative so the panel can anchor above the footer bar */}
      <div className="relative shrink-0" ref={overlayRef}>
        {/* Panel — sits directly above the title bar (never covers it) so the title bar
            strip stays visible underneath whenever the panel is showing dice-only content.
            Each section below (dice builder, full log) stays permanently mounted and
            collapses its own max-height to 0 rather than being conditionally rendered — this
            lets open/close and the "keep dice open" collapse animate smoothly (slide) instead
            of abruptly blinking in/out. */}
        <div
          className={`absolute bottom-full left-0 right-0 z-30 bg-dh-canvas rounded-t-lg flex flex-col overflow-hidden transition-[border-color,box-shadow] duration-200 border ${
            panelVisible ? 'border-dh-strong border-b-0 shadow-2xl' : 'border-transparent shadow-none'
          }`}
        >
          {/* Dice builder — stays mounted and visible whenever the log is open OR "keep dice
              open" is checked, so it never remounts (and reinitializes its 3D preview) merely
              because the full log collapsed/expanded. */}
          {rollBuilder && (
            <div
              className="overflow-hidden shrink-0 transition-[max-height] duration-200 ease-out"
              style={{ maxHeight: showDiceBuilder ? '20rem' : '0px' }}
              aria-hidden={!showDiceBuilder}
            >
              <div ref={diceContentRef} className={`px-3 py-2 bg-dh-surface/50 ${open ? 'border-b border-dh-border' : ''}`}>
                <ManualDiceBuilder
                  rollBuilder={rollBuilder}
                  onRolled={() => setOpen(false)}
                  dualityOn={dualityOn}
                  setDualityOn={setDualityOn}
                  counts={counts}
                  setCounts={setCounts}
                  modifier={modifier}
                  setModifier={setModifier}
                />
              </div>
            </div>
          )}

          {/* Full scrollable log — visible only in the fully-expanded state */}
          <div
            className="overflow-hidden transition-[max-height] duration-200 ease-out"
            style={{ maxHeight: open ? 'min(680px, 85vh)' : '0px' }}
            aria-hidden={!open}
          >
            <div
              ref={scrollRef}
              className="overflow-y-auto px-2 py-1.5 space-y-0.5"
              style={{ maxHeight: 'min(680px, 85vh)' }}
            >
              {rolls.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-[10px] text-dh-muted italic">
                  No actions yet this session
                </div>
              ) : (
                rolls.map((roll, i) => (
                  <LogEntry
                    key={roll._logId || i}
                    roll={roll}
                    rollBuilder={rollBuilder}
                    onRollAgain={handleRollAgain}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Title bar — one persistent row used in both the open and collapsed states (no
            separate expanded header); a plain div (not a <button>) so the "Keep dice open"
            checkbox can nest inside it without invalid interactive-in-interactive HTML. */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label="Action log and dice roller"
          onClick={() => setOpen(v => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
          className="w-full flex items-center gap-2 pl-2 pr-3 py-1.5 border-t border-dh-border bg-dh-canvas hover:bg-dh-surface transition-colors cursor-pointer group text-left min-h-0"
        >
          <ChevronUp
            size={12}
            className={`text-dh-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
          <span className="text-[10px] text-dh-muted shrink-0 tabular-nums">
            {rolls.length} entr{rolls.length === 1 ? 'y' : 'ies'}
          </span>
          <div
            ref={stripScrollRef}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
          >
            <div
              className={
                rolls.length === 0
                  ? 'flex w-full min-w-full justify-center py-0.5'
                  : 'inline-flex w-max min-w-full flex-nowrap items-center justify-end gap-1 py-0.5'
              }
            >
              {rolls.length === 0 ? (
                <div className="text-[10px] italic text-dh-muted/80 px-2 py-1 rounded bg-dh-raised/40">
                  No actions yet this session
                </div>
              ) : (
                stripRolls.map((roll, i) => (
                  <LogEntry
                    key={roll._logId != null ? `${roll._logId}-strip-${i}` : `strip-${i}`}
                    roll={roll}
                    compact
                    rollBuilder={rollBuilder}
                    onRollAgain={handleRollAgain}
                  />
                ))
              )}
            </div>
          </div>
          {rollBuilder && (
            <label
              className="flex items-center gap-1.5 text-[10px] text-dh-muted hover:text-dh cursor-pointer select-none shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={keepDiceOpen}
                onChange={(e) => setKeepDiceOpen(e.target.checked)}
                className="w-3 h-3 rounded border-dh-strong bg-dh-raised text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
              Keep dice open
            </label>
          )}
          <span className="text-[10px] font-semibold text-dh-muted group-hover:text-dh shrink-0 hidden sm:inline">
            Log and Dice
          </span>
          <Dices size={12} className="text-red-400 shrink-0" aria-hidden />
        </div>
      </div>
    </>
  );
}
