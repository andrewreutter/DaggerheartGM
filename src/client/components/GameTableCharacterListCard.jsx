import { useState } from 'react';
import { User, AlertTriangle, X, Trash2, Tag, Zap } from 'lucide-react';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { ConditionsEditor } from './ConditionsEditor.jsx';
import { Tooltip } from './Tooltip.jsx';
import { effectiveThresholds, getEvasionModifierTotal } from '../lib/helpers.js';
import { normalizeConditionsToList } from '../lib/conditions-utils.js';
import { GuideFeatureCardChips } from './features/GuideFeatureCard.jsx';
import { WidthSortedFlexWrap } from './WidthSortedFlexWrap.jsx';
import {
  collectV2FeatureCardValueDisplayLines,
  collectV2IsToggleCardFeatureGroups,
} from '../lib/build-feature-card-model.js';
import { WARDEN_OF_THE_ELEMENTS_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';

/**
 * Characters panel list card (not the hover sheet). Used on the Game Table sidebar and for map token pins.
 *
 * @param {object} props
 * @param {object} props.el — character element (table row)
 * @param {object} props.displayChar — merged display character (`characterDisplayByInstanceId` or `el`)
 * @param {boolean} props.isMyCharacter
 * @param {boolean} props.isPlayer
 * @param {object} [props.sheetTriggerProps] — spread on the card root (e.g. `characterOverlay.triggerProps(...)`); opens the character sheet from the card body while trackers stop propagation.
 * @param {{ complete: boolean, missing?: string[] }} props.charComplete
 * @param {Record<string, number>} [props.pendingResourceCosts]
 * @param {object} props.manualAck
 * @param {number} props.lsHeal
 * @param {(instanceId: string, patch: object) => void} [props.cardTrackUpdateFn]
 * @param {(el: object, patch: object) => void} [props.cardQueueManualTracks]
 * @param {(instanceId: string, delta: number) => void} [props.consumePendingStressForManualMark]
 * @param {string[]} [props.playerEmails]
 * @param {{ uid?: string, email?: string, name?: string }[]} [props.connectedPlayers]
 * @param {(instanceId: string, email: string | undefined) => void} [props.onAssignPlayerEmail]
 * @param {(instanceId: string) => void} [props.onRemoveFromTable] — GM sidebar remove from table
 * @param {(instanceId: string) => void} [props.onCallReaction] — GM: open Call for Reaction seeded with this character
 * @param {object} [props.cardRootProps] — spread on outer card (e.g. `characterOverlay.triggerProps` on sidebar)
 * @param {import('react').ReactNode} [props.trailingHeaderActions] — e.g. map pin close + remove from map
 * @param {object | null} [props.v2Registry]
 * @param {object} [props.v2TableContext]
 * @param {(characterEl: object, displayEl: object) => (payload: object) => void} [props.onV2CardChipFactory]
 * @param {object[]} [props.pendingBanners]
 * @param {(url: string) => void} [props.onOpenImageLightbox] — when provided, portrait thumb becomes click-to-fullscreen
 * @param {string[]} [props.conditionsHistory]
 * @param {(entry: string) => void} [props.onAddConditionsHistoryEntry]
 * @param {(entry: string) => void} [props.onRemoveConditionsHistoryEntry]
 */
export function GameTableCharacterListCard({
  el,
  displayChar,
  isMyCharacter,
  isPlayer,
  sheetTriggerProps = {},
  charComplete,
  pendingResourceCosts = {},
  manualAck,
  lsHeal,
  cardTrackUpdateFn,
  cardQueueManualTracks,
  consumePendingStressForManualMark,
  playerEmails = [],
  connectedPlayers = [],
  onAssignPlayerEmail,
  onRemoveFromTable,
  onCallReaction,
  cardRootProps = {},
  trailingHeaderActions,
  v2Registry,
  v2TableContext,
  onV2CardChipFactory,
  pendingBanners,
  onOpenImageLightbox,
  conditionsHistory = [],
  onAddConditionsHistoryEntry,
  onRemoveConditionsHistoryEntry,
}) {
  const isIncomplete = !charComplete.complete;
  const [openOwnConditions, setOpenOwnConditions] = useState(false);
  const [openCompanionConditions, setOpenCompanionConditions] = useState(false);
  const ownConditions = el.conditions || '';
  const ownHasConditions = normalizeConditionsToList(ownConditions).length > 0;
  const companionConditions = el.companion?.conditions || '';
  const companionHasConditions = normalizeConditionsToList(companionConditions).length > 0;
  const canEditConditions = typeof cardTrackUpdateFn === 'function';

  const stopSheetOpenFromInteractive = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden group/char transition-colors bg-dh-surface cursor-pointer flex flex-col min-h-0 min-w-0 ${isMyCharacter ? 'border-emerald-500/45' : 'border-dh-border'}`}
      {...cardRootProps}
      {...sheetTriggerProps}
    >
      <div className="px-2.5 py-1.5 border-b border-dh-border flex items-center gap-1.5 hover:bg-dh-hover transition-colors">
        {el.imageUrl ? (
          <img
            src={el.imageUrl}
            alt=""
            className={`w-4 h-4 rounded-full object-cover shrink-0 border ${isMyCharacter ? 'border-emerald-500/60' : 'border-sky-500/60'}${onOpenImageLightbox ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            aria-hidden
            onClick={onOpenImageLightbox ? (e) => { e.stopPropagation(); onOpenImageLightbox(el.imageUrl); } : undefined}
          />
        ) : (
          <User size={10} className={isMyCharacter ? 'text-emerald-500 shrink-0' : 'text-sky-500 shrink-0'} />
        )}
        <span className="text-xs font-semibold text-dh truncate flex-1">{el.name || 'Unnamed'}</span>
        {isIncomplete && (
          <span className="flex items-center gap-0.5 text-orange-400 shrink-0" title={`Missing: ${charComplete.missing?.join(', ') ?? ''}`}>
            <AlertTriangle size={10} />
            <span className="text-[10px]">Incomplete</span>
          </span>
        )}
        {trailingHeaderActions ? (
          <div className="flex items-center gap-1 shrink-0" onClick={stopSheetOpenFromInteractive} onMouseDown={stopSheetOpenFromInteractive}>
            {trailingHeaderActions}
          </div>
        ) : null}
        <span className="text-[10px] font-bold text-sky-500 bg-dh-raised border border-dh-strong rounded px-1 shrink-0 group-hover/char:hidden" title="Tier">
          T{el.tier ?? 1}
        </span>
        {el.playerName && (
          <span className="text-[10px] text-dh-muted truncate max-w-[5rem] group-hover/char:hidden">{el.playerName}</span>
        )}
        {!isPlayer && (onRemoveFromTable || onCallReaction) && (
          <div className="hidden group-hover/char:flex items-center gap-1 shrink-0" onClick={stopSheetOpenFromInteractive} onMouseDown={stopSheetOpenFromInteractive}>
            {onCallReaction && (
              <button
                type="button"
                onClick={() => onCallReaction(el.instanceId)}
                className="text-dh-muted hover:text-sky-300 transition-colors"
                title="Call for Reaction"
              >
                <Zap size={11} />
              </button>
            )}
            {onRemoveFromTable && (
              <button
                type="button"
                onClick={() => onRemoveFromTable(el.instanceId)}
                className="text-dh-muted hover:text-red-400 transition-colors"
                title="Remove from table"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1 min-h-0">
          {!isPlayer && playerEmails.length > 0 && onAssignPlayerEmail && (
            <div className="px-2 pt-1 pb-0.5 border-b border-dh-border cursor-default" onClick={stopSheetOpenFromInteractive} onMouseDown={stopSheetOpenFromInteractive}>
              <select
                value={el.assignedPlayerEmail || ''}
                onChange={(e) => onAssignPlayerEmail(el.instanceId, e.target.value || undefined)}
                className="w-full bg-dh-surface border border-dh-strong rounded px-1.5 py-0.5 text-[10px] text-dh outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {playerEmails.map((email) => {
                  const connected = connectedPlayers.find((p) => p.email === email);
                  return (
                    <option key={email} value={email}>
                      {connected?.name || email}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="p-2 flex flex-col gap-1.5 rounded-b-lg flex-1 min-h-0">
            {(() => {
              const maxHope = el.maxHope ?? 6;
              const hopePending = pendingResourceCosts[el.instanceId]?.hope ?? 0;
              const currentHope = el.hope ?? maxHope;
              return (
                maxHope > 0 && (
                  <div className="flex items-center gap-1 min-w-0">
                    <CheckboxTrack
                      total={maxHope}
                      filled={Math.max(0, currentHope - hopePending)}
                      pendingFilled={hopePending + manualAck.hopeGain}
                      pendingClearFilled={manualAck.hopeSpend}
                      onSetFilled={
                        cardQueueManualTracks
                          ? (h) => cardQueueManualTracks(el, { hope: h })
                          : cardTrackUpdateFn
                            ? (h) => cardTrackUpdateFn(el.instanceId, { hope: h })
                            : undefined
                      }
                      trackKind="hope"
                      label="Hope"
                      verbs={['Gain', 'Spend']}
                      pulseOnDecreaseOnly
                      slotTypeTooltip
                      stopSlotClickPropagation
                    />
                  </div>
                )
              );
            })()}
            {(displayChar.evasion != null || displayChar.armorThresholds) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {displayChar.evasion != null &&
                  (() => {
                    const evModTotal = getEvasionModifierTotal(displayChar);
                    return (
                      <Tooltip
                        content="Evasion"
                        className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums bg-cyan-900/50 border border-cyan-800/50 rounded px-1 ${evModTotal ? 'text-sky-300' : 'text-cyan-400/70'}`}
                        placement="right"
                      >
                        <span>EVA {displayChar.evasion}</span>
                        {evModTotal !== 0 ? (
                          <span className={`text-[9px] font-semibold text-sky-400`}>
                            ({evModTotal > 0 ? '+' : ''}
                            {evModTotal})
                          </span>
                        ) : null}
                      </Tooltip>
                    );
                  })()}
                {(() => {
                  const t = effectiveThresholds(displayChar);
                  if (!t) return null;
                  const eb = displayChar._v2MajorThresholdBonus ?? 0;
                  return (
                    <span className="text-[10px] text-dh-muted" title="Damage thresholds">
                      Thresholds{' '}
                      {eb > 0 ? (
                        <>
                          <span className="font-bold text-dh-muted">{t.major - eb}</span>
                          <span className="text-dh-muted"> +{eb} =</span>{' '}
                        </>
                      ) : null}
                      <span className="font-bold text-dh">{t.major}</span>
                      <span className="text-dh-muted"> / </span>
                      {eb > 0 ? (
                        <>
                          <span className="font-bold text-red-300/50">{t.severe - eb}</span>
                          <span className="text-dh-muted"> +{eb} =</span>{' '}
                        </>
                      ) : null}
                      <span className="font-bold text-red-300">{t.severe}</span>
                    </span>
                  );
                })()}
              </div>
            )}
            {(el.maxArmor || 0) > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <CheckboxTrack
                  total={el.maxArmor || 0}
                  filled={el.currentArmor || 0}
                  pendingFilled={(pendingResourceCosts[el.instanceId]?.armorMark ?? 0) + manualAck.armorMarkAdd}
                  pendingClearFilled={manualAck.armorClear}
                  onSetFilled={
                    cardQueueManualTracks
                      ? (v) => {
                          const upd = { currentArmor: v };
                          if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                          cardQueueManualTracks(el, upd);
                        }
                      : cardTrackUpdateFn
                        ? (v) => {
                            const upd = { currentArmor: v };
                            if (el.reinforcedActive && v < (el.currentArmor || 0)) upd.reinforcedActive = false;
                            cardTrackUpdateFn(el.instanceId, upd);
                          }
                        : undefined
                  }
                  trackKind="armor"
                  label="Armor"
                  verbs={['Mark', 'Clear']}
                  slotTypeTooltip
                  stopSlotClickPropagation
                />
              </div>
            )}
            {(el.maxHp || 0) > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <CheckboxTrack
                  total={el.maxHp || 0}
                  filled={(el.maxHp || 0) - (el.currentHp ?? el.maxHp ?? 0)}
                  pendingFilled={manualAck.hpDamageAdd}
                  pendingClearFilled={manualAck.hpHealSlots + lsHeal}
                  onSetFilled={
                    cardQueueManualTracks
                      ? (dmg) => cardQueueManualTracks(el, { currentHp: (el.maxHp || 0) - dmg })
                      : cardTrackUpdateFn
                        ? (dmg) => cardTrackUpdateFn(el.instanceId, { currentHp: (el.maxHp || 0) - dmg })
                        : undefined
                  }
                  trackKind="hp"
                  label="HP"
                  verbs={['Mark', 'Clear']}
                  slotTypeTooltip
                  stopSlotClickPropagation
                />
              </div>
            )}
            {(el.maxStress || 0) > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <CheckboxTrack
                  total={el.maxStress || 0}
                  filled={el.currentStress || 0}
                  pendingFilled={(pendingResourceCosts[el.instanceId]?.stress ?? 0) + manualAck.stressAdd}
                  pendingClearFilled={manualAck.stressClear}
                  onSetFilled={
                    cardQueueManualTracks
                      ? (s) => cardQueueManualTracks(el, { currentStress: s })
                      : cardTrackUpdateFn
                        ? (s) => {
                            const prev = el.currentStress ?? 0;
                            if (s > prev) consumePendingStressForManualMark?.(el.instanceId, s - prev);
                            cardTrackUpdateFn(el.instanceId, { currentStress: s });
                          }
                        : undefined
                  }
                  trackKind="stress"
                  label="Stress"
                  verbs={['Mark', 'Clear']}
                  slotTypeTooltip
                  stopSlotClickPropagation
                />
                {canEditConditions && !ownHasConditions && !openOwnConditions && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenOwnConditions(true);
                    }}
                    className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
                    title="Add conditions"
                  >
                    <Tag size={10} />
                  </button>
                )}
              </div>
            )}
            {canEditConditions && (ownHasConditions || openOwnConditions) && (
              <div onClick={stopSheetOpenFromInteractive} onPointerDown={stopSheetOpenFromInteractive}>
                <ConditionsEditor
                  instanceId={el.instanceId}
                  value={ownConditions}
                  onCommit={(v) => cardTrackUpdateFn(el.instanceId, { conditions: v })}
                  placeholder="Add condition…"
                  autoFocus={openOwnConditions && !ownHasConditions}
                  suggestions={conditionsHistory}
                  onAddSuggestion={onAddConditionsHistoryEntry}
                  onRemoveSuggestion={onRemoveConditionsHistoryEntry}
                  onBlur={() => {
                    if (!ownHasConditions) setOpenOwnConditions(false);
                  }}
                  className="w-full flex flex-wrap items-center gap-1 bg-dh-raised/50 border border-dh-strong rounded px-1.5 py-0.5 text-xs text-dh focus-within:border-blue-500"
                />
              </div>
            )}
            {!canEditConditions && ownHasConditions && (
              <ConditionsEditor value={ownConditions} readOnly className="flex flex-wrap gap-1" />
            )}
            {el.companion && (el.companion.maxStress || 0) > 0 && (
              <div className="mt-0.5 pt-1.5 border-t border-dh-border/50 flex flex-col gap-0.5">
                <div className="text-[10px] font-medium text-dh-muted leading-none mb-0.5 truncate select-none">
                  {el.companion.name || 'Companion'}
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <CheckboxTrack
                    total={el.companion.maxStress || 0}
                    filled={el.companion.currentStress || 0}
                    onSetFilled={
                      cardQueueManualTracks
                        ? (s) => cardQueueManualTracks(el, { companion: { ...el.companion, currentStress: s } })
                        : cardTrackUpdateFn
                          ? (s) => cardTrackUpdateFn(el.instanceId, { companion: { ...el.companion, currentStress: s } })
                          : undefined
                    }
                    trackKind="stress"
                    label={`${el.companion.name || 'Companion'} Stress`}
                    verbs={['Mark', 'Clear']}
                    slotTypeTooltip
                    stopSlotClickPropagation
                  />
                  {canEditConditions && !companionHasConditions && !openCompanionConditions && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCompanionConditions(true);
                      }}
                      className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
                      title="Add conditions"
                    >
                      <Tag size={10} />
                    </button>
                  )}
                </div>
                {canEditConditions && (companionHasConditions || openCompanionConditions) && (
                  <div onClick={stopSheetOpenFromInteractive} onPointerDown={stopSheetOpenFromInteractive}>
                    <ConditionsEditor
                      instanceId={`${el.instanceId}-companion-conditions`}
                      value={companionConditions}
                      onCommit={(v) =>
                        cardTrackUpdateFn(el.instanceId, { companion: { ...el.companion, conditions: v } })
                      }
                      placeholder="Add condition…"
                      autoFocus={openCompanionConditions && !companionHasConditions}
                      suggestions={conditionsHistory}
                      onAddSuggestion={onAddConditionsHistoryEntry}
                      onRemoveSuggestion={onRemoveConditionsHistoryEntry}
                      onBlur={() => {
                        if (!companionHasConditions) setOpenCompanionConditions(false);
                      }}
                      className="w-full flex flex-wrap items-center gap-1 bg-dh-raised/50 border border-dh-strong rounded px-1.5 py-0.5 text-xs text-dh focus-within:border-blue-500"
                    />
                  </div>
                )}
                {!canEditConditions && companionHasConditions && (
                  <ConditionsEditor value={companionConditions} readOnly className="flex flex-wrap gap-1" />
                )}
              </div>
            )}
            {(!isPlayer || isMyCharacter) &&
              v2Registry &&
              v2TableContext &&
              onV2CardChipFactory &&
              (() => {
                const displayElPanel = displayChar;
                const toggleGroups = collectV2IsToggleCardFeatureGroups(displayElPanel, v2TableContext);
                const cardValueLines = collectV2FeatureCardValueDisplayLines(displayElPanel, v2TableContext);
                if (toggleGroups.length === 0 && cardValueLines.length === 0) return null;
                const channeled = displayElPanel.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement ?? null;
                return (
                  <div className="pt-1.5 border-t border-dh-border/80 min-w-0">
                    {toggleGroups.length > 0 && (
                      <WidthSortedFlexWrap className="flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start">
                        {toggleGroups.map((g, gi) => (
                          <GuideFeatureCardChips
                            key={`${g.featRow._sourceScopeKey || g.featRow.name}-${g.featRow.type}-${gi}`}
                            model={g.model}
                            tableForChips={g.table}
                            featRow={g.featRow}
                            el={displayElPanel}
                            featureKey={g.featRow._sourceScopeKey || g.featRow.name}
                            v2TableContext={v2TableContext}
                            interactionMode="interactive"
                            onlyIsToggle
                            actionsStripLayout
                            stripKeyPrefix={g.featRow._sourceScopeKey || g.featRow.name}
                            activeChanneledElement={g.featRow.name === 'Elemental Incarnation' ? channeled : undefined}
                            stressMaxed={
                              g.featRow.name === 'Elemental Incarnation' ? (el.currentStress ?? 0) >= (el.maxStress ?? 6) : undefined
                            }
                            onV2CardChip={onV2CardChipFactory(el, displayElPanel)}
                            pendingBanners={pendingBanners}
                            chipTooltipPlacement="right"
                          />
                        ))}
                      </WidthSortedFlexWrap>
                    )}
                    {cardValueLines.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start min-w-0">
                        {cardValueLines.map((ln, cvi) => (
                          <span
                            key={`${ln.value}-${cvi}`}
                            className={`inline-flex max-w-full min-w-0 items-center rounded px-1.5 py-1 text-left border transition-colors ${ln.chipClassName}`}
                            title={ln.value}
                          >
                            <span className="text-sm font-semibold leading-tight min-w-0 truncate">{ln.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
      </div>
    </div>
  );
}
