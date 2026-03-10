import { useEffect, useRef, useState } from 'react';
import { Dices, ChevronUp, ChevronDown } from 'lucide-react';

// Per-sub-item accent colors: Hope → amber, Fear → purple, damage → red, else sky/green
function subItemColor(pre) {
  const p = (pre || '').toLowerCase();
  if (/hope/.test(p))       return { label: 'text-amber-400',  bracket: 'text-amber-500', expr: 'text-amber-300',  result: 'text-amber-300 font-bold' };
  if (/fear/.test(p))       return { label: 'text-purple-400', bracket: 'text-purple-500', expr: 'text-purple-300', result: 'text-purple-300 font-bold' };
  if (/damage|dmg/.test(p)) return { label: 'text-red-400',    bracket: 'text-red-500',    expr: 'text-red-300',    result: 'text-red-300 font-bold' };
  return { label: 'text-slate-300', bracket: 'text-sky-400', expr: 'text-sky-300', result: 'text-green-400 font-bold' };
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

function CompoundRoll({ subItems }) {
  const dh = parseDaggerheartRoll(subItems);
  const actionItems = subItems.filter(s => !/damage/i.test(s.pre || ''));
  const damageItems = subItems.filter(s => /damage/i.test(s.pre || ''));

  return (
    <span>
      {actionItems.map((sub, i) => {
        const c = subItemColor(sub.pre);
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
                <span className="text-slate-500">= </span>
                <span className={c.result}>{sub.result || '…'}</span>
                <span className={`${c.bracket} font-bold`}>]</span>
              </>
            )}
            {sub.post && <span className="text-slate-300">{sub.post}</span>}
          </span>
        );
      })}
      {dh && (
        <span className="ml-1">
          <span className="text-slate-500">= </span>
          <span className="text-white font-bold">{dh.total}</span>
          {dh.dominant === 'critical' ? (
            <span className="text-yellow-300 font-semibold"> Critical!</span>
          ) : (
            <>
              <span className="text-slate-400"> with </span>
              <span className={dh.dominant === 'hope' ? 'text-amber-400 font-semibold' : 'text-purple-400 font-semibold'}>
                {dh.dominant === 'hope' ? 'Hope' : 'Fear'}
              </span>
            </>
          )}
        </span>
      )}
      {damageItems.map((sub, i) => {
        const c = subItemColor(sub.pre);
        return (
          <span key={i}>
            <span className="text-slate-400"> for </span>
            <span className={`${c.bracket} font-bold`}>[</span>
            <span className={c.expr}>{sub.input} </span>
            <span className="text-slate-500">= </span>
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

function RollEntry({ roll }) {
  const isCompound = Array.isArray(roll.subItems) && roll.subItems.length > 0;
  const time = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="px-2 py-1 rounded bg-slate-800/60 flex items-baseline gap-2">
      <div className="flex-1 font-mono text-xs min-w-0">
        {isCompound && <CompoundRoll subItems={roll.subItems} />}
        {!isCompound && <span className="text-slate-400 italic">roll</span>}
      </div>
      {time && <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">{time}</span>}
    </div>
  );
}

/**
 * Collapsed footer bar that opens dice history as an overlay above itself.
 * rolls — array of roll data objects (maintained by GMTableView)
 */
export function DiceLog({ rolls = [] }) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef(null);
  const overlayRef = useRef(null);

  // Auto-scroll to bottom when overlay opens or new rolls arrive while open
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rolls, open]);

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

  const latestRoll = rolls[rolls.length - 1];

  return (
    // Wrapper is relative so the overlay can anchor over the bar
    <div className="relative shrink-0" ref={overlayRef}>
      {/* Overlay panel — anchored at bottom:0 so it covers the footer bar itself */}
      {open && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 bg-slate-950 border border-slate-700 border-b-0 rounded-t-lg shadow-2xl flex flex-col"
          style={{ height: '400px' }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); } }}
            className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60 shrink-0 cursor-pointer"
          >
            <Dices size={12} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-300 flex-1">Dice Log</span>
            <span className="text-[10px] text-slate-500">{rolls.length} roll{rolls.length !== 1 ? 's' : ''}</span>
            <span className="ml-1 text-slate-500 hover:text-slate-300 transition-colors" aria-hidden>
              <ChevronDown size={12} />
            </span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 min-h-0"
          >
            {rolls.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[10px] text-slate-600 italic">
                No rolls yet this session
              </div>
            ) : (
              rolls.map((roll, i) => <RollEntry key={roll._logId || i} roll={roll} />)
            )}
          </div>
        </div>
      )}

      {/* Collapsed footer bar — always visible (hidden behind overlay when open) */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 border-t border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors cursor-pointer group"
      >
        <Dices size={11} className="text-red-400 shrink-0" />
        <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-300 flex-1 text-left">Dice Log</span>
        {rolls.length > 0 && latestRoll && (
          <span className="text-[10px] text-slate-500 truncate max-w-[40%] font-mono">
            {latestRoll.rollUser ? `${latestRoll.rollUser}: ` : ''}
            {latestRoll.total != null ? latestRoll.total : ''}
          </span>
        )}
        <span className="text-[10px] text-slate-500 shrink-0">{rolls.length} roll{rolls.length !== 1 ? 's' : ''}</span>
        <ChevronUp
          size={11}
          className={`text-slate-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  );
}
