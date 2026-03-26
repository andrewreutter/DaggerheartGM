import { ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { ROLES, ENV_TYPES } from '../lib/constants.js';
import { TierSelector } from './TierSelector.jsx';
import { LibraryTierShieldRow } from './LibraryTierShieldRow.jsx';
import {
  ABILITY_DOMAINS,
  ABILITY_LEVELS,
  FEAT_SCOPE_OPTIONS,
  formatFeatScopeLabel,
  WEAPON_PHY_MAG,
  WEAPON_SLOT_TYPES,
} from '../lib/library-filter-config.js';
import { LibrarySearchIncludeStrip } from './CollectionFilters.jsx';
import {
  getFirstActiveStructuralGroup,
  shouldSuppressStructuralAllHighlight,
  LIBRARY_STRUCTURAL_RESET_KEY,
} from '../lib/library-shared-filters.js';

const SORT_OPTIONS = [
  { val: 'popularity', label: 'Popularity' },
  { val: 'name', label: 'Name' },
  { val: 'type', label: 'Role/Type' },
  { val: 'source', label: 'Source' },
  { val: 'tier', label: 'Tier' },
];

const baseBtn = 'px-2 py-0.5 rounded font-medium border transition-colors';
const inactive = 'bg-dh-raised border-dh-strong text-dh-muted hover:border-dh-strong hover:text-dh';
const headingCls = 'text-dh-muted font-medium uppercase tracking-wider shrink-0 whitespace-nowrap';

const segWrap =
  'inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-dh-strong shadow-sm divide-x divide-dh-strong';
const segBtn = 'rounded-none border-0 shadow-none shrink-0 px-2 py-0.5 font-medium transition-colors';
const segInactive =
  'bg-dh-raised text-dh-muted transition-colors hover:bg-dh-hover hover:text-dh';
const segActive = 'bg-red-800 text-red-100 transition-colors hover:brightness-110';

/**
 * Combined filter bar for Library “All” tab — each row applies only to the collections
 * described in the plan (tier → adversaries/environments/weapons/armor/beastforms, etc.).
 * @param suppressSearchInclude - omit search + Include row (e.g. rendered above Library layout)
 */
export function LibraryAllFilters({ filters, onFilterChange, showSort = true, viewSlider = null, suppressSearchInclude = false }) {
  const {
    tiers = [],
    levels = [],
    advRole = [],
    envType = [],
    ablDomain = [],
    wpnSlot = [],
    wpnPhyMag = [],
    featScope = [],
    includeScaledUp,
    sort = 'popularity',
  } = filters;

  const activeStructuralGroup = getFirstActiveStructuralGroup(filters);
  const suppressTierAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'tier');
  const suppressLevelAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'level');
  const suppressAdvRoleAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'advRole');
  const suppressEnvTypeAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'envType');
  const suppressAblDomainAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'ablDomain');
  const suppressWeaponAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'weapon');
  const suppressFeatScopeAll = shouldSuppressStructuralAllHighlight(activeStructuralGroup, 'featScope');

  return (
    <div className="mb-5 space-y-2">
      {!suppressSearchInclude && (
        <LibrarySearchIncludeStrip filters={filters} onFilterChange={onFilterChange} collection="library" />
      )}

      <p className="text-[10px] text-dh-muted/90 leading-snug max-w-4xl">
        Tier applies to adversaries, environments, weapons, armor, beastforms, and Features (V2 catalog tier from the feature source). Level filters abilities only. Other rows apply to a single type (see labels). Only one structural filter is active at a time—choosing a new row clears the previous.
      </p>

      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 text-xs text-dh-muted">
        <div className="inline-flex max-w-full items-start gap-2 flex-nowrap">
          <span className={`${headingCls} pt-0.5`}>Tier</span>
          <LibraryTierShieldRow
            tiers={tiers}
            includeScaledUp={includeScaledUp}
            showUpscale
            onFilterChange={onFilterChange}
            activeClass="bg-red-800 border-red-500 text-red-100"
            inactiveClass={inactive}
            allBtnClass={baseBtn}
            suppressAllHighlight={suppressTierAll}
            onAllClick={suppressTierAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
          />
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-start gap-2 flex-nowrap">
          <span className={`${headingCls} pt-0.5`}>Level</span>
          <span className="text-[10px] text-dh-muted/80 pt-1">(abilities)</span>
          <TierSelector
            value={levels.length === 1 ? levels[0] : null}
            onChange={lv => onFilterChange('level', lv)}
            multi={false}
            showAll
            segmented
            numbers={ABILITY_LEVELS}
            activeClass="bg-violet-800 border-violet-500 text-violet-100"
            inactiveClass={inactive}
            btnClass={baseBtn}
            suppressAllHighlight={suppressLevelAll}
            onAllClick={suppressLevelAll ? () => onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : undefined}
          />
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Role</span>
          <span className="text-[10px] text-dh-muted/80">(adv.)</span>
          <div className={`${segWrap} max-w-[min(100%,42rem)]`}>
            <button
              type="button"
              onClick={() => (suppressAdvRoleAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('advRole', null))}
              className={`${segBtn} ${advRole.length === 0 && !suppressAdvRoleAll ? segActive : segInactive}`}
            >
              All
            </button>
            {ROLES.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('advRole', val)}
                className={`${segBtn} capitalize ${advRole.includes(val) ? segActive : segInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Env type</span>
          <div className={segWrap}>
            <button
              type="button"
              onClick={() => (suppressEnvTypeAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('envType', null))}
              className={`${segBtn} ${envType.length === 0 && !suppressEnvTypeAll ? segActive : segInactive}`}
            >
              All
            </button>
            {ENV_TYPES.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('envType', val)}
                className={`${segBtn} ${envType.includes(val) ? segActive : segInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Domain</span>
          <span className="text-[10px] text-dh-muted/80">(abil.)</span>
          <div className={`${segWrap} max-w-[min(100%,36rem)]`}>
            <button
              type="button"
              onClick={() => (suppressAblDomainAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('ablDomain', null))}
              className={`${segBtn} ${ablDomain.length === 0 && !suppressAblDomainAll ? segActive : segInactive}`}
            >
              All
            </button>
            {ABILITY_DOMAINS.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('ablDomain', val)}
                className={`${segBtn} ${ablDomain.includes(val) ? segActive : segInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Slot</span>
          <span className="text-[10px] text-dh-muted/80">(wpn.)</span>
          <div className={segWrap}>
            <button
              type="button"
              onClick={() => (suppressWeaponAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('wpnSlot', null))}
              className={`${segBtn} ${wpnSlot.length === 0 && !suppressWeaponAll ? segActive : segInactive}`}
            >
              All
            </button>
            {WEAPON_SLOT_TYPES.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('wpnSlot', val)}
                className={`${segBtn} ${wpnSlot.includes(val) ? segActive : segInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
          <span className={headingCls}>Damage</span>
          <span className="text-[10px] text-dh-muted/80">(wpn.)</span>
          <div className={segWrap}>
            <button
              type="button"
              onClick={() => (suppressWeaponAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('wpnPhyMag', null))}
              className={`${segBtn} ${wpnPhyMag.length === 0 && !suppressWeaponAll ? segActive : segInactive}`}
            >
              All
            </button>
            {WEAPON_PHY_MAG.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('wpnPhyMag', val)}
                className={`${segBtn} ${wpnPhyMag.includes(val) ? segActive : segInactive}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <span className="text-dh-muted select-none shrink-0 pt-0.5" aria-hidden>|</span>

        <div className="inline-flex max-w-full items-start gap-2 flex-nowrap">
          <span className={`${headingCls} pt-0.5`}>Feat scope</span>
          <span className="text-[10px] text-dh-muted/80 pt-1">(V2)</span>
          <div className={`${segWrap} max-w-[min(100%,42rem)] overflow-x-auto`}>
            <button
              type="button"
              onClick={() => (suppressFeatScopeAll ? onFilterChange(LIBRARY_STRUCTURAL_RESET_KEY) : onFilterChange('featScope', null))}
              className={`${segBtn} ${featScope.length === 0 && !suppressFeatScopeAll ? segActive : segInactive}`}
            >
              All
            </button>
            {FEAT_SCOPE_OPTIONS.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onFilterChange('featScope', val)}
                className={`${segBtn} ${featScope.includes(val) ? segActive : segInactive}`}
              >
                {formatFeatScopeLabel(val)}
              </button>
            ))}
          </div>
        </div>

      </div>

      {(showSort || viewSlider) && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-dh-border/60 pt-2 text-xs text-dh-muted">
          {showSort && (
            <div className="inline-flex max-w-full items-center gap-2 flex-nowrap">
              <span className={headingCls}>Sort</span>
              <div className={`${segWrap} max-w-[min(100%,28rem)] overflow-x-auto`}>
                {SORT_OPTIONS.map(({ val: v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onFilterChange('sort', v)}
                    className={`${segBtn} ${sort === v ? segActive : segInactive}`}
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
