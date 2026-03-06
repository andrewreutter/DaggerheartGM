import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Video, VideoOff, Loader2 } from 'lucide-react';
import { getZoomSignature } from '../lib/api.js';

const ZOOM_STRIP_HEIGHT = 220;

export function ZoomMeetingStrip({ meetingNumber, password, userName, hidden }) {
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
      await client.init({
        zoomAppRoot: containerRef.current,
        language: 'en-US',
        patchJsMedia: true,
      });
      const joinOpts = {
        signature,
        meetingNumber: mn,
        password: password || '',
        userName: userName || 'GM',
      };
      if (sdkKey) joinOpts.sdkKey = sdkKey;
      await client.join(joinOpts);
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

  if (hidden) return null;

  if (!configured) {
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

  return (
    <div
      className="shrink-0 border-t border-slate-800 bg-slate-950 overflow-hidden flex flex-col"
      style={{ height: ZOOM_STRIP_HEIGHT }}
    >
      <div ref={containerRef} className="flex-1 min-h-0 relative" />
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
