import { useState, useEffect, useRef } from 'react';
import { Dices, ExternalLink, RefreshCw } from 'lucide-react';
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
// Returns { total, hopeResult, fearResult, dominant: 'hope'|'fear'|'critical' } or null.
function parseDaggerheartRoll(subItems) {
  let hopeResult = null;
  let fearResult = null;
  let total = 0;

  for (const sub of subItems) {
    const result = parseInt(sub.result, 10);
    if (isNaN(result)) continue;
    total += result;
    if (/hope/i.test(sub.pre || '')) hopeResult = result;
    else if (/fear/i.test(sub.pre || '')) fearResult = result;
  }

  if (hopeResult === null || fearResult === null) return null;

  const dominant =
    hopeResult === fearResult ? 'critical' : hopeResult > fearResult ? 'hope' : 'fear';
  return { total, hopeResult, fearResult, dominant };
}

// Render a compound roll stored in item.items[]:
// Each sub-item has: pre, input, result, details, post
function CompoundRoll({ subItems }) {
  const dh = parseDaggerheartRoll(subItems);

  return (
    <span>
      {subItems.map((sub, i) => (
        <span key={i}>
          {sub.pre
            ? <span className="text-slate-300">{sub.pre}</span>
            : (i > 0 && sub.input ? ' ' : null)
          }
          {sub.input && (
            <>
              <span className="text-yellow-400 font-bold">[</span>
              <span className="text-yellow-300">{sub.input} </span>
              <span className="text-slate-500">= </span>
              <span className="text-green-400 font-bold">{sub.result}</span>
              <span className="text-yellow-400 font-bold">]</span>
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
              <span className={dh.dominant === 'hope' ? 'text-sky-300 font-semibold' : 'text-purple-300 font-semibold'}>
                {dh.dominant === 'hope' ? 'Hope' : 'Fear'}
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

// Render a simple top-level dicemsg: input = result (details)
function SimpleRoll({ item }) {
  return (
    <span>
      <span className="text-yellow-400 font-bold">[</span>
      <span className="text-yellow-300">{item.input} </span>
      <span className="text-slate-500">= </span>
      <span className="text-green-400 font-bold">{item.result}</span>
      <span className="text-yellow-400 font-bold">]</span>
      {item.details && <span className="text-slate-500 ml-1">{item.details}</span>}
    </span>
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

export function RolzRoomLog({ roomName, lastRollTime }) {
  const [items, setItems] = useState([]);
  const [motd, setMotd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastKeyRef = useRef(null);
  const eagerUntilRef = useRef(0);
  const pollTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  const fetchLog = async (isInitial = false) => {
    try {
      const data = await fetchRolzRoomLog(roomName);
      if (data.room?.data?.motd) setMotd(data.room.data.motd);

      const newItems = (data.items || [])
        .filter(hasContent)
        .slice()
        .reverse();

      const latestKey = newItems.length > 0 ? newItems[0].key : null;
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

    fetchLog(true).then(() => scheduleNext());

    return () => {
      isMountedRef.current = false;
      clearTimeout(pollTimeoutRef.current);
    };
  }, [roomName]);

  // Activate eager polling when a roll is posted.
  useEffect(() => {
    if (!lastRollTime || !roomName) return;
    eagerUntilRef.current = Date.now() + EAGER_TIMEOUT;
    // Kick off an immediate poll so we don't wait for the next scheduled one.
    clearTimeout(pollTimeoutRef.current);
    const run = async () => {
      if (!isMountedRef.current) return;
      const gotNew = await fetchLog(false);
      if (gotNew) eagerUntilRef.current = 0;
      scheduleNext();
    };
    run();
  }, [lastRollTime]);

  const handleRefresh = () => {
    clearTimeout(pollTimeoutRef.current);
    fetchLog(false).then(() => scheduleNext());
  };

  if (!roomName) {
    return (
      <div className="flex-1 min-h-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2 px-4">
        <Dices size={32} className="opacity-40" />
        <p className="text-sm text-center">Configure a Rolz room above.</p>
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

      {/* Messages — newest first */}
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
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            No messages yet.
          </div>
        )}
        {items.map(item => (
          <RolzMessage key={item.key || item.time} item={item} />
        ))}
      </div>
    </div>
  );
}
