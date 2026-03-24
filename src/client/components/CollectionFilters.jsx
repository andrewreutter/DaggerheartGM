import { Search, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { TIERS } from '../lib/constants.js';
import { TierSelector } from './TierSelector.jsx';
import { ABILITY_LEVELS, getLibraryFilterConfig } from '../lib/library-filter-config.js';

/** Shared search field for Library filter bar (`CollectionFilters` bar variant). */
export function LibrarySearchField({ collection, value, onChange, className = '' }) {
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={`Search ${collection}…`}
        className="w-full bg-slate-800 border border-slate-700 rounded pl-7 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
      />
    </div>
  );
}

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
 * Shared filter bar/panel for library collections (unified API).
 *
 * Props:
 *   collection      - collection id (e.g. adversaries, abilities, weapons)
 *   filters         - { includes, tiers, types, extraTypes, search, includeScaledUp } from useCollectionSearch
 *   onFilterChange  - (key, value) => void
 *   variant         - 'bar' (LibraryView horizontal) | 'panel' (modal / FeatureLibrary stacked)
 *   autoFocusSearch - boolean, default false
 *   viewSlider      - optional library card sizing (bar variant):
 *                     pixel width: { value, onChange, min?, max?, step? }
 *                     snap width: { snapValues, snapIndex, onSnapChange } (one column per step)
 *                     optional height: { height: { value, onChange, min?, max?, step? } } — ↕ slider beside width
 */
export function CollectionFilters({
  collection,
  filters,
  onFilterChange,
  variant = 'bar',
  autoFocusSearch = false,
  showSort = false,
  viewSlider = null,
}) {
  const cfg = getLibraryFilterConfig(collection);
  const typeOptions = Array.isArray(cfg.typeOptions) ? cfg.typeOptions : null;
  const typeLabel = cfg.typeLabel || 'Type';
  const extraOpts = Array.isArray(cfg.extraTypeOptions) ? cfg.extraTypeOptions : null;
  const extraLabel = cfg.extraTypeLabel || '';

  if (variant === 'panel') {
    return (
      <PanelFilters
        filters={filters}
        onFilterChange={onFilterChange}
        typeOptions={typeOptions}
        typeLabel={typeLabel}
        extraOpts={extraOpts}
        extraLabel={extraLabel}
        cfg={cfg}
        collection={collection}
        autoFocusSearch={autoFocusSearch}
        showSort={showSort}
      />
    );
  }

  return (
    <BarFilters
      filters={filters}
      onFilterChange={onFilterChange}
      typeOptions={typeOptions}
      typeLabel={typeLabel}
      extraOpts={extraOpts}
      extraLabel={extraLabel}
      cfg={cfg}
      collection={collection}
      showSort={showSort}
      viewSlider={viewSlider}
    />
  );
}

function rankNumbers(cfg) {
  if (cfg.rankMode === 'level') return ABILITY_LEVELS;
  if (cfg.rankMode === 'none') return null;
  return TIERS;
}

// ---------------------------------------------------------------------------
// Bar variant — horizontal inline style used in LibraryView
// ---------------------------------------------------------------------------

function BarFilters({ filters, onFilterChange, typeOptions, typeLabel, extraOpts, extraLabel, cfg, collection, showSort, viewSlider }) {
  const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp, sort = 'popularity' } = filters;
  const rankNums = rankNumbers(cfg);

  const baseBtn = 'px-2 py-0.5 rounded font-medium border transition-colors';
  const inactive = 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300';
  const headingCls = 'text-slate-500 font-medium uppercase tracking-wider shrink-0 whitespace-nowrap';

  return (
    <div className="mb-5 space-y-2">
      <LibrarySearchField
        collection={collection}
        value={search}
        onChange={v => onFilterChange('search', v)}
      />

      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 text-xs text-slate-400">
        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Include</span>
          {SOURCE_OPTIONS.map(({ val, label }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onFilterChange('include', val === null ? null : val)}
              className={`${baseBtn} shrink-0 ${(val === null ? includes.length === 0 : includes.includes(val)) ? 'bg-cyan-800 border-cyan-500 text-cyan-100' : inactive}`}
            >
              {label}
            </button>
          ))}
        </div>

        {rankNums && (
          <>
            <span className="text-slate-700 select-none shrink-0" aria-hidden>|</span>
            <div className="inline-flex max-w-full items-start gap-2 flex-nowrap">
              <span className={`${headingCls} pt-0.5`}>
                {cfg.rankMode === 'level' ? 'Level' : 'Tier'}
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                <TierSelector
                  value={tiers}
                  onChange={t => onFilterChange('tier', t)}
                  multi
                  showAll
                  numbers={rankNums}
                  activeClass="bg-amber-700 border-amber-500 text-amber-100"
                  inactiveClass={inactive}
                  btnClass={baseBtn}
                />
                {cfg.showIncludeScaled && collection === 'adversaries' && tiers.length === 1 && (
                  <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
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
            </div>
          </>
        )}

        {typeOptions && typeOptions.length > 0 && (
          <>
            <span className="text-slate-700 select-none shrink-0" aria-hidden>|</span>
            <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
              <span className={headingCls}>{typeLabel}</span>
              <button
                type="button"
                onClick={() => onFilterChange('type', null)}
                className={`${baseBtn} shrink-0 ${types.length === 0 ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
              >
                All
              </button>
              {typeOptions.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onFilterChange('type', val)}
                  className={`${baseBtn} shrink-0 ${collection === 'adversaries' ? 'capitalize' : ''} ${types.includes(val) ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </>
        )}

        {extraOpts && extraOpts.length > 0 && (
          <>
            <span className="text-slate-700 select-none shrink-0" aria-hidden>|</span>
            <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
              <span className={headingCls}>{extraLabel}</span>
              <button
                type="button"
                onClick={() => onFilterChange('extraType', null)}
                className={`${baseBtn} shrink-0 ${extraTypes.length === 0 ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
              >
                All
              </button>
              {extraOpts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onFilterChange('extraType', val)}
                  className={`${baseBtn} shrink-0 ${extraTypes.includes(val) ? 'bg-red-800 border-red-500 text-red-100' : inactive}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </>
        )}

        {showSort && (
          <>
            <span className="text-slate-700 select-none shrink-0" aria-hidden>|</span>
            <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
              <span className={headingCls}>Sort</span>
              <select
                value={sort}
                onChange={e => onFilterChange('sort', e.target.value)}
                className="shrink-0 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
              >
                {SORT_OPTIONS.map(({ val, label }) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {viewSlider && (
        <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/60 pt-2 text-xs text-slate-400">
          <span className={headingCls}>View</span>
          <span className="inline-flex min-w-[10rem] max-w-[14rem] flex-1 items-center gap-1.5 sm:min-w-[12rem]">
            <ArrowLeftRight size={14} className="shrink-0 text-slate-500" aria-hidden />
            <span className="shrink-0 text-slate-500">Width</span>
            <label className="flex min-w-0 flex-1 items-center">
              {Array.isArray(viewSlider.snapValues) && viewSlider.snapValues.length > 0 ? (
                <input
                  type="range"
                  aria-label="Cards per row"
                  min={0}
                  max={Math.max(0, viewSlider.snapValues.length - 1)}
                  step={1}
                  value={Math.min(viewSlider.snapIndex ?? 0, viewSlider.snapValues.length - 1)}
                  onChange={e => viewSlider.onSnapChange?.(Number(e.target.value))}
                  className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-500"
                />
              ) : (
                <input
                  type="range"
                  aria-label="Card width"
                  min={viewSlider.min ?? 220}
                  max={viewSlider.max ?? 520}
                  step={viewSlider.step ?? 10}
                  value={viewSlider.value}
                  onChange={e => viewSlider.onChange(Number(e.target.value))}
                  className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-500"
                />
              )}
            </label>
          </span>
          {viewSlider.height && (
            <span className="inline-flex min-w-[10rem] max-w-[14rem] flex-1 items-center gap-1.5 sm:min-w-[12rem]">
              <ArrowUpDown size={14} className="shrink-0 text-slate-500" aria-hidden />
              <span className="shrink-0 text-slate-500">Height</span>
              <label className="flex min-w-0 flex-1 items-center">
                <input
                  type="range"
                  aria-label="Card height"
                  min={viewSlider.height.min ?? 120}
                  max={viewSlider.height.max ?? 480}
                  step={viewSlider.height.step ?? 1}
                  value={viewSlider.height.value}
                  onChange={e => viewSlider.height.onChange(Number(e.target.value))}
                  className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-500"
                />
              </label>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel variant — stacked sections with headers, used in modals / FeatureLibrary
// ---------------------------------------------------------------------------

function PanelFilters({ filters, onFilterChange, typeOptions, typeLabel, extraOpts, extraLabel, cfg, collection, autoFocusSearch, showSort }) {
  const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp, sort = 'popularity' } = filters;
  const rankNums = rankNumbers(cfg);

  const btnBase = 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border';
  const btnActive = 'bg-red-700 border-red-600 text-white';
  const btnInactive = 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white';

  return (
    <div className="flex flex-col gap-3">
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

      <div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Source</div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map(({ val, label }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onFilterChange('include', val === null ? null : val)}
              className={`${btnBase} ${(val === null ? includes.length === 0 : includes.includes(val)) ? btnActive : btnInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rankNums && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            {cfg.rankMode === 'level' ? 'Level' : 'Tier'}
          </div>
          <div className="flex flex-col gap-1.5">
            <TierSelector
              value={tiers}
              onChange={t => onFilterChange('tier', t)}
              multi
              showAll
              numbers={rankNums}
              activeClass={btnActive}
              inactiveClass={btnInactive}
              btnClass={btnBase}
            />
            {cfg.showIncludeScaled && collection === 'adversaries' && tiers.length === 1 && (
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
      )}

      {typeOptions && typeOptions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{typeLabel}</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onFilterChange('type', null)} className={`${btnBase} ${types.length === 0 ? btnActive : btnInactive}`}>All</button>
            {typeOptions.map(val => (
              <button key={val} type="button" onClick={() => onFilterChange('type', val)} className={`${btnBase} ${collection === 'adversaries' ? 'capitalize' : ''} ${types.includes(val) ? btnActive : btnInactive}`}>{val}</button>
            ))}
          </div>
        </div>
      )}

      {extraOpts && extraOpts.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{extraLabel}</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onFilterChange('extraType', null)} className={`${btnBase} ${extraTypes.length === 0 ? btnActive : btnInactive}`}>All</button>
            {extraOpts.map(val => (
              <button key={val} type="button" onClick={() => onFilterChange('extraType', val)} className={`${btnBase} ${extraTypes.includes(val) ? btnActive : btnInactive}`}>{val}</button>
            ))}
          </div>
        </div>
      )}

      {showSort && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sort</div>
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
