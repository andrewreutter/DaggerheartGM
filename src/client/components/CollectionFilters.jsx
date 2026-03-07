import { Search } from 'lucide-react';
import { ROLES, ENV_TYPES } from '../lib/constants.js';
import { TierSelector } from './TierSelector.jsx';

const SOURCE_OPTIONS = [
  { val: 'own',     label: 'Mine' },
  { val: null,      label: 'All' },
  { val: 'srd',     label: 'SRD' },
  { val: 'public',  label: 'Public' },
  { val: 'hod',     label: 'HoD' },
  { val: 'fcg',     label: 'FCG' },
];

const SORT_OPTIONS = [
  { val: 'popularity', label: 'Popularity' },
  { val: 'name',       label: 'Name' },
  { val: 'type',       label: 'Role/Type' },
  { val: 'source',     label: 'Source' },
  { val: 'tier',       label: 'Tier' },
];

/**
 * Shared filter bar/panel for adversary and environment collections.
 *
 * Props:
 *   collection      - 'adversaries' | 'environments'
 *   filters         - { includes, tiers, types, search, includeScaledUp } from useCollectionSearch
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
  showSort = false,
}) {
  const typeOptions = collection === 'adversaries' ? ROLES : ENV_TYPES;
  const typeLabel = collection === 'adversaries' ? 'Role' : 'Type';

  if (variant === 'panel') {
    return <PanelFilters
      filters={filters}
      onFilterChange={onFilterChange}
      typeOptions={typeOptions}
      typeLabel={typeLabel}
      collection={collection}
      autoFocusSearch={autoFocusSearch}
      showSort={showSort}
    />;
  }

  return <BarFilters
    filters={filters}
    onFilterChange={onFilterChange}
    typeOptions={typeOptions}
    typeLabel={typeLabel}
    collection={collection}
    showSort={showSort}
  />;
}

// ---------------------------------------------------------------------------
// Bar variant — horizontal inline style used in LibraryView
// ---------------------------------------------------------------------------

function BarFilters({ filters, onFilterChange, typeOptions, typeLabel, collection, showSort }) {
  const { includes = [], tiers = [], types = [], search, includeScaledUp, sort = 'popularity' } = filters;

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

      {/* Source + Tier + Type + Sort */}
      <div className="flex items-start gap-3 text-xs text-slate-400 flex-wrap">
        <span className="text-slate-500 font-medium uppercase tracking-wider">Include</span>
        {SOURCE_OPTIONS.map(({ val, label }) => (
          <button
            key={String(val)}
            onClick={() => onFilterChange('include', val === null ? null : val)}
            className={`${baseBtn} ${(val === null ? includes.length === 0 : includes.includes(val)) ? 'bg-cyan-800 border-cyan-500 text-cyan-100' : inactive}`}
          >
            {label}
          </button>
        ))}

        <span className="text-slate-700 select-none">|</span>
        <span className="text-slate-500 font-medium uppercase tracking-wider">Tier</span>
        <div className="flex flex-col gap-1">
          <TierSelector
            value={tiers}
            onChange={t => onFilterChange('tier', t)}
            multi
            showAll
            activeClass="bg-amber-700 border-amber-500 text-amber-100"
            inactiveClass={inactive}
            btnClass={baseBtn}
          />
          {collection === 'adversaries' && tiers.length === 1 && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!includeScaledUp}
                onChange={e => onFilterChange('includeScaledUp', e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
              />
              <span className="text-slate-400">Include Scaled</span>
            </label>
          )}
        </div>

        <span className="text-slate-700 select-none">|</span>
        <span className="text-slate-500 font-medium uppercase tracking-wider">{typeLabel}</span>
        <button
          onClick={() => onFilterChange('type', null)}
          className={`${baseBtn} ${types.length === 0 ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
        >
          All
        </button>
        {typeOptions.map(val => (
          <button
            key={val}
            onClick={() => onFilterChange('type', val)}
            className={`${baseBtn} capitalize ${types.includes(val) ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
          >
            {val}
          </button>
        ))}
        {showSort && (
          <>
            <span className="text-slate-700 select-none">|</span>
            <span className="text-slate-500 font-medium uppercase tracking-wider">Sort</span>
            <select
              value={sort}
              onChange={e => onFilterChange('sort', e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 text-xs"
            >
              {SORT_OPTIONS.map(({ val, label }) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel variant — stacked sections with headers, used in modals / FeatureLibrary
// ---------------------------------------------------------------------------

function PanelFilters({ filters, onFilterChange, typeOptions, typeLabel, collection, autoFocusSearch, showSort }) {
  const { includes = [], tiers = [], types = [], search, includeScaledUp, sort = 'popularity' } = filters;

  const btnBase = 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border';
  const btnActive = 'bg-red-700 border-red-600 text-white';
  const btnInactive = 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white';

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
              onClick={() => onFilterChange('include', val === null ? null : val)}
              className={`${btnBase} ${(val === null ? includes.length === 0 : includes.includes(val)) ? btnActive : btnInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tier */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Tier</div>
        <div className="flex flex-col gap-1.5">
          <TierSelector
            value={tiers}
            onChange={t => onFilterChange('tier', t)}
            multi
            showAll
            activeClass={btnActive}
            inactiveClass={btnInactive}
            btnClass={btnBase}
          />
          {collection === 'adversaries' && tiers.length === 1 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={!!includeScaledUp}
                onChange={e => onFilterChange('includeScaledUp', e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
              />
              <span>Include Scaled</span>
            </label>
          )}
        </div>
      </div>

      {/* Role / Type — button group matching Source/Tier */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{typeLabel}</div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onFilterChange('type', null)} className={`${btnBase} ${types.length === 0 ? btnActive : btnInactive}`}>All</button>
          {typeOptions.map(val => (
            <button key={val} onClick={() => onFilterChange('type', val)} className={`${btnBase} capitalize ${types.includes(val) ? btnActive : btnInactive}`}>{val}</button>
          ))}
        </div>
      </div>
      {showSort && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sort</div>
          <select value={sort} onChange={e => onFilterChange('sort', e.target.value)} className={`${btnBase} w-full`}>
            {SORT_OPTIONS.map(({ val, label }) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
