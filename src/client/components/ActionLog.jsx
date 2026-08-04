import { useEffect, useRef, useState } from 'react';
import { Dices, ChevronUp, ChevronDown } from 'lucide-react';
import { ManualDiceBuilder } from './ManualDiceBuilder.jsx';
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

function LogEntry({ roll, compact }) {
  const isAction = !!roll._action;
  const isCompound = Array.isArray(roll.subItems) && roll.subItems.length > 0;
  const time = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className={
        compact
          ? 'px-2 py-1 rounded bg-dh-raised/60 flex items-center gap-2 max-w-[min(20rem,55vw)] shrink-0 min-w-0'
          : 'px-2 py-1 rounded bg-dh-raised/60 flex items-baseline gap-2'
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
    </div>
  );
}

/**
 * Collapsed footer bar that opens action/roll history as an overlay above itself.
 * rolls — array of roll and action notification objects (maintained by GMTableView)
 * rollBuilder — optional { onRoll(rollText, displayName), displayName }; when present, shows dice builder (GM and players)
 */
const STRIP_MAX_ROLLS = 16;

export function ActionLog({ rolls = [], rollBuilder }) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef(null);
  const stripScrollRef = useRef(null);
  const overlayRef = useRef(null);

  const stripRolls = rolls.slice(-STRIP_MAX_ROLLS);

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

  return (
    // Wrapper is relative so the overlay can anchor over the bar
    <div className="relative shrink-0" ref={overlayRef}>
      {/* Overlay panel — anchored at bottom:0 so it covers the footer bar itself */}
      {open && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 bg-dh-canvas border border-dh-strong border-b-0 rounded-t-lg shadow-2xl flex flex-col"
          style={{ height: 'min(680px, 85vh)' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); } }}
            className="flex items-center gap-2 px-3 py-2 border-b border-dh-border/60 shrink-0 cursor-pointer"
          >
            <Dices size={12} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-semibold text-dh flex-1">Action Log and Dice Roller</span>
            <span className="text-[10px] text-dh-muted">{rolls.length} entr{rolls.length === 1 ? 'y' : 'ies'}</span>
            <span className="ml-1 text-dh-muted hover:text-dh transition-colors" aria-hidden>
              <ChevronDown size={12} />
            </span>
          </div>
          {rollBuilder && (
            <div className="px-3 py-2 border-b border-dh-border bg-dh-surface/50 shrink-0">
              <ManualDiceBuilder rollBuilder={rollBuilder} onRolled={() => setOpen(false)} />
            </div>
          )}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 min-h-0"
          >
            {rolls.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[10px] text-dh-muted italic">
                No actions yet this session
              </div>
            ) : (
              rolls.map((roll, i) => <LogEntry key={roll._logId || i} roll={roll} />)
            )}
          </div>
        </div>
      )}

      {/* Collapsed footer — one row; same LogEntry styling as overlay, horizontal scroll */}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Action log and dice roller"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 pl-2 pr-3 py-1.5 border-t border-dh-border bg-dh-canvas hover:bg-dh-surface transition-colors cursor-pointer group text-left min-h-0"
      >
        <Dices size={12} className="text-red-400 shrink-0" aria-hidden />
        <span className="text-[10px] font-semibold text-dh-muted group-hover:text-dh shrink-0 hidden sm:inline">
          Log
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
                />
              ))
            )}
          </div>
        </div>
        <span className="text-[10px] text-dh-muted shrink-0 tabular-nums">
          {rolls.length} entr{rolls.length === 1 ? 'y' : 'ies'}
        </span>
        <ChevronUp
          size={12}
          className={`text-dh-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
