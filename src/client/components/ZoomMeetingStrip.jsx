import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Video, VideoOff, Loader2 } from 'lucide-react';
import { getZoomSignature } from '../lib/api.js';

const ZOOM_STRIP_HEIGHT = 360;
const ZOOM_SIDEBAR_WIDTH = 320;
const ZOOM_BUTTON_BAR_HEIGHT = 48;

export function ZoomMeetingStrip({ meetingNumber, password, userName, hidden, vertical = false }) {
  const containerRef = useRef(null);
  const clientRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | joining | joined | error
  const [errorMsg, setErrorMsg] = useState('');

  const mn = String(meetingNumber || '').replace(/\s/g, '');
  const configured = !!mn;

  const handleJoin = async () => {
    if (!mn || !containerRef.current) return;
    setStatus('joining');
    setErrorMsg('');
    try {
      // Zoom SDK UMD bundle uses require("react") — provide it before loading
      const prevRequire = typeof globalThis.require !== 'undefined' ? globalThis.require : undefined;
      globalThis.require = (id) => {
        if (id === 'react') return React;
        if (id === 'react-dom') return ReactDOM;
        throw new Error('Unknown module: ' + id);
      };
      const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');
      if (prevRequire) globalThis.require = prevRequire; else delete globalThis.require;
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      const { signature, sdkKey } = await getZoomSignature(mn, 0, true);

      // Zoom SDK maintains 16:9 aspect ratio. Set width so the resulting height fits in the strip.
      // We use getBoundingClientRect() to ensure we fit the actual available space,
      // avoiding "cut off" issues if the button bar is slightly larger/smaller.
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      const videoOpts = {
        isResizable: true,
        defaultViewType: 'gallery',
        popper: { disableDraggable: true },
        viewSizes: {
          default: { width: w, height: h },
          ribbon: { width: Math.min(320, w), height: h },
        },
      };

      await client.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
        maximumVideosInGalleryView: 9,
        customize: { video: videoOpts },
      });
      const joinOpts = {
        signature,
        meetingNumber: mn,
        password: password || '',
        userName: userName || 'GM',
      };
      if (sdkKey) joinOpts.sdkKey = sdkKey;
      await client.join(joinOpts);
      // Force re-render with our dimensions (Zoom SDK sometimes needs this nudge)
      client.updateVideoOptions(videoOpts);
      setStatus('joined');
    } catch (err) {
      let msg = err.message || 'Failed to join meeting';
      if (msg.toLowerCase().includes('signature is invalid')) {
        msg += ' — Verify ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in .env match your Meeting SDK app in Zoom Marketplace. Check server logs for debug.';
      }
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const handleLeave = async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.leaveMeeting();
    } catch (_) {}
    setStatus('idle');
  };

  useEffect(() => {
    if (status !== 'joined' || !containerRef.current || !clientRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.floor(width);
        const h = Math.floor(height);
        try {
          // Update Zoom video dimensions to match container
          // Note: updateVideoOptions might not exist on all client versions or states, wrap in try/catch
          if (clientRef.current.updateVideoOptions) {
             clientRef.current.updateVideoOptions({
              viewSizes: {
                default: { width: w, height: h },
                ribbon: { width: Math.min(320, w), height: h },
              },
            });
          }
        } catch (e) {
          console.warn('Failed to resize Zoom video:', e);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [status]);

  if (hidden) return null;

  if (!configured) {
    if (vertical) {
       // In vertical mode, if not configured, we might want to hide it entirely or show a thin strip?
       // For now, let's show the placeholder but match dimensions.
       return (
        <div
          className="shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-slate-500"
          style={{ width: ZOOM_SIDEBAR_WIDTH, height: '100%' }}
        >
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Video size={28} className="opacity-40" />
            <p className="text-sm">Configure Zoom Meeting in Player View to embed a meeting here.</p>
          </div>
        </div>
       );
    }

    return (
      <div
        className="shrink-0 border-t border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500"
        style={{ height: ZOOM_STRIP_HEIGHT }}
      >
        <div className="flex flex-col items-center gap-2">
          <Video size={28} className="opacity-40" />
          <p className="text-sm">Configure Zoom Meeting above to embed a meeting.</p>
        </div>
      </div>
    );
  }

  if (vertical) {
    return (
      <div
        className="shrink-0 border-r border-slate-800 bg-slate-950 overflow-hidden flex flex-col"
        style={{ width: ZOOM_SIDEBAR_WIDTH, height: '100%' }}
      >
        <div
          ref={containerRef}
          id="zoom-embed-container"
          className="flex-1 min-h-0 w-full relative isolate"
          style={{ 
            transform: 'translateZ(0)', // Force containing block for fixed elements
          }}
        />
        <div className="shrink-0 px-4 py-3 flex flex-col gap-3 bg-slate-900/80 border-t border-slate-800">
           <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {status === 'error' && (
                <span className="text-red-400 text-xs truncate">{errorMsg}</span>
              )}
              {status === 'joining' && (
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Joining…
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full">
            {status === 'idle' && (
              <button
                onClick={handleJoin}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Video size={14} />
                Join Meeting
              </button>
            )}
            {status === 'joined' && (
              <button
                onClick={handleLeave}
                className="flex-1 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <VideoOff size={14} />
                Leave
              </button>
            )}
            {status === 'error' && (
              <button
                onClick={handleJoin}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 border-t border-slate-800 bg-slate-950 overflow-hidden flex flex-col"
      style={{ height: ZOOM_STRIP_HEIGHT }}
    >
      <div
        ref={containerRef}
        id="zoom-embed-container"
        className="flex-1 min-h-0 w-full relative isolate"
        style={{ 
          minHeight: ZOOM_STRIP_HEIGHT - ZOOM_BUTTON_BAR_HEIGHT,
          transform: 'translateZ(0)', // Force containing block for fixed elements (like Security Check)
        }}
      />
      <div className="shrink-0 px-4 py-2 flex items-center justify-between gap-4 bg-slate-900/80 border-t border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'error' && (
            <span className="text-red-400 text-sm truncate">{errorMsg}</span>
          )}
          {status === 'joining' && (
            <span className="text-slate-400 text-sm flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              Joining…
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {status === 'idle' && (
            <button
              onClick={handleJoin}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Video size={14} />
              Join Meeting
            </button>
          )}
          {status === 'joined' && (
            <button
              onClick={handleLeave}
              className="px-4 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <VideoOff size={14} />
              Leave
            </button>
          )}
          {status === 'error' && (
            <button
              onClick={handleJoin}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
