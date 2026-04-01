/**
 * Map-pin extension: per party character, Offense (reach-filtered) + V2 Actions chips with selectTargets.
 */

import { useMemo } from 'react';
import { CharacterWeaponList, CharacterFeatureActionsRow } from './CharacterDisplay.jsx';
import { CharacterSheetEmphasisCard } from './CharacterStatBlockGraphic.jsx';
import { getOrderedGuideFeatureEntries, getOrderedGuideLoadoutEntries } from '../lib/guide-feature-entries.js';
import { buildFeatureCardModelForCharacter } from '../lib/build-feature-card-model.js';
import { buildActionChipSlotsForSheet } from '../lib/v2-action-chip-strip.js';
import {
  applySelectTargetsAdversaryGate,
  distancePcToAdversaryFt,
  formatAdversaryPinRangeLabel,
  safeSelectTargets,
  selectTargetsIncludesAdversary,
} from '../lib/player-adversary-target-aid.js';
import { computeWeaponListPinEmpty } from '../lib/adversary-pin-weapon-visibility.js';
import { WidthSortedFlexWrap } from './WidthSortedFlexWrap.jsx';

/**
 * @param {object} charEl — merged sheet character (`recomputeCharacter` + `mergeV2DeclarativeSheetOverlay`), same as hover sheet / not raw `activeElements` rows (V2 `activeFeatures` + card chips require it).
 */
function collectSelectTargetSlots(charEl, v2TableContext, onV2CardChipFactory) {
  const orderedEntries = getOrderedGuideFeatureEntries(charEl, onV2CardChipFactory);
  const loadoutEntries = getOrderedGuideLoadoutEntries(charEl);
  const guideEntriesWithChips = [];
  for (const entry of orderedEntries) {
    if (entry.kind !== 'guide') continue;
    const { model } = buildFeatureCardModelForCharacter(entry.row, charEl, v2TableContext);
    if (model.cardChips?.length) guideEntriesWithChips.push(entry);
  }
  const loadoutEntriesWithChips = [];
  for (const entry of loadoutEntries) {
    const { model } = buildFeatureCardModelForCharacter(entry.row, charEl, v2TableContext);
    if (model.cardChips?.length) loadoutEntriesWithChips.push(entry);
  }
  const allWithChips = [...guideEntriesWithChips, ...loadoutEntriesWithChips];
  const slots = buildActionChipSlotsForSheet(allWithChips, charEl, v2TableContext);
  return slots.filter((slot) => {
    const chip = slot.model?.cardChips?.[slot.chipIndex];
    return chip && typeof chip.selectTargets === 'function';
  });
}

/**
 * @param {string|null|undefined} primaryInstanceId — viewer’s character (e.g. assigned PC); sorted to the top when set.
 * @param {(instanceId: string) => boolean} [canInteractWithCharacter] — if provided, weapon rolls only when true (GM: always; players: own PC only).
 */
export function PlayerAdversaryTargetAid({
  adversaryInstanceId,
  adversaryElement,
  characterElements,
  primaryInstanceId = null,
  canInteractWithCharacter,
  characterDisplayByInstanceId,
  v2TableContext,
  onV2CardChipFactory,
  getValidTargets,
  onWeaponClick,
}) {
  const rows = useMemo(() => {
    if (!Array.isArray(characterElements) || characterElements.length === 0) return [];
    const ordered = [...characterElements];
    if (primaryInstanceId != null && primaryInstanceId !== '') {
      ordered.sort((a, b) => {
        const ap = a.instanceId === primaryInstanceId ? 0 : 1;
        const bp = b.instanceId === primaryInstanceId ? 0 : 1;
        return ap - bp;
      });
    }
    const out = [];
    for (const el of ordered) {
      const displayChar = characterDisplayByInstanceId?.get(el.instanceId) ?? el;
      const dist = distancePcToAdversaryFt(displayChar, adversaryElement);
      const reachMin = dist;

      const selectSlots = collectSelectTargetSlots(displayChar, v2TableContext, onV2CardChipFactory).map((slot) => {
        const chip = slot.model.cardChips[slot.chipIndex];
        const targets = safeSelectTargets(chip, slot.table);
        const valid = selectTargetsIncludesAdversary(targets, adversaryInstanceId);
        return applySelectTargetsAdversaryGate(slot, valid);
      });

      out.push({
        key: el.instanceId,
        name: el.name || 'Character',
        el,
        displayChar,
        reachMin,
        selectSlots,
      });
    }
    return out;
  }, [
    characterElements,
    primaryInstanceId,
    characterDisplayByInstanceId,
    adversaryElement,
    adversaryInstanceId,
    v2TableContext,
    onV2CardChipFactory,
  ]);

  if (rows.length === 0) return null;

  const canInteract =
    typeof canInteractWithCharacter === 'function'
      ? canInteractWithCharacter
      : () => true;

  return (
    <div className="space-y-3 min-w-0 border-t border-dh-border/80 pt-2 mt-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-dh-muted">Party vs this target</p>
      {rows.map((row) => {
        const weaponsInteractive = onWeaponClick && canInteract(row.el.instanceId);
        const rangeLabel = formatAdversaryPinRangeLabel(row.reachMin);
        const offenseEmpty = computeWeaponListPinEmpty(row.displayChar, {
          weaponReachMinFt: row.reachMin ?? undefined,
          filterOutDisabledWeapons: true,
          getValidTargets,
        });
        const hasActions = row.selectSlots.length > 0;
        const bothEmpty = offenseEmpty && !hasActions;

        const offenseTitleRight =
          row.reachMin != null
            ? `No usable weapons at ${rangeLabel}`
            : 'No usable weapons — place token on map';
        const actionsTitleRight =
          row.reachMin != null
            ? `No usable actions at ${rangeLabel}`
            : 'No usable actions — place token on map';
        const combinedMessage =
          row.reachMin != null
            ? `No usable weapons or actions at ${rangeLabel}`
            : 'No usable weapons or actions — place token on map';

        const placementHint =
          row.reachMin == null ? (
            <p className="text-[9px] text-amber-400/90 leading-snug">
              Place your token on the same map as this adversary to measure range.
            </p>
          ) : null;

        if (bothEmpty) {
          return (
            <div key={row.key} className="rounded-md border border-dh-border/60 bg-dh-canvas/40 px-2 py-2 space-y-2 min-w-0">
              <div className="flex items-start justify-between gap-x-2 gap-y-0 min-w-0">
                <div className="text-[11px] font-semibold text-dh truncate min-w-0 shrink">{row.name}</div>
                <p className="text-[9px] text-dh-muted leading-snug text-right shrink-0 max-w-[min(14rem,58%)]">
                  {combinedMessage}
                </p>
              </div>
              {placementHint}
            </div>
          );
        }

        return (
          <div key={row.key} className="rounded-md border border-dh-border/60 bg-dh-canvas/40 px-2 py-2 space-y-2 min-w-0">
            <div className="text-[11px] font-semibold text-dh truncate">{row.name}</div>
            {placementHint}

            <CharacterWeaponList
              el={row.displayChar}
              sheetEmphasisTitle="Offense"
              weaponReachMinFt={row.reachMin ?? undefined}
              filterOutDisabledWeapons
              titleRowEmptyMessage={offenseEmpty ? offenseTitleRight : undefined}
              getValidTargets={getValidTargets}
              onWeaponClick={
                weaponsInteractive
                  ? (w, rollMeta, e) => onWeaponClick(row.el, row.displayChar, w, rollMeta, e)
                  : undefined
              }
            />

            <CharacterSheetEmphasisCard
              compact
              title="Actions"
              titleRight={!hasActions ? actionsTitleRight : undefined}
            >
              {hasActions ? (
                <WidthSortedFlexWrap className="flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start">
                  {row.selectSlots.map((slot) => (
                    <CharacterFeatureActionsRow
                      key={`${slot.entry.key}-${slot.chipIndex}-st`}
                      entry={slot.entry}
                      chipIndex={slot.chipIndex}
                      el={row.el}
                      v2TableContext={v2TableContext}
                      interactionMode={onV2CardChipFactory ? 'interactive' : 'preview'}
                      onV2CardChip={onV2CardChipFactory ? (payload) => onV2CardChipFactory(row.el, row.displayChar)(payload) : undefined}
                      stripSlot={slot.moveToUnusable ? 'unusableOnly' : 'activeOnly'}
                      stripKeyPrefix={`${slot.entry.key}-st-${slot.chipIndex}`}
                      prefetchedModel={slot.model}
                      prefetchedTable={slot.table}
                      pinSelectTargetInstanceId={adversaryInstanceId}
                    />
                  ))}
                </WidthSortedFlexWrap>
              ) : null}
            </CharacterSheetEmphasisCard>
          </div>
        );
      })}
    </div>
  );
}
