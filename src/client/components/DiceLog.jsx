import { useEffect, useRef } from 'react';
import { Dices } from 'lucide-react';

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
    <div className="px-2 py-1.5 rounded bg-slate-800/60">
      <div className="flex items-baseline gap-1.5">
        <span className="font-semibold text-xs text-red-400 truncate max-w-[120px]">{roll.rollUser || 'Unknown'}</span>
        {time && <span className="text-[10px] text-slate-500 shrink-0 tabular-nums ml-auto">{time}</span>}
      </div>
      <div className="mt-0.5 font-mono text-xs">
        {isCompound && <CompoundRoll subItems={roll.subItems} />}
        {!isCompound && <span className="text-slate-400 italic">roll</span>}
      </div>
    </div>
  );
}

/**
 * Compact dice history strip. Shows recent rolls from the current session.
 * rolls — array of roll data objects (maintained by GMTableView)
 * compact — always true in the current layout (strip above whiteboard)
 */
export function DiceLog({ rolls = [] }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rolls]);

  return (
    <div className="shrink-0 flex flex-col border-t border-slate-800 bg-slate-950">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-slate-800/60">
        <Dices size={11} className="text-red-400 shrink-0" />
        <span className="text-[11px] font-medium text-slate-400 flex-1">Dice Log</span>
      </div>
      <div
        ref={scrollRef}
        className="h-24 overflow-y-auto px-2 py-1.5 space-y-0.5"
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
  );
}
