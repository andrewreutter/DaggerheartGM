import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Loader2, Radio, RefreshCw } from 'lucide-react';
import { fetchRedditQueue, fetchRedditQueueCounts, setRedditItemStatus, parseRedditItem, saveMirrorItem, triggerRedditScan } from '../lib/api.js';
import { ImportPreviewCard } from './modals/ImportPreviewCard.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';

const RESERVED_STATUSES = new Set(['needs_review', 'parsed', 'failed']);

const PARSE_METHOD_BADGES = {
  text:    { label: 'Text',    cls: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  ocr:     { label: 'OCR',     cls: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  llm:     { label: 'AI',      cls: 'bg-violet-900/60 text-violet-300 border-violet-700' },
  partial: { label: 'Partial', cls: 'bg-amber-900/60 text-amber-300 border-amber-700' },
};

// ---------------------------------------------------------------------------
// Single queue card
// ---------------------------------------------------------------------------

function QueueCard({ item, activeTab, existingTags, onStatusChange, onItemUpdate }) {
  const [detailOpen, setDetailOpen] = useState(false);

  const parseMethodBadge = item._parseMethod ? PARSE_METHOD_BADGES[item._parseMethod] : null;

  const handleDetailSave = async (formData) => {
    try {
      const toSave = { ...item, ...formData, is_public: true, _redditStatus: item._redditStatus };
      await saveMirrorItem(item.collection, toSave);
      onItemUpdate(toSave);
    } catch (err) {
      console.error('[queue] Detail save failed:', err);
    }
  };

  const redditTriage = {
    activeTab,
    existingTags,
    onApprove: async () => {
      await onStatusChange(item, 'parsed');
      setDetailOpen(false);
    },
    onAssign: async (tag) => {
      await onStatusChange(item, tag);
      setDetailOpen(false);
    },
    onReparse: async (forceLlm = false) => {
      try {
        const { item: parsed, _parseMethod } = await parseRedditItem(item.collection, item, { forceLlm, reparse: true });
        onItemUpdate({ ...item, ...parsed, _parseMethod });
      } catch (err) {
        console.error('[queue] Reparse failed:', err);
      }
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
      {/* Header: subreddit + flair + score */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
        {item._redditSubreddit && (
          <span className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400">
            r/{item._redditSubreddit}
          </span>
        )}
        {item._redditFlair && (
          <span className="bg-orange-900/40 border border-orange-700/60 text-orange-300 rounded px-1.5 py-0.5">
            {item._redditFlair}
          </span>
        )}
        {parseMethodBadge && (
          <span className={`border rounded px-1.5 py-0.5 ${parseMethodBadge.cls}`}>
            {parseMethodBadge.label}
          </span>
        )}
        {item._redditScore != null && <span>↑{item._redditScore}</span>}
        {item._redditAuthor && <span>u/{item._redditAuthor}</span>}
        {item._redditPermalink && (
          <a
            href={`https://reddit.com${item._redditPermalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-orange-400 hover:text-orange-300"
          >
            <ExternalLink size={10} /> Reddit
          </a>
        )}
      </div>

      {/* Preview card — entire surface is click target for editing */}
      <ImportPreviewCard
        item={item}
        collection={item.collection}
        existingItems={[]}
        selected
        onUpdate={onItemUpdate}
        onEditDetail={() => setDetailOpen(true)}
        colorScheme="red"
      />

      {/* Stacked detail modal with triage footer */}
      {detailOpen && (
        <ItemDetailModal
          item={item}
          collection={item.collection}
          data={null}
          editable
          onSave={handleDetailSave}
          onClose={() => setDetailOpen(false)}
          redditMode
          redditTriage={redditTriage}
          zIndex={60}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Now button
// ---------------------------------------------------------------------------

function ScanNowButton({ onDone }) {
  const [state, setState] = useState('idle'); // idle | scanning | done | error

  const handleClick = async () => {
    if (state === 'scanning') return;
    setState('scanning');
    try {
      await triggerRedditScan();
      // Give the scanner a few seconds to start picking up posts, then refresh.
      setTimeout(() => {
        setState('done');
        onDone?.();
        setTimeout(() => setState('idle'), 3000);
      }, 4000);
    } catch (err) {
      console.error('[queue] Scan trigger failed:', err);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const label = state === 'scanning' ? 'Scanning…' : state === 'done' ? 'Done!' : state === 'error' ? 'Error' : 'Scan Now';
  const cls = state === 'done'
    ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
    : state === 'error'
      ? 'bg-red-900/60 border-red-700 text-red-300'
      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700';

  return (
    <button
      onClick={handleClick}
      disabled={state === 'scanning'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${cls}`}
      title="Trigger a Reddit scan cycle now"
    >
      {state === 'scanning' ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function RedditQueueView({ onQueueCountChange }) {
  const [counts, setCounts] = useState({});
  const [activeTab, setActiveTab] = useState('needs_review');
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  const loadCounts = useCallback(async () => {
    try {
      const c = await fetchRedditQueueCounts();
      setCounts(c);
      const actionableTotal = (c.needs_review || 0) + (c.failed || 0);
      onQueueCountChange?.(actionableTotal);
    } catch (err) {
      console.error('[queue] Failed to load counts:', err);
    }
  }, [onQueueCountChange]);

  const loadItems = useCallback(async (tab, off) => {
    setLoading(true);
    try {
      const result = await fetchRedditQueue({ status: tab, offset: off, limit: LIMIT });
      if (off === 0) {
        setItems(result.items || []);
      } else {
        setItems(prev => [...prev, ...(result.items || [])]);
      }
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      console.error('[queue] Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    setItems([]);
    setOffset(0);
    loadItems(activeTab, 0);
  }, [activeTab, loadItems]);

  // Poll every 8 seconds so new items appear as the scanner processes them.
  useEffect(() => {
    const id = setInterval(() => {
      loadCounts();
      // Only refresh the first page silently — don't reset scroll position.
      fetchRedditQueue({ status: activeTab, offset: 0, limit: LIMIT })
        .then(result => {
          setItems(prev => {
            const incoming = result.items || [];
            const existingIds = new Set(prev.map(i => i.id));
            const newOnes = incoming.filter(i => !existingIds.has(i.id));
            if (newOnes.length === 0) return prev;
            return [...newOnes, ...prev];
          });
          setTotalCount(result.totalCount || 0);
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [activeTab, loadCounts]);

  const handleStatusChange = async (item, newStatus) => {
    await setRedditItemStatus(item.collection, item.id, newStatus);
    // Remove from current list
    setItems(prev => prev.filter(i => i.id !== item.id));
    setTotalCount(prev => Math.max(0, prev - 1));
    // Refresh counts
    loadCounts();
  };

  const handleItemUpdate = (updated) => {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
  };

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    loadItems(activeTab, next);
  };

  // Build sub-nav tabs
  const customTags = Object.keys(counts)
    .filter(k => !RESERVED_STATUSES.has(k))
    .sort();

  const tabs = [
    { key: 'needs_review', label: 'Needs Review', count: counts.needs_review || 0 },
    { key: 'failed', label: 'Failed', count: counts.failed || 0 },
    ...customTags.map(tag => ({ key: tag, label: tag, count: counts[tag] || 0 })),
  ];

  const existingTags = customTags;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-800/50 bg-slate-950">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Reddit Queue</h2>
          <div className="flex items-center gap-2">
            <ScanNowButton onDone={() => { loadCounts(); loadItems(activeTab, 0); setOffset(0); }} />
            <button
              onClick={() => { loadCounts(); loadItems(activeTab, 0); setOffset(0); }}
              className="p-2 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-500 py-8">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="text-slate-500 py-8 text-sm">
            No items in this queue.
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {items.map(item => (
              <QueueCard
                key={item.id}
                item={item}
                activeTab={activeTab}
                existingTags={existingTags}
                onStatusChange={handleStatusChange}
                onItemUpdate={handleItemUpdate}
              />
            ))}

            {items.length < totalCount && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors disabled:opacity-40"
              >
                {loading ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
                Load more ({totalCount - items.length} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
