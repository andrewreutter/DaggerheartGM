import { Search, X, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { TIERS } from '../lib/constants.js';
import { TierSelector } from './TierSelector.jsx';
import { LibraryTierShieldRow } from './LibraryTierShieldRow.jsx';
import { ABILITY_LEVELS, formatFeatScopeLabel, getLibraryFilterConfig } from '../lib/library-filter-config.js';
import { LIBRARY_SOURCE_MODE_OPTIONS, getLibraryIncludeMode } from '../lib/library-default-filters.js';
import {
  readSharedLibraryFilters,
  getFirstActiveStructuralGroup,
  shouldSuppressStructuralAllHighlight,
  getStructuralRowGroupForCollection,
  LIBRARY_STRUCTURAL_RESET_KEY,
} from '../lib/library-shared-filters.js';

/** Shared search field for Library filter bar (`CollectionFilters` bar variant). */
export function LibrarySearchField({ collection, value, onChange, className = '', placeholder: placeholderProp }) {
  const placeholder = placeholderProp ?? `Search ${collection}…`;
  const hasValue = String(value ?? '').trim() !== '';
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dh-muted pointer-events-none" />
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-dh-raised border border-dh-strong rounded pl-7 py-1.5 text-xs text-dh placeholder-dh-muted focus:outline-none focus:border-dh-strong transition-colors ${hasValue ? 'pr-8' : 'pr-3'}`}
      />
      {hasValue && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-dh-muted hover:text-dh hover:bg-dh-hover/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-dh-strong"
        >
          <X size={14} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}

const stripHeadingCls = 'text-dh-muted font-medium uppercase tracking-wider shrink-0 whitespace-nowrap';

const includeSegWrap =
  'inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong';
const includeSegBtn =
  'rounded-none border-0 shadow-none shrink-0 px-2 py-0.5 text-xs font-medium transition-colors';
const includeSegOff =
  'bg-dh-raised text-dh-muted transition-colors hover:bg-dh-hover hover:text-dh';
const includeSegOn = 'bg-cyan-800 text-cyan-100 transition-colors hover:bg-cyan-700';

const segmentedInactive =
  'bg-dh-raised text-dh-muted transition-colors hover:bg-dh-hover hover:text-dh';
/** Segmented control “selected” — slight brighten on hover (works with red/violet/cyan). */
const segmentedActiveHover = 'transition-colors hover:brightness-110';

/** Typed filter row: All + options as one segmented single-select control. */
function LibraryTypedFilterPickRow({
  heading,
  headingCls,
  options,
  values,
  onFilterChange,
  filterKey,
  activeClass,
  capitalizeRoles,
  formatLabel = v => v,
  suppressAllHighlight = false,
  onAllClick = null,
}) {
  const allActive = values.length === 0 && !suppressAllHighlight;
  const isOn = val => values.includes(val);
  const segBtn =
    'rounded-none border-0 shadow-none shrink-0 px-2 py-0.5 font-medium transition-colors';
  const innerWrap =
    'inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong';

  return (
    <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
      <span className={headingCls}>{heading}</span>
      <div className={innerWrap}>
        <button
          type="button"
          onClick={() => (typeof onAllClick === 'function' ? onAllClick() : onFilterChange(filterKey, null))}
          className={`${segBtn} ${allActive ? `${activeClass} ${segmentedActiveHover}` : segmentedInactive}`}
        >
          All
        </button>
        {options.map(val => (
          <button
            key={val}
            type="button"
            onClick={() => onFilterChange(filterKey, val)}
            className={`${segBtn} ${capitalizeRoles ? 'capitalize' : ''} ${isOn(val) ? `${activeClass} ${segmentedActiveHover}` : segmentedInactive}`}
          >
            {formatLabel(val)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Search + Include (source) controls — used full-width above Library nav + content.
 * `collection` drives the default search placeholder (`Search ${collection}…`); pass `placeholder` to override.
 */
export function LibrarySearchIncludeStrip({ filters, onFilterChange, collection, placeholder }) {
  const { includes = [], search } = filters;
  const mode = getLibraryIncludeMode(includes);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LibrarySearchField
        collection={collection}
        value={search}
        onChange={v => onFilterChange('search', v)}
        className="min-w-[10rem] max-w-xl flex-1"
        placeholder={placeholder}
      />
      <div className="inline-flex max-w-full items-center gap-2 flex-nowrap text-xs text-dh-muted">
        <span className={stripHeadingCls}>Include</span>
        <div className={includeSegWrap}>
          {LIBRARY_SOURCE_MODE_OPTIONS.map(({ mode: m, label }) => (
            <button
              key={m}
              type="button"
              onClick={() => onFilterChange('include', m)}
              className={`${includeSegBtn} ${mode === m ? includeSegOn : includeSegOff}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
 *   suppressSearchInclude - bar variant: omit search + Include row (e.g. rendered above Library layout)
 *   suppressCompetingStructuralAllHighlight - when true (main Library SRD tabs), dim “All” on rows whose structural group is not the active one (`readSharedLibraryFilters`).
 */
export function CollectionFilters({
  collection,
  filters,
  onFilterChange,
  variant = 'bar',
  autoFocusSearch = false,
  showSort = false,
  viewSlider = null,
  suppressSearchInclude = false,
  suppressCompetingStructuralAllHighlight = false,
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
        suppressCompetingStructuralAllHighlight={suppressCompetingStructuralAllHighlight}
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
      suppressSearchInclude={suppressSearchInclude}
      suppressCompetingStructuralAllHighlight={suppressCompetingStructuralAllHighlight}
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

function BarFilters({
  filters,
  onFilterChange,
  typeOptions,
  typeLabel,
  extraOpts,
  extraLabel,
  cfg,
  collection,
  showSort,
  viewSlider,
  suppressSearchInclude,
  suppressCompetingStructuralAllHighlight = false,
}) {
  const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp, sort = 'popularity' } = filters;
  const rankNums = rankNumbers(cfg);
  const typeFormatLabel = collection === 'features' ? formatFeatScopeLabel : v => v;

  const activeStructuralGroup = suppressCompetingStructuralAllHighlight
    ? getFirstActiveStructuralGroup(readSharedLibraryFilters())
    : null;
  const rankRowGroup = getStructuralRowGroupForCollection(collection, 'rank');
  const typeRowGroup = getStructuralRowGroupForCollection(collection, 'type');
  const extraRowGroup = getStructuralRowGroupForCollection(collection, 'extraType');
  const suppressRankAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, rankRowGroup);
  const suppressTypeAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, typeRowGroup);
  const suppressExtraAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, extraRowGroup);

  const baseBtn = 'px-2 py-0.5 rounded font-medium border transition-colors';
  const inactive = 'bg-dh-raised border-dh-strong text-dh-muted hover:border-dh-strong hover:text-dh';
  const headingCls = 'text-dh-muted font-medium uppercase tracking-wider shrink-0 whitespace-nowrap';

  const hasMiddleFilters =
    !!rankNums
    || (typeOptions && typeOptions.length > 0)
    || (extraOpts && extraOpts.length > 0);

  const hasSortOrView = showSort || viewSlider;

  return (
    <div className="mb-5 space-y-2">
      {/* Row 1 — search + source (all collection types); optional strip above Library when suppressed */}
      {!suppressSearchInclude && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LibrarySearchField
            collection={collection}
            value={search}
            onChange={v => onFilterChange('search', v)}
            className="min-w-[10rem]"
          />
          <div className="inline-flex max-w-full items-center gap-2 flex-nowrap text-xs text-dh-muted">
            <span className={headingCls}>Include</span>
            <div className={includeSegWrap}>
              {LIBRARY_SOURCE_MODE_OPTIONS.map(({ mode: m, label }) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onFilterChange('include', m)}
                  className={`${includeSegBtn} ${getLibraryIncludeMode(includes) === m ? includeSegOn : includeSegOff}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 2 — tier / type / extra (varies by collection) */}
      {hasMiddleFilters && (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 text-xs text-dh-muted">
          {rankNums && (
            <div className="inline-flex max-w-full items-start gap-2 flex-nowrap">
              <span className={`${headingCls} pt-0.5`}>
                {cfg.rankMode === 'level' ? 'Level' : 'Tier'}
              </span>
              <div className="flex shrink-0 flex-col gap-1">
                {cfg.rankMode === 'tier' ? (
                  <LibraryTierShieldRow
                    tiers={tiers}
                    includeScaledUp={includeScaledUp}
                    showUpscale={!!cfg.showIncludeScaled && collection === 'adversaries'}
                    onFilterChange={onFilterChange}
                    activeClass="bg-red-800 border-red-500 text-red-100"
                    inactiveClass={inactive}
                    allBtnClass={baseBtn}
                    suppressAllHighlight={suppressRankAll}
                    onAllClick={suppressRankAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
                  />
                ) : (
                  <TierSelector
                    value={tiers.length === 1 ? tiers[0] : null}
                    onChange={t => onFilterChange('tier', t)}
                    multi={false}
                    showAll
                    segmented
                    numbers={rankNums}
                    activeClass="bg-violet-800 border-violet-500 text-violet-100"
                    inactiveClass={inactive}
                    btnClass={baseBtn}
                    suppressAllHighlight={suppressRankAll}
                    onAllClick={suppressRankAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
                  />
                )}
              </div>
            </div>
          )}

          {typeOptions && typeOptions.length > 0 && (
            <>
              {rankNums && <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>}
              <LibraryTypedFilterPickRow
                heading={typeLabel}
                headingCls={headingCls}
                options={typeOptions}
                values={types}
                onFilterChange={onFilterChange}
                filterKey="type"
                activeClass="bg-red-800 border-red-500 text-red-100"
                capitalizeRoles={collection === 'adversaries'}
                formatLabel={typeFormatLabel}
                suppressAllHighlight={suppressTypeAll}
                onAllClick={suppressTypeAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
              />
            </>
          )}

          {extraOpts && extraOpts.length > 0 && (
            <>
              {(rankNums || (typeOptions && typeOptions.length > 0)) && (
                <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>
              )}
              <LibraryTypedFilterPickRow
                heading={extraLabel}
                headingCls={headingCls}
                options={extraOpts}
                values={extraTypes}
                onFilterChange={onFilterChange}
                filterKey="extraType"
                activeClass="bg-red-800 border-red-500 text-red-100"
                capitalizeRoles={false}
                suppressAllHighlight={suppressExtraAll}
                onAllClick={suppressExtraAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
              />
            </>
          )}
        </div>
      )}

      {/* Last row — sort + view (library) */}
      {hasSortOrView && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-dh-border/60 pt-2 text-xs text-dh-muted">
          {showSort && (
            <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
              <span className={headingCls}>Sort</span>
              <div className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong">
                {SORT_OPTIONS.map(({ val: v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onFilterChange('sort', v)}
                    className={`rounded-none border-0 shadow-none shrink-0 px-2 py-0.5 text-xs font-medium ${sort === v ? `bg-dh-hover text-dh ${segmentedActiveHover}` : segmentedInactive}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {viewSlider && (
            <>
              {showSort && <span className="text-dh-muted select-none shrink-0" aria-hidden>|</span>}
              <span className={headingCls}>View</span>
              <span className="inline-flex min-w-[10rem] max-w-[14rem] flex-1 items-center gap-1.5 sm:min-w-[12rem]">
                <ArrowLeftRight size={14} className="shrink-0 text-dh-muted" aria-hidden />
                <span className="shrink-0 text-dh-muted">Width</span>
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
                      className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500"
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
                      className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500"
                    />
                  )}
                </label>
              </span>
              {viewSlider.height && (
                <span className="inline-flex min-w-[10rem] max-w-[14rem] flex-1 items-center gap-1.5 sm:min-w-[12rem]">
                  <ArrowUpDown size={14} className="shrink-0 text-dh-muted" aria-hidden />
                  <span className="shrink-0 text-dh-muted">Height</span>
                  <label className="flex min-w-0 flex-1 items-center">
                    <input
                      type="range"
                      aria-label="Card height"
                      min={viewSlider.height.min ?? 120}
                      max={viewSlider.height.max ?? 480}
                      step={viewSlider.height.step ?? 1}
                      value={viewSlider.height.value}
                      onChange={e => viewSlider.height.onChange(Number(e.target.value))}
                      className="relative top-0.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500"
                    />
                  </label>
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel variant — stacked sections with headers, used in modals / FeatureLibrary
// ---------------------------------------------------------------------------

function PanelFilters({
  filters,
  onFilterChange,
  typeOptions,
  typeLabel,
  extraOpts,
  extraLabel,
  cfg,
  collection,
  autoFocusSearch,
  showSort,
  suppressCompetingStructuralAllHighlight = false,
}) {
  const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp, sort = 'popularity' } = filters;
  const rankNums = rankNumbers(cfg);
  const typeFormatLabel = collection === 'features' ? formatFeatScopeLabel : v => v;

  const activeStructuralGroup = suppressCompetingStructuralAllHighlight
    ? getFirstActiveStructuralGroup(readSharedLibraryFilters())
    : null;
  const rankRowGroup = getStructuralRowGroupForCollection(collection, 'rank');
  const typeRowGroup = getStructuralRowGroupForCollection(collection, 'type');
  const extraRowGroup = getStructuralRowGroupForCollection(collection, 'extraType');
  const suppressRankAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, rankRowGroup);
  const suppressTypeAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, typeRowGroup);
  const suppressExtraAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, extraRowGroup);

  const btnBase = 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border';
  const btnActive = 'bg-red-700 border-red-600 text-white hover:bg-red-600';
  const btnInactive = 'bg-dh-raised border-dh-strong text-dh hover:border-dh-strong hover:text-white';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 transition-colors focus-within:border-blue-500">
          <Search size={14} className="shrink-0 text-dh-muted" />
          <input
            autoFocus={autoFocusSearch}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-dh-muted"
            placeholder="Search by name..."
            value={search}
            onChange={e => onFilterChange('search', e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-dh-muted">Source</div>
          <div className={includeSegWrap}>
            {LIBRARY_SOURCE_MODE_OPTIONS.map(({ mode: m, label }) => (
              <button
                key={m}
                type="button"
                onClick={() => onFilterChange('include', m)}
                className={`${includeSegBtn} ${getLibraryIncludeMode(includes) === m ? includeSegOn : includeSegOff}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rankNums && (
        <div>
          <div className="text-xs font-medium text-dh-muted uppercase tracking-wider mb-2">
            {cfg.rankMode === 'level' ? 'Level' : 'Tier'}
          </div>
          <div className="flex flex-col gap-1.5">
            {cfg.rankMode === 'tier' ? (
              <LibraryTierShieldRow
                tiers={tiers}
                includeScaledUp={includeScaledUp}
                showUpscale={!!cfg.showIncludeScaled && collection === 'adversaries'}
                onFilterChange={onFilterChange}
                activeClass={btnActive}
                inactiveClass={btnInactive}
                allBtnClass={btnBase}
                suppressAllHighlight={suppressRankAll}
                onAllClick={suppressRankAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
              />
            ) : (
              <TierSelector
                value={tiers.length === 1 ? tiers[0] : null}
                onChange={t => onFilterChange('tier', t)}
                multi={false}
                showAll
                segmented
                numbers={rankNums}
                activeClass={btnActive}
                inactiveClass={btnInactive}
                btnClass={btnBase}
                suppressAllHighlight={suppressRankAll}
                onAllClick={suppressRankAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
              />
            )}
          </div>
        </div>
      )}

      {typeOptions && typeOptions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-dh-muted uppercase tracking-wider mb-2">{typeLabel}</div>
          <div className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong">
            <button
              type="button"
              onClick={() => (suppressTypeAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('type', null))}
              className={`rounded-none border-0 px-2.5 py-1 text-xs font-medium ${types.length === 0 && !suppressTypeAll ? `${btnActive} ${segmentedActiveHover}` : segmentedInactive}`}
            >
              All
            </button>
            {typeOptions.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('type', val)}
                className={`rounded-none border-0 px-2.5 py-1 text-xs font-medium ${collection === 'adversaries' ? 'capitalize' : ''} ${types.includes(val) ? `${btnActive} ${segmentedActiveHover}` : segmentedInactive}`}
              >
                {typeFormatLabel(val)}
              </button>
            ))}
          </div>
        </div>
      )}

      {extraOpts && extraOpts.length > 0 && (
        <div>
          <div className="text-xs font-medium text-dh-muted uppercase tracking-wider mb-2">{extraLabel}</div>
          <div className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong">
            <button
              type="button"
              onClick={() => (suppressExtraAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('extraType', null))}
              className={`rounded-none border-0 px-2.5 py-1 text-xs font-medium ${extraTypes.length === 0 && !suppressExtraAll ? `${btnActive} ${segmentedActiveHover}` : segmentedInactive}`}
            >
              All
            </button>
            {extraOpts.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('extraType', val)}
                className={`rounded-none border-0 px-2.5 py-1 text-xs font-medium ${extraTypes.includes(val) ? `${btnActive} ${segmentedActiveHover}` : segmentedInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSort && (
        <div>
          <div className="text-xs font-medium text-dh-muted uppercase tracking-wider mb-2">Sort</div>
          <div className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong">
            {SORT_OPTIONS.map(({ val: v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => onFilterChange('sort', v)}
                className={`rounded-none border-0 px-2.5 py-1 text-xs font-medium ${sort === v ? `${btnActive} ${segmentedActiveHover}` : segmentedInactive}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

