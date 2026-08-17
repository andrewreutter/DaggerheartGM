import { Trash2, Users } from 'lucide-react';
import {
  groupMinionInstances,
  isAdversaryPresentForParty,
  partitionPresentReserved,
  planTypeHeaderAdd,
  planTypeHeaderRemove,
} from '../lib/party-scaled-adversaries.js';
import { PartyScaleTagSelect } from './PartyScaleTagSelect.jsx';

function MinionGroupBlock({
  group,
  startNum,
  reserved = false,
  canEdit,
  onSetMinPartySize,
  onRemoveGroup,
  renderInstance,
}) {
  const n = group.instances.length;
  return (
    <div className={`group/mingroup ${reserved ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-dh-muted mb-1">
        <span className="font-semibold uppercase tracking-wide">Group</span>
        {n > 1 && <span className="tabular-nums">×{n}</span>}
        {canEdit && (
          <PartyScaleTagSelect
            value={group.instances[0]?.minPartySize}
            onChange={(v) => onSetMinPartySize(group.instances.map((el) => el.instanceId), v)}
          />
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveGroup?.(group.instances.map((el) => el.instanceId));
            }}
            className="ml-auto hidden group-hover/mingroup:flex w-4 h-4 rounded bg-dh-raised hover:bg-red-900 text-dh-muted hover:text-red-300 items-center justify-center transition-colors leading-none shrink-0"
            title="Remove group"
          >
            <Trash2 size={9} />
          </button>
        )}
      </div>
      {group.instances.map((inst, idx) => (
        <div key={inst.instanceId}>
          {renderInstance({
            inst,
            idx,
            showInstanceNum: n > 1 || startNum > 1,
            instanceNum: startNum + idx,
            reserved,
            scaleTag: null,
          })}
          {idx < n - 1 && <div className="border-t border-dh-border mt-1" />}
        </div>
      ))}
    </div>
  );
}

/**
 * Encounter type card: header +/−, present-at tags, minion group headers.
 * Live table fades reserved instances in place; tokens stay hidden elsewhere.
 */
export function EncounterAdversaryTypeCard({
  displayName,
  instances,
  isMinion,
  characterCount = null,
  scalePartySize,
  removeFromLabel,
  canEdit = true,
  onAddElements,
  onRemoveInstanceIds,
  onSetMinPartySize,
  renderInstance,
  afterHeader = null,
  cardProps,
}) {
  const { present } = partitionPresentReserved(instances, characterCount);
  const headerCount = present.length;
  const groupCount = groupMinionInstances(instances).length;
  const headerShownCount = isMinion ? groupCount : headerCount;
  const partyForAdd = scalePartySize ?? characterCount ?? 1;
  const fromLabel = removeFromLabel ?? (characterCount == null ? 'scene' : 'table');
  const instanceReserved = (inst) => (
    characterCount != null && !isAdversaryPresentForParty(inst, characterCount)
  );

  const handleAdd = () => {
    if (!instances[0]) return;
    onAddElements?.(planTypeHeaderAdd(instances[0], { isMinion, characterCount: partyForAdd }));
  };

  const handleRemove = () => {
    const ids = planTypeHeaderRemove(instances, { isMinion });
    if (!ids.length) return;
    const remaining = instances.length - ids.length;
    if (remaining <= 0) {
      if (!window.confirm(`Remove ${displayName || 'this adversary'} from the ${fromLabel}?`)) {
        return;
      }
    }
    onRemoveInstanceIds?.(ids);
  };

  const body = isMinion
    ? (() => {
      const groups = groupMinionInstances(instances);
      let cursor = 0;
      return groups.map((group, gIdx) => {
        const startNum = cursor + 1;
        cursor += group.instances.length;
        return (
          <div key={group.minionGroupId || group.instances[0]?.instanceId}>
            {gIdx > 0 && <div className="border-t border-dh-border my-1.5" />}
            <MinionGroupBlock
              group={group}
              startNum={startNum}
              reserved={instanceReserved(group.instances[0])}
              canEdit={canEdit}
              onSetMinPartySize={onSetMinPartySize}
              onRemoveGroup={(ids) => {
                if (groupCount <= 1) {
                  if (!window.confirm(`Remove ${displayName || 'this adversary'} from the ${fromLabel}?`)) {
                    return;
                  }
                }
                onRemoveInstanceIds?.(ids);
              }}
              renderInstance={renderInstance}
            />
          </div>
        );
      });
    })()
    : instances.map((inst, idx) => (
      <div key={inst.instanceId} className={instanceReserved(inst) ? 'opacity-50' : undefined}>
        {renderInstance({
          inst,
          idx,
          showInstanceNum: instances.length > 1,
          instanceNum: idx + 1,
          reserved: instanceReserved(inst),
          scaleTag: canEdit ? (
            <PartyScaleTagSelect
              value={inst.minPartySize}
              onChange={(v) => onSetMinPartySize([inst.instanceId], v)}
            />
          ) : null,
        })}
        {idx < instances.length - 1 && <div className="border-t border-dh-border mt-1" />}
      </div>
    ));

  return (
    <div
      className="rounded-lg bg-dh-surface border border-dh-border overflow-hidden group/adv"
      {...(cardProps || {})}
    >
      <div className="px-2.5 py-1.5 border-b border-dh-border flex items-center gap-1.5">
        <span className="text-xs font-semibold text-dh truncate flex-1">{displayName}</span>
        {isMinion ? (
          <span
            className="text-[10px] text-dh-muted shrink-0 group-hover/adv:hidden tabular-nums inline-flex items-center gap-0.5"
            title={`${groupCount} minion group${groupCount === 1 ? '' : 's'}`}
            aria-label={`${groupCount} minion group${groupCount === 1 ? '' : 's'}`}
          >
            ×{groupCount}
            <Users size={10} aria-hidden />
          </span>
        ) : headerCount > 1 && (
          <span className="text-[10px] text-dh-muted shrink-0 group-hover/adv:hidden tabular-nums">×{headerCount}</span>
        )}
        {canEdit && (
          <div className="hidden group-hover/adv:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleAdd}
              className="w-4 h-4 rounded bg-dh-raised hover:bg-green-900 text-dh-muted hover:text-green-300 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
              title={isMinion ? 'Add a minion group' : 'Add one more'}
            >
              +
            </button>
            <span className="min-w-[1rem] text-center text-[10px] text-dh-muted font-semibold tabular-nums">{headerShownCount}</span>
            <button
              type="button"
              onClick={handleRemove}
              className="w-4 h-4 rounded bg-dh-raised hover:bg-red-900 text-dh-muted hover:text-red-300 flex items-center justify-center transition-colors leading-none"
              title={instances.length <= (isMinion ? groupMinionInstances(instances).slice(-1)[0]?.instances.length : 1)
                ? 'Remove from table'
                : isMinion ? 'Remove last group' : 'Remove one'}
            >
              {instances.length <= 1 ? <Trash2 size={9} /> : <span className="text-[10px] font-bold">−</span>}
            </button>
          </div>
        )}
      </div>
      {afterHeader}
      <div className="p-2 space-y-2">
        {body}
      </div>
    </div>
  );
}
