import { useState } from 'react';
import { RefreshCw, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { syncDaggerstackCharacter } from '../lib/api.js';

/**
 * Reusable Daggerstack import component.
 * Props:
 *   onImported(characterData) — called with the full character object after a successful sync
 *   compact (boolean) — when true, renders inline (for the picker); when false, renders as a card
 */
export function DaggerstackImport({ onImported, compact = false }) {
  const [open, setOpen] = useState(compact);
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const canSync = url.trim() && email.trim() && password.trim() && !syncing;

  const handleSync = async () => {
    setError('');
    setSyncing(true);
    setSuccess(false);
    try {
      const { character } = await syncDaggerstackCharacter(url.trim(), email.trim(), password);
      setSuccess(true);
      if (onImported) onImported(character);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const content = (
    <div className="space-y-2">
      <div>
        <label className="block text-[10px] text-slate-400 mb-0.5">Daggerstack Character URL</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://daggerstack.com/characters/..."
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">Character imported successfully!</p>}
      <button
        onClick={handleSync}
        disabled={!canSync}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing...' : 'Import from Daggerstack'}
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className="border border-slate-700 rounded-lg bg-slate-800/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={12} className="text-sky-400" />
          <span className="text-xs font-semibold text-sky-300">Import from Daggerstack</span>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700/40 transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
        <ExternalLink size={12} className="text-sky-400" />
        <span className="text-xs font-semibold text-sky-300">Import from Daggerstack</span>
      </button>
      {open && <div className="px-3 pb-3">{content}</div>}
    </div>
  );
}
