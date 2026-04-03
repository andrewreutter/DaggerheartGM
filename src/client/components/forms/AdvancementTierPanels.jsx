import { forwardRef, useCallback, useMemo } from 'react';
import { ArrowRight, Lock, Swords } from 'lucide-react';
import { CustomSelect } from './CustomSelect.jsx';
import { AdvancementPickDetail, AdvancementTraitsCombined } from './advancement-pick-detail.jsx';
import {
  ADVANCEMENT_BAND_SHEET_TITLES,
  ADVANCEMENT_TIER_INSTRUCTIONS,
  ADVANCEMENT_TYPE_LABELS,
  advancementTypesAvailableForLevelRow,
  buildBandSlotDisplayCells,
  countAutomaticProficiencyBonuses,
  dedupeTraitPicksAcrossLevelRow,
  describeMulticlassSubclassUpgradeCrossout,
  describeSubclassUpgradeMulticlassCrossout,
  effectiveMulticlassBudgetForBand,
  effectiveSubclassUpgradeBudgetForBand,
  effectiveSlotCountForBandType,
  experienceRowIndexForTierEntryLevel,
  formatSubclassUpgradeAdvancementOptionLabel,
  getAdvancementIncompleteLevelKeys,
  hasAdvancementChoicesLockField,
  isAdvancementLockedThroughCurrentLevel,
  isAdvancementPickFullyResolved,
  isCurrentCharacterLevelAdvancementRowEditable,
  isDoubleSlotAdvancementType,
  isValidAdvancementPickType,
  listOrderedBandSlotFills,
  listSubclassUpgradePicks,
  randomizeLevelAdvancementChoices,
  TIER_ENTRY_LEVELS,
  tierEntryLevelForBand,
  tryAssignAdvancementPickAtFocusLevel,
  tryClearBandSlotAtOrdinal,
  clearMulticlassPicksFromAdvancementsUpToLevel,
  countMulticlassPicksGlobally,
  levelsInBandUpToCharacterLevel,
  SLOT_BUDGET_PER_BAND,
} from '../../lib/advancement-rules.js';
import { getAncestryExperienceBonus } from '../../lib/ancestry-experience-bonus.js';

const ADVANCEMENT_TYPE_ORDER = [
  'traits',
  'hp',
  'stress',
  'evasion',
  'experience',
  'proficiency',
  'domain_card',
  'subclass_upgrade',
  'multiclass',
];

const TIER_FOOTER =
  'Your level and damage thresholds have been adjusted accordingly.';

function optionLabelForType(type, ctx) {
  const { subclass, advancements, advancementLevel, pickIndex, multiclassClassId } = ctx;
  if (type === 'subclass_upgrade') {
    return formatSubclassUpgradeAdvancementOptionLabel({
      subclass,
      advancements,
      advancementLevel,
      pickIndex: pickIndex ?? 0,
      multiclassClassId,
    });
  }
  return ADVANCEMENT_TYPE_LABELS[type] || type;
}

/**
 * Sheet-style tier columns (stacked vertically). Mutates `advancements` via `set`.
 */
export const AdvancementTierPanels = forwardRef(function AdvancementTierPanels(
  {
    formData,
    set,
    srdData,
    characterLevel,
    selectedSubclass,
    patchExperienceNameAtIndex,
    abilityOptionsForAdvancementLevel,
    allSelectedDomainCardIds,
    collectOwnedDomainAbilityIdsThroughCharacterLevel,
    getTradeToOptions,
    traitKeys,
  },
  ref,
) {
  const level = Number(characterLevel) || 1;
  const advancements = formData.advancements || {};
  const experiences = formData.experiences || [];

  /** Current-level row: editable until the user clicks Lock Level Choices (see advancement lock field). */
  const currentLevelAdvancementEditable = isCurrentCharacterLevelAdvancementRowEditable(formData);
  /** Only the character’s current level row is editable; earlier levels are read-only. */
  const rowEditable = (lv) => Number(lv) === level && currentLevelAdvancementEditable;

  const bandsVisible = useMemo(() => {
    const out = [];
    if (level >= 2) out.push('A');
    if (level >= 5) out.push('B');
    if (level >= 8) out.push('C');
    return out;
  }, [level]);

  const sampleLevelForBand = (band) => {
    const lvls = levelsInBandUpToCharacterLevel(level, band);
    return lvls[0] ?? 2;
  };

  const typesForBand = (band) => {
    const sample = sampleLevelForBand(band);
    const allowed = advancementTypesAvailableForLevelRow({
      advancementLevel: sample,
      characterLevel: level,
    });
    return ADVANCEMENT_TYPE_ORDER.filter((t) => {
      if (!allowed.includes(t)) return false;
      const n = effectiveSlotCountForBandType(advancements, level, band, t);
      if (n > 0) return true;
      // Multiclass crosses out this tier’s subclass upgrade slot — still show the row (disabled).
      if (
        t === 'subclass_upgrade' &&
        (SLOT_BUDGET_PER_BAND[band]?.subclass_upgrade ?? 0) > 0 &&
        effectiveSubclassUpgradeBudgetForBand(advancements, level, band) === 0
      ) {
        return true;
      }
      // Subclass upgrade crosses out this tier’s multiclass slot — still show the row (disabled).
      if (t === 'multiclass' && describeSubclassUpgradeMulticlassCrossout(advancements, level, band)) {
        return true;
      }
      return false;
    });
  };

  const patchPickAtLevel = (lv, pickIndex, nextPick) => {
    if (!rowEditable(lv)) return;
    const key = String(lv);
    const row = { ...(advancements[key] || {}) };
    let picks = [...(row.picks || [])];
    while (picks.length < 2) picks.push(null);
    picks[pickIndex] = nextPick;
    picks = dedupeTraitPicksAcrossLevelRow(picks);
    if (isDoubleSlotAdvancementType(picks[0]?.type)) picks[1] = null;
    const nextRow = { ...row, picks };
    set({
      advancements: {
        ...advancements,
        [key]: nextRow,
      },
    });
  };

  const getPickRef = (fill) => {
    if (!fill) return null;
    const row = advancements[String(fill.level)] || {};
    const picks = row.picks || [];
    return picks[fill.pickIndex] || null;
  };

  const occupiedDomainIdsExcludingCurrentRow = useMemo(() => {
    const ids = new Set(allSelectedDomainCardIds);
    const row = advancements[String(level)] || {};
    if (row.domainCardId) ids.delete(row.domainCardId);
    for (const p of row.picks || []) {
      if (p?.type === 'domain_card' && p?.abilityId) ids.delete(p.abilityId);
    }
    return ids;
  }, [allSelectedDomainCardIds, advancements, level]);

  const handleRandomizeThisLevel = useCallback(() => {
    if (!rowEditable(level)) return;
    const patch = randomizeLevelAdvancementChoices({
      formData,
      characterLevel: level,
      srdData,
      abilityOptionsForRow: abilityOptionsForAdvancementLevel(level),
      occupiedDomainCardIds: occupiedDomainIdsExcludingCurrentRow,
      getTradeReplacementOptions: getTradeToOptions,
      tradeFromIds: collectOwnedDomainAbilityIdsThroughCharacterLevel(formData, level - 1),
      traitKeysOrder: traitKeys,
    });
    set(patch);
  }, [
    formData,
    level,
    srdData,
    abilityOptionsForAdvancementLevel,
    occupiedDomainIdsExcludingCurrentRow,
    getTradeToOptions,
    collectOwnedDomainAbilityIdsThroughCharacterLevel,
    traitKeys,
    set,
  ]);

  return (
    <div ref={ref} className="space-y-4 w-full max-w-2xl mx-auto">
      {bandsVisible.map((band) => {
        const bandLevels = levelsInBandUpToCharacterLevel(level, band);
        const canEditAdvancementInThisBand = bandLevels.includes(level);
        const tierEntry = tierEntryLevelForBand(band);
        const expIdxTier = tierEntry != null ? experienceRowIndexForTierEntryLevel(tierEntry) : null;
        const types = typesForBand(band);

        return (
          <div
            key={band}
            data-advancement-tier-band={band}
            className="border border-dh-border rounded-lg overflow-hidden bg-dh-canvas/30 shadow-sm"
          >
            <div className="px-3 py-2 bg-dh-inset/80 border-b border-dh-border/80">
              <div
                className="text-center text-xs font-bold tracking-wide text-dh uppercase px-4 py-1.5 bg-dh-raised/90 border border-dh-border rounded-sm"
                style={{ clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0% 50%)' }}
              >
                {ADVANCEMENT_BAND_SHEET_TITLES[band]}
              </div>
            </div>

            {canEditAdvancementInThisBand && currentLevelAdvancementEditable ? (
              <div className="px-3 py-2 border-b border-dh-border/60 bg-dh-canvas/20">
                <button
                  type="button"
                  onClick={handleRandomizeThisLevel}
                  className="w-full py-2 px-3 rounded border text-sm font-medium transition-colors bg-sky-900/50 border-sky-700/70 text-sky-200 hover:bg-sky-800/60 hover:border-sky-600"
                >
                  Randomize this level
                </button>
              </div>
            ) : null}

            {tierEntry != null && level >= tierEntry && expIdxTier != null && (
              <div className="px-3 py-2 bg-dh-inset/60 border-b border-dh-border/60 space-y-2">
                <p className="text-[11px] text-dh-muted italic leading-snug">
                  At level {tierEntry}, gain an additional Experience at +2
                  {band !== 'A' ? ' and clear all marks on character traits' : ''}. Then gain a +1 bonus to
                  your Proficiency (applied to damage dice).
                </p>
                {(() => {
                  const exp = experiences[expIdxTier];
                  if (!exp) return null;
                  const tierExpNameEditable = tierEntry === level && currentLevelAdvancementEditable;
                  const ancestryId = formData.ancestryIds?.[0];
                  const ancestryName = ancestryId ? srdData?.ancestriesById?.[ancestryId]?.name : null;
                  const expBonus = ancestryName ? getAncestryExperienceBonus(ancestryName) : null;
                  const chosenExpId = expBonus ? formData.experienceBonusChoices?.[expBonus.featureName] : null;
                  const isChosen = expBonus && exp.id === chosenExpId;
                  const displayScore = exp.score ?? 2;
                  return (
                    <div className="rounded-md bg-dh-raised/80 border border-dh-border px-2 py-2">
                      <label className="text-[11px] text-dh-muted font-medium">Tier experience (+2)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={exp.name || ''}
                          onChange={(e) => patchExperienceNameAtIndex(expIdxTier, e.target.value)}
                          disabled={!tierExpNameEditable}
                          data-level-up-first-focus={tierExpNameEditable ? 'tier-exp' : undefined}
                          className="flex-1 bg-dh-canvas border border-dh-border rounded px-2 py-1 text-sm text-dh focus:border-sky-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          placeholder="Experience name"
                        />
                        <span
                          className="text-sm font-bold text-sky-400 tabular-nums w-8 text-center shrink-0"
                          title={isChosen ? `${ancestryName} bonus +${expBonus.amount}` : undefined}
                        >
                          +{displayScore}
                        </span>
                      </div>
                      {exp.tierEntryAuto && !exp.name?.trim() ? (
                        <div className="text-[10px] text-dh-muted mt-1">Name this tier experience (+2).</div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Per-level domain + trade — above slot grid / “choose two options” */}
            <div className="px-3 py-2 space-y-2 border-b border-dh-border/60">
              <div className="text-[10px] font-semibold text-dh-muted uppercase tracking-wide">Per level — domain &amp; optional trade</div>
              {bandLevels.map((lvl, i) => {
                const advKey = String(lvl);
                const adv = advancements[advKey] || { picks: [] };
                const advOptsLvl = abilityOptionsForAdvancementLevel(lvl);
                const tradeFromIds = collectOwnedDomainAbilityIdsThroughCharacterLevel(formData, lvl - 1);
                const fromId = adv.domainTrade?.fromId ?? null;
                const toId = adv.domainTrade?.toId ?? null;
                const rowTradeOpts = getTradeToOptions(fromId);
                const patchRowTrade = (nextTrade) => {
                  if (!rowEditable(lvl)) return;
                  const nextRow = { ...adv };
                  if (nextTrade == null) {
                    delete nextRow.domainTrade;
                  } else {
                    const t = {};
                    if (nextTrade.fromId) t.fromId = nextTrade.fromId;
                    if (nextTrade.toId) t.toId = nextTrade.toId;
                    if (Object.keys(t).length === 0) delete nextRow.domainTrade;
                    else nextRow.domainTrade = t;
                  }
                  set({
                    advancements: {
                      ...advancements,
                      [advKey]: nextRow,
                    },
                  });
                };
                const domainRowEditable = rowEditable(lvl);
                const domainIsFirstWidgetForLevel =
                  domainRowEditable && !TIER_ENTRY_LEVELS.includes(lvl);
                return (
                  <div
                    key={`${band}-domain-${lvl}`}
                    data-advancement-domain-for-level={lvl}
                    data-level-up-first-focus={domainIsFirstWidgetForLevel ? 'domain' : undefined}
                    className={`space-y-1 ${i > 0 ? 'pt-2 border-t border-dh-border/30' : ''}`}
                  >
                    <div className="text-xs font-semibold text-dh">Level {lvl}</div>
                    <div>
                      <CustomSelect
                        value={adv.domainCardId || null}
                        onChange={(id) => {
                          if (!rowEditable(lvl)) return;
                          set({
                            advancements: {
                              ...(formData.advancements || {}),
                              [advKey]: { ...adv, domainCardId: id },
                            },
                          });
                        }}
                        disabled={!domainRowEditable}
                        options={advOptsLvl
                          .filter((a) => !allSelectedDomainCardIds.has(a.id) || a.id === adv.domainCardId)
                          .map((a) => a.id)}
                        getOptionKey={(id) => id}
                        getOptionLabel={(id) => {
                          const a = srdData?.abilitiesById?.[id];
                          return a ? `${a.name} (Lvl ${a.level}, ${a.domain})` : id;
                        }}
                        getOptionDescription={(id) => srdData?.abilitiesById?.[id]?.description}
                        placeholder="Select a domain card..."
                        className="text-sm"
                      />
                    </div>
                    {tradeFromIds.length > 0 ? (
                      <div className="text-[11px] text-dh-muted mt-1">
                        <div className="flex flex-wrap gap-2 items-center">
                          <div className="min-w-[120px] flex-1">
                            <CustomSelect
                              value={fromId}
                              onChange={(id) => {
                                if (!id) patchRowTrade(null);
                                else patchRowTrade({ fromId: id, toId: null });
                              }}
                              options={tradeFromIds}
                              getOptionKey={(id) => id}
                              getOptionLabel={(id) => {
                                const a = srdData?.abilitiesById?.[id];
                                return a ? `${a.name} (Lvl ${a.level})` : id;
                              }}
                              placeholder="Card to replace…"
                              className="text-xs"
                              disabled={!domainRowEditable}
                            />
                          </div>
                          <ArrowRight
                            className="shrink-0 text-dh-muted opacity-80"
                            size={18}
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <div className="min-w-[120px] flex-1">
                            <CustomSelect
                              value={toId}
                              onChange={(id) => {
                                if (!fromId) return;
                                if (!id) patchRowTrade({ fromId });
                                else patchRowTrade({ fromId, toId: id });
                              }}
                              options={rowTradeOpts.map((a) => a.id)}
                              getOptionKey={(id) => id}
                              getOptionLabel={(id) => {
                                const a = srdData?.abilitiesById?.[id];
                                return a ? `${a.name} (Lvl ${a.level}, ${a.domain})` : id;
                              }}
                              placeholder="Replacement…"
                              className="text-xs"
                              disabled={!fromId || !domainRowEditable}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 space-y-3 border-b border-dh-border/50">
              <p className="text-center text-[11px] text-dh-muted leading-snug">{ADVANCEMENT_TIER_INSTRUCTIONS[band]}</p>
              {bandLevels.includes(level) ? (
                <p className="text-[11px] text-dh-muted text-center">
                  Marking choices for level <span className="font-semibold text-dh tabular-nums">{level}</span>
                </p>
              ) : (
                <p className="text-[11px] text-dh-muted text-center italic">
                  This tier column is behind your current level — choices here are read-only.
                </p>
              )}
            </div>

            {(() => {
              const cross = describeMulticlassSubclassUpgradeCrossout(advancements, level, band);
              if (!cross) return null;
              const subUp = listSubclassUpgradePicks(advancements, level);
              return (
                <div className="mx-3 mt-2 text-[10px] text-amber-200/90 bg-amber-950/40 border border-amber-800/40 rounded px-2 py-1.5 space-y-1">
                  <p>
                    One subclass upgrade slot in <span className="font-medium text-amber-100">{cross.bandLabel}</span>{' '}
                    is crossed out (multiclass taken at level {cross.multiclassLevel}).
                  </p>
                  {subUp.length > 0 ? (
                    <p className="text-dh-muted">
                      Subclass upgrade picks recorded at level{subUp.length === 1 ? '' : 's'}:{' '}
                      {subUp.map((x) => x.level).join(', ')}.
                    </p>
                  ) : null}
                </div>
              );
            })()}
            {(() => {
              const crossMc = describeSubclassUpgradeMulticlassCrossout(advancements, level, band);
              if (!crossMc) return null;
              return (
                <div className="mx-3 mt-2 text-[10px] text-amber-200/90 bg-amber-950/40 border border-amber-800/40 rounded px-2 py-1.5">
                  <p>
                    Multiclass in <span className="font-medium text-amber-100">{crossMc.bandLabel}</span> is crossed out
                    (subclass upgrade taken at level {crossMc.subclassUpgradeLevel}).
                  </p>
                </div>
              );
            })()}

            <div className="px-2 py-3 space-y-3">
              {types.map((type) => {
                const cells = buildBandSlotDisplayCells(advancements, level, band, type);
                const fills = listOrderedBandSlotFills(advancements, level, band, type);
                const sm = sampleLevelForBand(band);
                const subUpBudgetBand = effectiveSubclassUpgradeBudgetForBand(advancements, level, band);
                const baseSubUpSlots = SLOT_BUDGET_PER_BAND[band]?.subclass_upgrade ?? 0;
                const mcBudgetBand = effectiveMulticlassBudgetForBand(advancements, level, band);
                const baseMcSlots = SLOT_BUDGET_PER_BAND[band]?.multiclass ?? 0;
                let label = optionLabelForType(type, {
                  subclass: selectedSubclass,
                  advancements,
                  advancementLevel: sm,
                  pickIndex: 0,
                  multiclassClassId: formData.multiclassClassId,
                });
                if (type === 'subclass_upgrade' && subUpBudgetBand === 0 && baseSubUpSlots > 0) {
                  label = 'Subclass upgrade — unavailable (multiclass uses this tier’s upgrade slot)';
                }
                if (type === 'multiclass' && mcBudgetBand === 0 && baseMcSlots > 0) {
                  label = 'Multiclass — unavailable (subclass upgrade uses this tier’s multiclass slot)';
                }
                const isBigSlot = type === 'proficiency' || type === 'multiclass';
                const showSubclassUpgradeCrossedOut =
                  type === 'subclass_upgrade' &&
                  subUpBudgetBand === 0 &&
                  baseSubUpSlots > 0 &&
                  cells.length === 0;
                const showMulticlassCrossedOut =
                  type === 'multiclass' &&
                  mcBudgetBand === 0 &&
                  baseMcSlots > 0 &&
                  cells.length === 0;

                return (
                  <div
                    key={`${band}-${type}`}
                    className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2"
                  >
                    <div
                      className="flex justify-end gap-1 min-w-[5.5rem] self-center"
                    >
                      {showSubclassUpgradeCrossedOut ? (
                        <button
                          type="button"
                          disabled
                          title="Crossed out — multiclass uses this tier’s subclass upgrade slot"
                          className="flex items-center justify-center rounded border w-7 h-7 text-[11px] border-dh-border/60 bg-dh-inset/40 text-dh-muted opacity-70 cursor-not-allowed"
                        >
                          <Lock size={14} aria-hidden />
                        </button>
                      ) : null}
                      {showMulticlassCrossedOut ? (
                        <>
                          <button
                            type="button"
                            disabled
                            title="Crossed out — subclass upgrade uses this tier’s multiclass slot"
                            className="flex items-center justify-center rounded border w-7 h-7 text-[11px] border-dh-border/60 bg-dh-inset/40 text-dh-muted opacity-70 cursor-not-allowed"
                          >
                            <Lock size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Crossed out — subclass upgrade uses this tier’s multiclass slot"
                            className="flex items-center justify-center rounded border w-7 h-7 text-[11px] border-dh-border/60 bg-dh-inset/40 text-dh-muted opacity-70 cursor-not-allowed"
                          >
                            <Lock size={14} aria-hidden />
                          </button>
                        </>
                      ) : null}
                      {cells.map((cell, idx) => {
                        const filled = cell.level != null;
                        const slotLevel = cell.level;
                        const slotEditable =
                          canEditAdvancementInThisBand &&
                          (filled ? rowEditable(slotLevel) : rowEditable(level));
                        return (
                          <button
                            key={`${band}-${type}-slot-${idx}`}
                            type="button"
                            disabled={!slotEditable}
                            title={
                              !canEditAdvancementInThisBand
                                ? 'Read-only — your current level is not in this tier column'
                                : filled
                                  ? rowEditable(slotLevel)
                                    ? `Level ${slotLevel} — click to clear`
                                    : `Level ${slotLevel} — read-only`
                                  : `Assign at level ${level} — click to fill`
                            }
                            onClick={() => {
                              if (!slotEditable) return;
                              if (filled) {
                                const ord = isDoubleSlotAdvancementType(type) ? 0 : idx;
                                const next = tryClearBandSlotAtOrdinal(advancements, level, band, type, ord);
                                if (next) {
                                  const patch = { advancements: next };
                                  if (
                                    type === 'multiclass' &&
                                    countMulticlassPicksGlobally(next, level) === 0
                                  ) {
                                    patch.multiclassClassId = null;
                                    patch.multiclassSubclassId = null;
                                    patch.multiclassDomain = null;
                                    patch.spellcastTraitSource = null;
                                  }
                                  set(patch);
                                }
                                return;
                              }
                              const next = tryAssignAdvancementPickAtFocusLevel(
                                advancements,
                                level,
                                level,
                                type,
                              );
                              if (next) set({ advancements: next });
                            }}
                            className={`flex items-center justify-center rounded border font-bold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-sky-600/50 ${
                              isBigSlot ? 'w-9 h-9 text-sm border-dh-border bg-dh-raised' : 'w-7 h-7 text-[11px] border-dh-border bg-dh-raised'
                            } ${
                              filled
                                ? 'text-sky-300 border-sky-700/60 bg-sky-950/40'
                                : 'text-dh-muted hover:border-sky-700/50 hover:bg-dh-hover/30'
                            } ${!slotEditable ? 'opacity-50 cursor-not-allowed hover:border-dh-border hover:bg-dh-raised' : ''}`}
                          >
                            {filled ? cell.level : ''}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className={`min-w-0 text-[12px] text-dh leading-snug self-center ${isBigSlot ? 'font-semibold' : ''}`}
                    >
                      {label}
                    </div>
                    <div className="col-start-2 min-w-0 w-full space-y-2">
                      {type === 'traits' && fills.length > 0 ? (
                        <div className="rounded border border-dh-border/70 bg-dh-inset/25 px-2 py-1.5">
                          <AdvancementTraitsCombined
                            fills={fills}
                            advancements={advancements}
                            characterLevel={level}
                            editableLevel={level}
                            band={band}
                            traitKeys={traitKeys}
                            patchPickAtLevel={patchPickAtLevel}
                          />
                        </div>
                      ) : null}
                      {fills.map((fill, fi) => {
                        const p = getPickRef(fill);
                        if (!p || !isValidAdvancementPickType(p.type)) return null;
                        if (p.type === 'traits') return null;
                        const advRow = advancements[String(fill.level)] || {};

                        if (p.type === 'multiclass') {
                          const mcPickReadOnly = !rowEditable(fill.level);
                          const mcMeta = formData.multiclassClassId
                            ? srdData?.classesById?.[formData.multiclassClassId]
                            : null;
                          const subOpts = (srdData?.subclasses || []).filter((sc) =>
                            (mcMeta?.subclasses || []).includes(sc.name),
                          );
                          const mcDoms = mcMeta?.domains || [];
                          const primaryRaw = selectedSubclass?.spellcast_trait;
                          const primaryHas = primaryRaw != null && String(primaryRaw).trim() !== '';
                          const mcRaw = formData.multiclassSubclassId
                            ? srdData?.subclassesById?.[formData.multiclassSubclassId]?.spellcast_trait
                            : null;
                          const mcHas = mcRaw != null && String(mcRaw).trim() !== '';
                          return (
                            <div
                              key={fi}
                              className="rounded border border-dh-border/80 bg-dh-inset/30 px-2 py-2 space-y-2"
                            >
                              <div className="text-[10px] text-dh-muted font-medium">
                                Level {fill.level} — Multiclass
                              </div>
                              <p className="text-[10px] text-dh-muted leading-snug">
                                Book: multiclass uses both picks at that level (level 5+). You may take it once in
                                Tier 3 (levels 5–7) and once in Tier 4 (8–10); each time you cross out one subclass
                                upgrade in that tier column. You cannot gain mastery subclass features from leveling
                                while multiclassed.
                              </p>
                              <CustomSelect
                                value={formData.multiclassClassId || null}
                                onChange={(id) => {
                                  if (mcPickReadOnly) return;
                                  if (!id) {
                                    set({
                                      advancements: clearMulticlassPicksFromAdvancementsUpToLevel(
                                        advancements,
                                        level,
                                      ),
                                      multiclassClassId: null,
                                      multiclassSubclassId: null,
                                      multiclassDomain: null,
                                      spellcastTraitSource: null,
                                    });
                                    return;
                                  }
                                  set({
                                    multiclassClassId: id,
                                    multiclassSubclassId: null,
                                    multiclassDomain: null,
                                  });
                                }}
                                disabled={mcPickReadOnly}
                                options={[
                                  null,
                                  ...(srdData?.classes || [])
                                    .filter((c) => c.id && c.id !== formData.classId)
                                    .map((c) => c.id),
                                ]}
                                getOptionKey={(x) => x || '__none__'}
                                getOptionLabel={(id) =>
                                  id ? srdData?.classesById?.[id]?.name || id : 'Multiclass class…'
                                }
                                placeholder="Multiclass class…"
                                className="text-sm"
                              />
                              {formData.multiclassClassId ? (
                                <>
                                  <CustomSelect
                                    value={formData.multiclassSubclassId || null}
                                    onChange={(id) => {
                                      if (mcPickReadOnly) return;
                                      set({ multiclassSubclassId: id });
                                    }}
                                    disabled={mcPickReadOnly}
                                    options={[null, ...subOpts.map((s) => s.id)]}
                                    getOptionKey={(x) => x || '__none__'}
                                    getOptionLabel={(id) =>
                                      id ? srdData?.subclassesById?.[id]?.name || id : 'Multiclass subclass…'
                                    }
                                    placeholder="Subclass (foundation)…"
                                    className="text-sm"
                                  />
                                  <CustomSelect
                                    value={formData.multiclassDomain || null}
                                    onChange={(d) => {
                                      if (mcPickReadOnly) return;
                                      set({ multiclassDomain: d });
                                    }}
                                    disabled={mcPickReadOnly}
                                    options={[null, ...mcDoms]}
                                    getOptionKey={(x) => x || '__none__'}
                                    getOptionLabel={(d) => d || 'Extra domain deck…'}
                                    placeholder="Extra domain deck…"
                                    className="text-sm"
                                  />
                                </>
                              ) : null}
                              {formData.multiclassSubclassId && mcHas ? (
                                !primaryHas ? (
                                  <div className="text-[11px] text-dh-muted">
                                    Spellcast trait:{' '}
                                    <span className="text-dh font-medium">{String(mcRaw).trim()}</span>{' '}
                                    (multiclass — required when your primary subclass has no Spellcast trait)
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-dh-muted leading-snug">
                                    Both subclasses define a Spellcast trait. Spellcast rolls on the sheet use the
                                    trait with the <span className="text-dh font-medium">higher score</span> (weapon,
                                    armor, and beastform modifiers count); ties use your primary subclass’s trait.
                                  </p>
                                )
                              ) : null}
                            </div>
                          );
                        }

                        if (p.type === 'proficiency') {
                          return null;
                        }

                        const showInlineSubchoices =
                          p.type === 'traits' || p.type === 'experience' || p.type === 'domain_card';
                        if (!showInlineSubchoices) {
                          const resolved = isAdvancementPickFullyResolved(p, formData, srdData);
                          if (resolved) return null;
                        }

                        const pickReadOnly = !rowEditable(fill.level);
                        return (
                          <div
                            key={fi}
                            className={`rounded border border-dh-border/70 bg-dh-inset/25 px-2 py-1.5 space-y-1 ${
                              pickReadOnly ? 'opacity-90' : ''
                            }`}
                          >
                            {p.type !== 'experience' && p.type !== 'domain_card' ? (
                              <div className="text-[10px] text-dh-muted font-medium">Level {fill.level}</div>
                            ) : null}
                            <AdvancementPickDetail
                              pick={p}
                              readOnly={pickReadOnly}
                              onChange={(next) => patchPickAtLevel(fill.level, fill.pickIndex, next)}
                              experiences={experiences}
                              domainAbilityOptions={abilityOptionsForAdvancementLevel(fill.level)}
                              allSelectedDomainCardIds={allSelectedDomainCardIds}
                              abilitiesById={srdData?.abilitiesById}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t border-dh-border/50 bg-dh-inset/20">
              <p className="text-[10px] text-dh-muted italic leading-snug text-center">{TIER_FOOTER}</p>
              <div className="flex justify-center mt-2 opacity-70">
                <Swords size={18} className="text-dh-muted" aria-hidden />
              </div>
            </div>
          </div>
        );
      })}

      {level >= 2 &&
      hasAdvancementChoicesLockField(formData) &&
      getAdvancementIncompleteLevelKeys(formData, srdData).length === 0 &&
      !isAdvancementLockedThroughCurrentLevel(formData) ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-3 space-y-2 mt-2">
          <p className="text-[11px] text-dh-muted text-center leading-snug">
            All choices for level {level} are filled. Lock them to mark this level complete and show{' '}
            <span className="text-dh font-medium">Level Up</span> again.
          </p>
          <button
            type="button"
            onClick={() => set({ advancementChoicesLockedThroughLevel: level })}
            className="w-full py-2 px-4 rounded border text-sm font-semibold transition-colors bg-amber-950/60 border-amber-700/70 text-amber-100 hover:bg-amber-900/50 hover:border-amber-600"
          >
            Lock Level Choices
          </button>
        </div>
      ) : null}
    </div>
  );
});
