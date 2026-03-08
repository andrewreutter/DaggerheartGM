import { useState, useEffect, useRef, useMemo } from 'react';
import { Dices, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { fetchRolzRoomLog } from '../lib/api.js';

const IDLE_INTERVAL = 60_000;
const EAGER_INTERVAL = 2_000;
const EAGER_TIMEOUT = 15_000;

function formatTime(unixTime) {
  try {
    const d = new Date(parseInt(unixTime, 10) * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Strip HTML tags and extract text content after the "|" separator in from_html.
// e.g. ' <span>|</span> gamemaster' → 'gamemaster'
function extractCharacterName(fromHtml) {
  if (!fromHtml) return null;
  const stripped = fromHtml.replace(/<[^>]+>/g, '').replace('|', '').trim();
  return stripped || null;
}

// Check whether an item has any displayable content.
function hasContent(item) {
  if (item.type === 'timeinfo' || item.type === 'srvmsg') return true;
  if (Array.isArray(item.items) && item.items.length > 0) return true;
  if (item.input) return true;
  if (item.text) return true;
  if (item.comment) return true;
  return false;
}

// Detect if sub-items represent a Daggerheart Hope/Fear dual-roll.
// Returns { total, hopeResult, fearResult, dominant: 'hope'|'fear'|'critical', characterName: string|null } or null.
// Damage sub-items (pre matches /damage/i) are excluded from the action total.
// characterName is extracted from the Hope die's pre label, which the app formats as
// "{characterName} {traitName} Hope" — strip "Hope" and the trailing trait word to get the name.
function parseDaggerheartRoll(subItems) {
  let hopeResult = null;
  let fearResult = null;
  let hopePre = null;
  let total = 0;

  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    const result = parseInt(sub.result, 10);
    if (isNaN(result)) continue;
    total += result;
    if (/hope/i.test(sub.pre || '')) { hopeResult = result; hopePre = sub.pre; }
    else if (/fear/i.test(sub.pre || '')) fearResult = result;
  }

  if (hopeResult === null || fearResult === null) return null;

  // Extract character name from "{characterName} {traitName} Hope " pattern.
  let characterName = null;
  if (hopePre) {
    const withoutHope = hopePre.replace(/\s*hope\s*/i, '').trim();
    const words = withoutHope.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      words.pop(); // remove trailing trait word
      characterName = words.join(' ');
    }
  }

  const dominant =
    hopeResult === fearResult ? 'critical' : hopeResult > fearResult ? 'hope' : 'fear';
  return { total, hopeResult, fearResult, dominant, characterName };
}

// Render a compound roll stored in item.items[]:
// Each sub-item has: pre, input, result, details, post
// Damage sub-items (pre matches /damage/i) are rendered after the Hope/Fear summary.
function CompoundRoll({ subItems }) {
  const dh = parseDaggerheartRoll(subItems);
  const actionItems = subItems.filter(s => !/damage/i.test(s.pre || ''));
  const damageItems = subItems.filter(s => /damage/i.test(s.pre || ''));

  return (
    <span>
      {actionItems.map((sub, i) => (
        <span key={i}>
          {sub.pre
            ? <span className="text-slate-300">{sub.pre}</span>
            : (i > 0 && sub.input ? ' ' : null)
          }
          {sub.input && (
            <>
              <span className="text-sky-400 font-bold">[</span>
              <span className="text-sky-300">{sub.input} </span>
              <span className="text-slate-500">= </span>
              <span className="text-green-400 font-bold">{sub.result}</span>
              <span className="text-sky-400 font-bold">]</span>
            </>
          )}
          {sub.post && <span className="text-slate-300">{sub.post}</span>}
        </span>
      ))}
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
          {damageItems.map((sub, i) => (
            <span key={i}>
              <span className="text-slate-400"> for </span>
              <span className="text-sky-400 font-bold">[</span>
              <span className="text-sky-300">{sub.input} </span>
              <span className="text-slate-500">= </span>
              <span className="text-yellow-300 font-bold">{sub.result}</span>
              <span className="text-sky-400 font-bold">]</span>
              {sub.post && <span className="text-slate-400">{sub.post}</span>}
              <span className="text-slate-400"> damage</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

// Render a simple top-level dicemsg: input = result (details)
function SimpleRoll({ item }) {
  return (
    <span>
      <span className="text-sky-400 font-bold">[</span>
      <span className="text-sky-300">{item.input} </span>
      <span className="text-slate-500">= </span>
      <span className="text-green-400 font-bold">{item.result}</span>
      <span className="text-sky-400 font-bold">]</span>
      {item.details && <span className="text-slate-500 ml-1">{item.details}</span>}
    </span>
  );
}

// Check whether a real Rolz dicemsg matches a pending roll's displayName.
// The displayName is the leading plain text before the first dice expression.
function matchesPendingRoll(item, displayName) {
  const dn = displayName.toLowerCase();
  if (Array.isArray(item.items) && item.items.length > 0) {
    const pre = (item.items[0]?.pre || '').toLowerCase().trimEnd();
    if (pre.startsWith(dn)) return true;
    // Fallback: full text reconstruction
    const full = item.items.map(s => [s.pre, s.input, s.post].filter(Boolean).join('')).join('').toLowerCase();
    if (full.startsWith(dn)) return true;
  }
  if (item.text) return item.text.toLowerCase().startsWith(dn);
  return false;
}

function PendingRollPlaceholder({ roll }) {
  const bracketIdx = roll.rollText.indexOf('[');
  const prefix = bracketIdx > 0 ? roll.rollText.slice(0, bracketIdx) : roll.rollText;
  const diceExpr = bracketIdx > 0 ? roll.rollText.slice(bracketIdx) : '';

  return (
    <div className="px-2 py-1.5 rounded bg-slate-800/60 border border-amber-700/40 pending-roll-pulse">
      <div className="flex items-baseline gap-1.5">
        <span className="font-semibold text-xs text-red-400">{roll.displayName}</span>
        <span className="text-[10px] text-amber-500/70 italic ml-auto tabular-nums">rolling…</span>
      </div>
      <div className="mt-0.5 font-mono text-xs">
        <span className="text-slate-300">{prefix}</span>
        {diceExpr && <span className="text-slate-600">{diceExpr}</span>}
      </div>
    </div>
  );
}

function RolzMessage({ item }) {
  const time = formatTime(item.time);
  const characterName = extractCharacterName(item.from_html);

  if (item.type === 'timeinfo') {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <div className="flex-1 border-t border-slate-800" />
        <span className="text-[10px] text-slate-600 shrink-0">{item.h_time || item.text || ''}</span>
        <div className="flex-1 border-t border-slate-800" />
      </div>
    );
  }

  if (item.type === 'srvmsg') {
    return (
      <div className="text-[11px] text-slate-600 italic py-0.5 px-2">
        {time && <span className="text-slate-500 mr-1.5">{time}</span>}
        {item.text}
      </div>
    );
  }

  const isCompound = Array.isArray(item.items) && item.items.length > 0;
  const isSimpleDice = item.type === 'dicemsg' && item.input;
  const isDice = isCompound || isSimpleDice;
  const displayName = characterName || item.from;

  return (
    <div className={`px-2 py-1.5 rounded ${isDice ? 'bg-slate-800/60' : ''}`}>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-semibold text-xs ${isDice ? 'text-red-400' : 'text-blue-400'}`}>
          {displayName}
        </span>
        {characterName && item.from && (
          <span className="text-[10px] text-slate-500">{item.from}</span>
        )}
        {time && <span className="text-[10px] text-slate-400 shrink-0 tabular-nums ml-auto">{time}</span>}
      </div>
      <div className="mt-0.5 font-mono text-xs">
        {isCompound && <CompoundRoll subItems={item.items} />}
        {!isCompound && isSimpleDice && <SimpleRoll item={item} />}
        {!isCompound && !isSimpleDice && item.text && (
          <span className="text-slate-300 font-sans">{item.text}</span>
        )}
      </div>
    </div>
  );
}

export function RolzRoomLog({ roomName, pendingRolls = [], compact = false, onConfigOpen, onDaggerheartRoll }) {
  const [items, setItems] = useState([]);
  const [motd, setMotd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedIds, setResolvedIds] = useState(new Set());
  const lastKeyRef = useRef(null);
  const compactScrollRef = useRef(null);
  const eagerUntilRef = useRef(0);
  const pollTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);
  const processedKeysRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const onDaggerheartRollRef = useRef(onDaggerheartRoll);
  useEffect(() => { onDaggerheartRollRef.current = onDaggerheartRoll; }, [onDaggerheartRoll]);

  // Derive the timestamp of the most-recently added pending roll to trigger eager polling.
  const latestAddedAt = useMemo(
    () => pendingRolls.reduce((max, p) => Math.max(max, p.addedAt), 0),
    [pendingRolls]
  );

  // Placeholders: pending rolls that haven't been resolved yet.
  const activePending = useMemo(
    () => pendingRolls.filter(p => !resolvedIds.has(p.id)),
    [pendingRolls, resolvedIds]
  );

  // Prune resolvedIds to only IDs still in pendingRolls (prevents unbounded growth).
  useEffect(() => {
    if (resolvedIds.size === 0) return;
    const currentIds = new Set(pendingRolls.map(p => p.id));
    setResolvedIds(prev => {
      const pruned = new Set([...prev].filter(id => currentIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [pendingRolls]);

  const fetchLog = async (isInitial = false) => {
    try {
      const data = await fetchRolzRoomLog(roomName);
      if (data.room?.data?.motd) setMotd(data.room.data.motd);

      const newItems = (data.items || [])
        .filter(hasContent)
        .slice(); // chronological: oldest first, newest last

      const latestKey = newItems.length > 0 ? newItems[newItems.length - 1].key : null;
      const gotNew = latestKey !== lastKeyRef.current;
      if (gotNew) {
        setItems(newItems);
        lastKeyRef.current = latestKey;
      }
      setError(null);
      return gotNew;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const scheduleNext = () => {
    if (!isMountedRef.current) return;
    const isEager = Date.now() < eagerUntilRef.current;
    pollTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      const gotNew = await fetchLog(false);
      if (gotNew) eagerUntilRef.current = 0;
      scheduleNext();
    }, isEager ? EAGER_INTERVAL : IDLE_INTERVAL);
  };

  useEffect(() => {
    if (!roomName) return;
    isMountedRef.current = true;
    setLoading(true);
    setItems([]);
    setError(null);
    lastKeyRef.current = null;
    eagerUntilRef.current = 0;
    processedKeysRef.current = new Set();
    isInitialLoadRef.current = true;

    fetchLog(true).then(() => scheduleNext());

    return () => {
      isMountedRef.current = false;
      clearTimeout(pollTimeoutRef.current);
    };
  }, [roomName]);

  // Fire onDaggerheartRoll for newly arrived Hope/Fear rolls.
  // On initial load, mark all existing items as seen without firing.
  useEffect(() => {
    if (!items.length) return;

    if (isInitialLoadRef.current) {
      items.forEach(item => processedKeysRef.current.add(item.key || item.time));
      isInitialLoadRef.current = false;
      return;
    }

    for (const item of items) {
      const key = item.key || item.time;
      if (processedKeysRef.current.has(key)) continue;
      processedKeysRef.current.add(key);

      if (!Array.isArray(item.items) || item.items.length === 0) continue;
      const dh = parseDaggerheartRoll(item.items);
      if (!dh) continue;

      const cb = onDaggerheartRollRef.current;
      if (!cb) continue;

      // Prefer the character name extracted from the roll's Hope die pre label
      // (format: "{characterName} {traitName} Hope"). Fall back to the Rolz account name.
      const fromName = extractCharacterName(item.from_html);
      const rollUser = dh.characterName || fromName || item.from || '';
      cb(dh.dominant, rollUser);
    }
  }, [items]);

  // Activate eager polling when a new pending roll is added.
  useEffect(() => {
    if (!latestAddedAt || !roomName) return;
    eagerUntilRef.current = Date.now() + EAGER_TIMEOUT;
    clearTimeout(pollTimeoutRef.current);
    const run = async () => {
      if (!isMountedRef.current) return;
      const gotNew = await fetchLog(false);
      if (gotNew) eagerUntilRef.current = 0;
      scheduleNext();
    };
    run();
  }, [latestAddedAt]);

  // Match newly-arrived Rolz items against unresolved pending rolls by displayName.
  // Each dicemsg can only resolve one pending roll (handles same-name duplicates in flight).
  useEffect(() => {
    if (!items.length || !pendingRolls.length) return;
    const unresolved = pendingRolls.filter(p => !resolvedIds.has(p.id));
    if (!unresolved.length) return;
    const newlyResolved = new Set();
    const consumedItemKeys = new Set();
    const recentDice = items.filter(i => (Array.isArray(i.items) && i.items.length > 0) || (i.type === 'dicemsg' && i.input));
    for (const pending of unresolved) {
      for (const item of recentDice) {
        const itemKey = item.key || item.time;
        if (consumedItemKeys.has(itemKey)) continue;
        if (matchesPendingRoll(item, pending.displayName)) {
          newlyResolved.add(pending.id);
          consumedItemKeys.add(itemKey);
          break;
        }
      }
    }
    if (newlyResolved.size > 0) {
      setResolvedIds(prev => new Set([...prev, ...newlyResolved]));
    }
  }, [items]);

  const handleRefresh = () => {
    clearTimeout(pollTimeoutRef.current);
    fetchLog(false).then(() => scheduleNext());
  };

  // Auto-scroll to bottom in compact strip mode when new messages arrive.
  useEffect(() => {
    if (!compact || !compactScrollRef.current) return;
    compactScrollRef.current.scrollTop = compactScrollRef.current.scrollHeight;
  }, [compact, items, activePending]);

  if (!roomName) {
    return (
      <div className="flex-1 min-h-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2 px-4">
        <Dices size={32} className="opacity-40" />
        <p className="text-sm text-center">Configure a Rolz room above.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="shrink-0 flex flex-col border-t border-slate-800 bg-slate-950">
        {/* Slim strip header */}
        <div className="flex items-center gap-2 px-3 py-1 border-b border-slate-800/60">
          <Dices size={11} className="text-red-400 shrink-0" />
          <span className="text-[11px] font-medium text-slate-400 truncate flex-1">{roomName}</span>
          <button
            onClick={handleRefresh}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
          <a
            href={`https://rolz.org/dr?room=${encodeURIComponent(roomName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-400 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={10} />
          </a>
          {onConfigOpen && (
            <button
              onClick={onConfigOpen}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Configure"
            >
              <Settings size={10} />
            </button>
          )}
        </div>
        {/* Messages strip — fixed height, chronological, auto-scrolls to bottom */}
        <div ref={compactScrollRef} className="h-24 overflow-y-auto px-2 py-1 space-y-0.5">
          {loading && (
            <div className="text-slate-600 text-xs py-2 text-center">Loading...</div>
          )}
          {items.map(item => (
            <RolzMessage key={item.key || item.time} item={item} />
          ))}
          {activePending.map(p => (
            <PendingRollPlaceholder key={p.id} roll={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Dices size={14} className="text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-white truncate">{roomName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <a
            href={`https://rolz.org/dr?room=${encodeURIComponent(roomName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-400 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* MOTD */}
      {motd && (
        <div className="shrink-0 px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-500 italic">
          {motd}
        </div>
      )}

      {/* Messages — chronological: oldest first, newest last; pending at bottom */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0.5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Loading room log...
          </div>
        )}
        {error && !loading && (
          <div className="text-center py-8 text-red-400/70 text-sm">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && activePending.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            No messages yet.
          </div>
        )}
        {items.map(item => (
          <RolzMessage key={item.key || item.time} item={item} />
        ))}
        {activePending.map(p => (
          <PendingRollPlaceholder key={p.id} roll={p} />
        ))}
      </div>
    </div>
  );
}
