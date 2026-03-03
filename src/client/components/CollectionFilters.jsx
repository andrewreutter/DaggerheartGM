import { Search } from 'lucide-react';
import { TIERS, ROLES, ENV_TYPES } from '../lib/constants.js';

const SOURCE_OPTIONS = [
  { val: null,      label: 'All' },
  { val: 'own',     label: 'Mine' },
  { val: 'srd',     label: 'SRD' },
  { val: 'public',  label: 'Public' },
  { val: 'hod',     label: 'HoD' },
  { val: 'fcg',     label: 'FCG' },
  { val: 'reddit',  label: 'Reddit' },
];

/**
 * Shared filter bar/panel for adversary and environment collections.
 *
 * Props:
 *   collection      - 'adversaries' | 'environments'
 *   filters         - { include, tier, type, search } from useCollectionSearch
 *   onFilterChange  - (key, value) => void
 *   variant         - 'bar' (LibraryView horizontal) | 'panel' (modal / FeatureLibrary stacked)
 *   autoFocusSearch - boolean, default false
 */
export function CollectionFilters({
  collection,
  filters,
  onFilterChange,
  variant = 'bar',
  autoFocusSearch = false,
}) {
  const typeOptions = collection === 'adversaries' ? ROLES : ENV_TYPES;
  const typeLabel = collection === 'adversaries' ? 'Role' : 'Type';

  if (variant === 'panel') {
    return <PanelFilters
      filters={filters}
      onFilterChange={onFilterChange}
      typeOptions={typeOptions}
      typeLabel={typeLabel}
      autoFocusSearch={autoFocusSearch}
    />;
  }

  return <BarFilters
    filters={filters}
    onFilterChange={onFilterChange}
    typeOptions={typeOptions}
    typeLabel={typeLabel}
    collection={collection}
  />;
}

// ---------------------------------------------------------------------------
// Bar variant — horizontal inline style used in LibraryView
// ---------------------------------------------------------------------------

function BarFilters({ filters, onFilterChange, typeOptions, typeLabel, collection }) {
  const { include, tier, type, search } = filters;

  const baseBtn = 'px-2 py-0.5 rounded font-medium border transition-colors';
  const inactive = 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300';

  return (
    <div className="mb-5 space-y-2">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onFilterChange('search', e.target.value)}
          placeholder={`Search ${collection}…`}
          className="w-full bg-slate-800 border border-slate-700 rounded pl-7 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
        />
      </div>

      {/* Source + Tier + Type */}
      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span className="text-slate-500 font-medium uppercase tracking-wider">Include</span>
        {SOURCE_OPTIONS.map(({ val, label }) => (
          <button
            key={String(val)}
            onClick={() => onFilterChange('include', include === val && val !== null ? null : val)}
            className={`${baseBtn} ${include === val ? 'bg-cyan-800 border-cyan-500 text-cyan-100' : inactive}`}
          >
            {label}
          </button>
        ))}

        <span className="text-slate-700 select-none">|</span>
        <span className="text-slate-500 font-medium uppercase tracking-wider">Tier</span>
        <button
          onClick={() => onFilterChange('tier', null)}
          className={`${baseBtn} ${tier === null ? 'bg-amber-700 border-amber-500 text-amber-100' : inactive}`}
        >
          All
        </button>
        {TIERS.map(t => (
          <button
            key={t}
            onClick={() => onFilterChange('tier', tier === t ? null : t)}
            className={`${baseBtn} ${tier === t ? 'bg-amber-700 border-amber-500 text-amber-100' : inactive}`}
          >
            {t}
          </button>
        ))}

        <span className="text-slate-700 select-none">|</span>
        <span className="text-slate-500 font-medium uppercase tracking-wider">{typeLabel}</span>
        <button
          onClick={() => onFilterChange('type', null)}
          className={`${baseBtn} ${type === null ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
        >
          All
        </button>
        {typeOptions.map(val => (
          <button
            key={val}
            onClick={() => onFilterChange('type', type === val ? null : val)}
            className={`${baseBtn} capitalize ${type === val ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel variant — stacked sections with headers, used in modals / FeatureLibrary
// ---------------------------------------------------------------------------

function PanelFilters({ filters, onFilterChange, typeOptions, typeLabel, autoFocusSearch }) {
  const { include, tier, type, search } = filters;

  const btnBase = 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border';
  const btnActive = 'bg-red-700 border-red-600 text-white';
  const btnInactive = 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white';

  const selectClass = 'bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 cursor-pointer hover:border-slate-500 focus:outline-none focus:border-blue-500 transition-colors w-full mt-1';

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          autoFocus={autoFocusSearch}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"
          placeholder="Search by name..."
          value={search}
          onChange={e => onFilterChange('search', e.target.value)}
        />
      </div>

      {/* Source */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Source</div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map(({ val, label }) => (
            <button
              key={String(val)}
              onClick={() => onFilterChange('include', include === val && val !== null ? null : val)}
              className={`${btnBase} ${include === val ? btnActive : btnInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tier */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Tier</div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onFilterChange('tier', null)} className={`${btnBase} ${tier === null ? btnActive : btnInactive}`}>All</button>
          {TIERS.map(t => (
            <button key={t} onClick={() => onFilterChange('tier', tier === t ? null : t)} className={`${btnBase} ${tier === t ? btnActive : btnInactive}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Type / Role — dropdown to stay compact in narrow panels */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{typeLabel}</div>
        <select
          value={type ?? ''}
          onChange={e => onFilterChange('type', e.target.value || null)}
          className={selectClass}
        >
          <option value="">All {typeLabel}s</option>
          {typeOptions.map(val => (
            <option key={val} value={val}>{val.charAt(0).toUpperCase() + val.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
