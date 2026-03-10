import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  Tldraw,
  useRelevantStyles,
} from 'tldraw';
import { useSync } from '@tldraw/sync';
import { getAuthToken, supabaseStorageBase } from '../lib/api.js';
import 'tldraw/tldraw.css';

const HOVER_EXPAND_MS = 150;
const HOVER_COLLAPSE_MS = 200;

function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.5 0 1-.5 1-1v-8c0-.5-.5-1-1-1H5c0-4 3.5-7.5 7.5-7.5 1 0 1.5-.5 1.5-1.5 0-.5-.5-1-1-1z" />
    </svg>
  );
}

/**
 * Style panel that collapses to a hamburger-sized icon and expands on hover.
 * Uses useRelevantStyles so the panel is hidden when nothing is selected (same as default).
 */
function CollapsibleStylePanel(props) {
  const styles = useRelevantStyles();
  const [expanded, setExpanded] = useState(false);
  const expandTimeoutRef = useRef(null);
  const collapseTimeoutRef = useRef(null);

  const clearTimeouts = useCallback(() => {
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    clearTimeouts();
    expandTimeoutRef.current = setTimeout(() => setExpanded(true), HOVER_EXPAND_MS);
  }, [clearTimeouts]);

  const onMouseLeave = useCallback(() => {
    clearTimeouts();
    collapseTimeoutRef.current = setTimeout(() => setExpanded(false), HOVER_COLLAPSE_MS);
  }, [clearTimeouts]);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  if (styles == null) return null;

  return (
    <div
      className="dh-style-panel-anchor"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {expanded && (
        <DefaultStylePanel {...props}>
          <DefaultStylePanelContent />
        </DefaultStylePanel>
      )}
      <button
        type="button"
        className="dh-style-panel-trigger"
        aria-label="Style options"
      >
        <PaletteIcon />
      </button>
    </div>
  );
}

const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'image/apng': 'apng', 'video/mp4': 'mp4', 'video/webm': 'webm',
  'video/quicktime': 'mov',
};

// tldraw's built-in user color palette
const TLDRAW_COLORS = [
  'red', 'light-red', 'orange', 'yellow', 'light-green',
  'green', 'light-blue', 'blue', 'light-violet', 'violet',
];

function colorForUid(uid) {
  if (!uid) return TLDRAW_COLORS[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return TLDRAW_COLORS[h % TLDRAW_COLORS.length];
}

/**
 * Build an asset store for a specific gmUid.
 * - upload: POSTs the file to /api/whiteboard/assets (authenticated) and returns the Supabase public URL.
 *   Falls back to an inline data URL if the server returns 503 (Supabase not configured).
 * - resolve: reconstructs the Supabase public URL from asset ID + MIME type (since TLDraw's sync
 *   protocol strips asset.props.src from snapshots). Falls back to asset.props.src for data URLs.
 */
function makeAssetStore(gmUid) {
  return {
    async upload(asset, file) {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      const assetId = asset?.id ?? '';
      try {
        const resp = await fetch(
          `/api/whiteboard/assets?gmUid=${encodeURIComponent(gmUid)}&assetId=${encodeURIComponent(assetId)}`,
          {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          }
        );
        if (resp.ok) {
          const { url } = await resp.json();
          return { src: url };
        }
        if (resp.status !== 503) {
          console.warn('[whiteboard] asset upload failed:', resp.status, await resp.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('[whiteboard] asset upload error, falling back to data URL:', err);
      }
      // Fallback: embed as data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      return { src: dataUrl };
    },
    resolve(asset) {
      // TLDraw's sync protocol strips asset.props.src from snapshots, so we reconstruct
      // the Supabase public URL deterministically from the asset ID and MIME type.
      if (supabaseStorageBase && asset?.id && asset?.props?.mimeType) {
        const safeId = asset.id.replace(/^asset:/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = MIME_TO_EXT[asset.props.mimeType] || 'bin';
        return `${supabaseStorageBase}/whiteboard-assets/${gmUid}/${safeId}.${ext}`;
      }
      return asset?.props?.src ?? null;
    },
  };
}

// Inner component: only rendered once we have a real URI, so useSync always gets valid args.
function TldrawCanvas({ wsUri, assetStore, userInfo, isPlayer }) {
  const store = useSync({ uri: wsUri, assets: assetStore, userInfo });

  const handleMount = useCallback((editor) => {
    // Tag every newly created shape with the current user's UID so we can enforce ownership later.
    editor.getInitialMetaForShape = (_shape) => ({ createdBy: userInfo.id });

    if (isPlayer) {
      // Players may not modify shapes created by others (or shapes with no owner, which are
      // treated as GM-owned since they predate this feature). Remote sync changes are always
      // allowed so the GM's edits propagate correctly to all connected clients.
      editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next, source) => {
        if (source === 'remote') return next;
        const owner = next.meta?.createdBy;
        if (!owner || owner !== userInfo.id) return prev;
        return next;
      });

      editor.sideEffects.registerBeforeDeleteHandler('shape', (shape, source) => {
        if (source === 'remote') return;
        const owner = shape.meta?.createdBy;
        if (!owner || owner !== userInfo.id) return false;
      });
    }

    // TLDraw's sync protocol strips asset.props.src before broadcasting to other clients.
    // resolve() is called during initial hydration but NOT for assets that arrive incrementally
    // via real-time sync, so remote users see broken images until they reload.
    // Fix: watch for remotely-added assets with a missing src and inject the resolved URL.
    const unlisten = editor.store.listen(({ changes, source }) => {
      if (source !== 'remote') return;
      const addedAssets = Object.values(changes.added).filter(
        r => r.typeName === 'asset' && r.props?.mimeType && !r.props?.src
      );
      if (addedAssets.length === 0) return;
      const updates = [];
      for (const asset of addedAssets) {
        const src = assetStore.resolve(asset);
        if (src) updates.push({ ...asset, props: { ...asset.props, src } });
      }
      if (updates.length > 0) {
        editor.run(() => editor.updateAssets(updates), { history: 'ignore' });
      }
    });

    return unlisten;
  }, [isPlayer, userInfo.id, assetStore]);

  return (
    <Tldraw
      store={store}
      onMount={handleMount}
      options={{ maxPages: 1 }}
      components={{ StylePanel: CollapsibleStylePanel }}
      overrides={{
        tools: (_editor, tools) => {
          delete tools.embed;
          return tools;
        },
        actions: (_editor, actions) => {
          delete actions['insert-embed'];
          delete actions['delete-embed'];
          return actions;
        },
      }}
    />
  );
}

export function Whiteboard({ gmUid, user, isPlayer = false, className = '' }) {
  const [wsUri, setWsUri] = useState(null);

  useEffect(() => {
    if (!gmUid) return;
    let cancelled = false;
    getAuthToken().then(token => {
      if (cancelled || !token) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      setWsUri(`${proto}://${location.host}/api/whiteboard/${gmUid}?token=${encodeURIComponent(token)}`);
    });
    return () => { cancelled = true; };
  }, [gmUid]);

  // Stable asset store instance per gmUid (recreated only when gmUid changes)
  const assetStore = useMemo(() => makeAssetStore(gmUid), [gmUid]);

  const userInfo = {
    id: user?.uid ?? 'anon',
    name: user?.displayName || user?.email || 'Unknown',
    color: colorForUid(user?.uid),
  };

  return (
    <div className={`relative ${className}`} style={{ colorScheme: 'dark', isolation: 'isolate' }}>
      {wsUri ? (
        <TldrawCanvas wsUri={wsUri} assetStore={assetStore} userInfo={userInfo} isPlayer={isPlayer} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Connecting to whiteboard…
        </div>
      )}
    </div>
  );
}
