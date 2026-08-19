import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Eye, EyeOff, StickyNote, Trash2 } from 'lucide-react';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';
import { CountdownRollReferencePanel, COUNTDOWN_KIND_LABELS } from './CountdownRollReference.jsx';
import { COUNTDOWN_LOOPING_LABELS, formatSessionCountdownValueLine } from '../lib/session-countdowns.js';
import { MarkdownText } from '../lib/markdown.js';
import { useHoverOverlay } from '../lib/useHoverOverlay.js';
import { useTouchDevice } from '../lib/useTouchDevice.js';
import {
  encounterPotAdvOverlayStyle,
  encounterTrackerOverlayStyle,
  resolveEncounterAsideLeft,
} from '../lib/encounter-overlay-position.js';

/**
 * After layout, measure a fixed overlay and shift it vertically so it stays in the viewport.
 */
export function useViewportClamp(ref, isActive, key) {
  const [adjust, setAdjust] = useState(0);
  const keyRef = useRef(null);

  useLayoutEffect(() => {
    if (!isActive || !ref.current) {
      keyRef.current = null;
      if (adjust !== 0) setAdjust(0);
      return;
    }
    if (keyRef.current !== key) {
      keyRef.current = key;
      if (adjust !== 0) { setAdjust(0); return; }
    } else if (adjust !== 0) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.top < 102) setAdjust(102 - rect.top);
    else if (rect.bottom > vh - 8) setAdjust(vh - 8 - rect.bottom);
  }, [isActive, key, adjust]);

  return adjust;
}

export async function resolvePotentialAdversary(adversaryId, resolveItems) {
  if (!resolveItems) return null;
  const result = await resolveItems({ adversaries: [adversaryId] });
  return result.adversaries?.[0] ?? null;
}

export function useEncounterHoverOverlays({ isTouch: isTouchProp, resolveItems } = {}) {
  const isTouchHook = useTouchDevice();
  const isTouch = isTouchProp ?? isTouchHook;
  const trackerOverlay = useHoverOverlay({ hideDelay: 120, isTouch });
  const potAdvOverlay = useHoverOverlay({ hideDelay: 120, isTouch });
  const trackerKey = trackerOverlayKey(trackerOverlay.data);
  const trackerAdjust = useViewportClamp(trackerOverlay.overlayRef, trackerOverlay.isOpen, trackerKey);
  const potAdvKey = potAdvOverlay.data?.element?.id ?? null;
  const potAdvAdjust = useViewportClamp(potAdvOverlay.overlayRef, potAdvOverlay.isOpen, potAdvKey);

  const handlePotentialAdversaryHover = async (adversaryId, rect) => {
    if (!resolveItems) return;
    potAdvOverlay.cancelClose();
    try {
      const adversary = await resolvePotentialAdversary(adversaryId, resolveItems);
      if (adversary) {
        potAdvOverlay.show({ element: adversary, top: rect.top, bottom: rect.bottom });
      }
    } catch (err) {
      console.warn('Failed to resolve potential adversary for hover:', err);
    }
  };

  return {
    trackerOverlay,
    potAdvOverlay,
    trackerAdjust,
    potAdvAdjust,
    handlePotentialAdversaryHover,
  };
}

function trackerOverlayKey(data) {
  if (!data) return null;
  if (data.kind === 'environment' || data.kind === 'note') return data.element?.instanceId ?? null;
  if (data.kind === 'countdown') return data.row?.id ?? null;
  return data.baseElement?.id ?? null;
}

function trackerTriggerData(kind, payload) {
  return (e) => ({
    kind,
    ...payload,
    top: e.currentTarget.getBoundingClientRect().top,
    bottom: e.currentTarget.getBoundingClientRect().bottom,
  });
}

export function EncounterNoteCard({
  element,
  trackerOverlay,
  onToggleVisibility,
  onOpen,
  onRemove,
}) {
  const noteBodyTrimmed = String(element.body || '').trim();
  const noteTitleOnly = !noteBodyTrimmed && !element.imageUrl;
  const hoverProps = trackerOverlay
    ? trackerOverlay.triggerProps(trackerTriggerData('note', { element }))
    : {};
  return (
    <div
      data-testid="encounter-note-card"
      className={`flex gap-1 rounded-lg border border-amber-900/50 bg-amber-950/25 px-2 transition-colors hover:border-amber-700/60 hover:bg-amber-950/40 ${noteTitleOnly ? 'py-1.5' : 'py-2'}`}
      {...hoverProps}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility?.(element);
        }}
        className="shrink-0 self-start rounded p-0.5 text-dh-muted hover:bg-dh-hover/60 hover:text-dh"
        title={element.visibility === 'gm' ? 'GM only — click to show players' : 'Visible to players — click for GM only'}
        aria-label={element.visibility === 'gm' ? 'Show to players' : 'GM only'}
        aria-pressed={element.visibility === 'gm'}
      >
        {element.visibility === 'gm' ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(element);
        }}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        {element.imageUrl ? (
          <span className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded border border-amber-800/50 bg-dh-inset">
            <img src={element.imageUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-400/90" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-amber-100/90">{element.name || 'Note'}</div>
          {noteBodyTrimmed ? (
            <div className="mt-1 max-h-24 overflow-hidden text-left">
              <MarkdownText text={noteBodyTrimmed} className="dh-md text-[11px] leading-snug text-dh-muted line-clamp-6" />
            </div>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.(element);
        }}
        className="shrink-0 self-start text-dh-muted hover:text-red-400 transition-colors p-0.5"
        title="Remove note"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function EncounterEnvironmentCard({ element, trackerOverlay, onRemove, removeTitle = 'Remove from table' }) {
  return (
    <div
      data-testid="encounter-environment-card"
      className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 overflow-hidden group/env"
      {...trackerOverlay.triggerProps(trackerTriggerData('environment', { element }))}
    >
      <div className="px-2.5 py-1.5 flex items-center gap-1.5">
        <span className="text-xs font-semibold text-emerald-300/80 truncate flex-1">{element.name || 'Environment'}</span>
        {onRemove && (
          <button
            type="button"
            onClick={() => { onRemove(element); trackerOverlay.close(); }}
            className="hidden group-hover/env:block text-dh-muted hover:text-red-400 transition-colors shrink-0"
            title={removeTitle}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function encounterAdversaryCardProps(trackerOverlay, item) {
  return trackerOverlay.triggerProps(trackerTriggerData('adversary', {
    baseElement: item.baseElement,
    instances: item.instances,
  }));
}

function OverlayChrome({ imageUrl, imageAlt, onEdit, onRemove, removeTitle, children }) {
  return (
    <div className="p-5 relative">
      {(onEdit || onRemove) && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-blue-400 hover:bg-dh-hover transition-colors"
              title="Edit"
            >
              <Edit size={14} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg bg-dh-raised/90 text-dh-muted hover:text-red-400 hover:bg-dh-hover transition-colors"
              title={removeTitle}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      {imageUrl && (
        <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
          <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover opacity-80" />
        </div>
      )}
      {children}
    </div>
  );
}

export function EncounterTrackerOverlay({
  overlay,
  adjust,
  asideRef,
  zIndexClass = 'z-[55]',
  grouped = [],
  sessionCountdowns = [],
  featureCountdowns,
  onEditEnvironment,
  onRemoveEnvironment,
  onEditAdversary,
  onRemoveAdversaryGroup,
  updateFn,
  allowResourceTrackEdits,
  onRollAttack,
  damageBoost,
  onAddAdversary,
  onPotentialAdversaryHover,
  onPotentialAdversaryLeave,
  removeTitle = 'Remove from table',
}) {
  if (!overlay.isOpen || !overlay.data || typeof document === 'undefined') return null;
  const asideLeft = resolveEncounterAsideLeft(asideRef?.current);
  const style = encounterTrackerOverlayStyle({
    asideLeft,
    viewportWidth: window.innerWidth,
    triggerTop: overlay.data.top,
    triggerBottom: overlay.data.bottom,
    adjust,
  });

  let body;
  if (overlay.data.kind === 'note') {
    const liveNote = grouped.find(
      (g) => g.kind === 'note' && g.element.instanceId === overlay.data.element.instanceId,
    )?.element ?? overlay.data.element;
    const noteBody = String(liveNote.body || '').trim();
    body = (
      <OverlayChrome imageUrl={liveNote.imageUrl} imageAlt={liveNote.name || 'Note'}>
        <h3 className={`text-xl font-bold text-dh mb-1 ${liveNote.imageUrl ? 'pr-16' : ''}`}>
          {liveNote.name || 'Note'}
        </h3>
        <p className="mb-3 text-[11px] text-dh-muted">
          {liveNote.visibility === 'gm' ? 'GM only' : 'Visible to players'}
        </p>
        {noteBody ? (
          <MarkdownText text={noteBody} className="dh-md text-sm leading-relaxed text-dh" />
        ) : (
          <p className="text-sm italic text-dh-muted">No note text.</p>
        )}
      </OverlayChrome>
    );
  } else if (overlay.data.kind === 'countdown') {
    const liveRow = sessionCountdowns.find((r) => r.id === overlay.data.row.id) ?? overlay.data.row;
    const kindLabel = COUNTDOWN_KIND_LABELS[liveRow.kind] || COUNTDOWN_KIND_LABELS.standard;
    const autoLabel = liveRow.kind === 'standard'
      ? (liveRow.autoStandard ? 'Auto (−1) on PC action rolls' : 'Manual')
      : (liveRow.autoDynamic ? 'Auto (dynamic DC)' : 'Manual');
    body = (
      <div className="p-5">
        <h3 className="text-xl font-bold text-dh mb-3">{liveRow.label?.trim() ? liveRow.label : 'Countdown'}</h3>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-dh-muted">Kind</dt>
          <dd className="text-dh">{kindLabel}</dd>
          <dt className="text-dh-muted">Visibility</dt>
          <dd className="text-dh">{liveRow.visibility === 'gm' ? 'GM only' : 'Visible to players'}</dd>
          <dt className="text-dh-muted">Value</dt>
          <dd className="tabular-nums text-dh">{formatSessionCountdownValueLine(liveRow)}</dd>
          {liveRow.looping && liveRow.looping !== 'none' ? (
            <>
              <dt className="text-dh-muted">Looping</dt>
              <dd className="text-dh">{COUNTDOWN_LOOPING_LABELS[liveRow.looping] || liveRow.looping}</dd>
            </>
          ) : null}
          {liveRow.startFormula ? (
            <>
              <dt className="text-dh-muted">Formula</dt>
              <dd className="tabular-nums text-dh">
                {liveRow.startFormula}
                {liveRow.startPending ? ' (pending)' : ''}
              </dd>
            </>
          ) : null}
          <dt className="text-dh-muted">Automation</dt>
          <dd className="text-dh">{autoLabel}</dd>
          {liveRow.sourceRef ? (
            <>
              <dt className="text-dh-muted">Source</dt>
              <dd className="text-emerald-400/90">Linked to feature</dd>
            </>
          ) : null}
        </dl>
        <CountdownRollReferencePanel
          kind={liveRow.kind === 'progress' || liveRow.kind === 'consequence' ? liveRow.kind : 'standard'}
          autoStandard={!!liveRow.autoStandard}
          autoDynamic={!!liveRow.autoDynamic}
        />
      </div>
    );
  } else if (overlay.data.kind === 'environment') {
    const el = overlay.data.element;
    body = (
      <OverlayChrome
        imageUrl={el.imageUrl}
        imageAlt={el.name}
        onEdit={onEditEnvironment ? () => { overlay.close(); onEditEnvironment(el); } : undefined}
        onRemove={onRemoveEnvironment ? () => { onRemoveEnvironment(el); overlay.close(); } : undefined}
        removeTitle={removeTitle}
      >
        <h3 className={`text-xl font-bold text-dh mb-1 ${el.imageUrl || onEditEnvironment || onRemoveEnvironment ? 'pr-20' : ''}`}>
          {el.name}
        </h3>
        <EnvironmentCardContent
          element={el}
          hoveredFeature={null}
          cardKey={el.instanceId}
          featureCountdowns={featureCountdowns}
          updateCountdown={null}
          onAddAdversary={onAddAdversary}
          onPotentialAdversaryHover={onPotentialAdversaryHover}
          onPotentialAdversaryLeave={onPotentialAdversaryLeave}
        />
      </OverlayChrome>
    );
  } else {
    const liveGroup = grouped.find(
      (g) => g.kind === 'adversary-group' && g.baseElement.id === overlay.data.baseElement.id,
    );
    const liveInstances = liveGroup?.instances ?? overlay.data.instances;
    const liveBaseElement = liveGroup?.baseElement ?? overlay.data.baseElement;
    body = (
      <OverlayChrome
        imageUrl={liveBaseElement.imageUrl}
        imageAlt={liveBaseElement.name}
        onEdit={onEditAdversary ? () => { overlay.close(); onEditAdversary(liveInstances, liveBaseElement); } : undefined}
        onRemove={onRemoveAdversaryGroup ? () => { onRemoveAdversaryGroup(liveInstances); overlay.close(); } : undefined}
        removeTitle={removeTitle}
      >
        <h3 className={`text-xl font-bold text-dh mb-1 ${liveBaseElement.imageUrl || onEditAdversary || onRemoveAdversaryGroup ? 'pr-20' : ''}`}>
          {liveBaseElement.name}
          {liveInstances.length > 1 && (
            <span className="text-dh-muted font-normal ml-1.5">×{liveInstances.length}</span>
          )}
        </h3>
        <AdversaryCardContent
          element={liveBaseElement}
          hoveredFeature={null}
          cardKey={liveBaseElement.id}
          count={liveInstances.length}
          instances={liveInstances}
          updateFn={updateFn}
          allowResourceTrackEdits={allowResourceTrackEdits}
          showInstanceRemove={false}
          featureCountdowns={featureCountdowns}
          updateCountdown={null}
          onRollAttack={onRollAttack ? (data, e) => onRollAttack(data, liveBaseElement, liveInstances, e) : undefined}
          damageBoost={damageBoost || liveBaseElement._damageBoost || null}
          scaledMeta={null}
          onScaledToggle={null}
        />
      </OverlayChrome>
    );
  }

  return createPortal(
    <div
      ref={overlay.overlayRef}
      data-testid="encounter-tracker-overlay"
      className={`fixed ${zIndexClass}`}
      style={style}
      {...overlay.overlayHandlers}
    >
      <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
        {body}
      </div>
    </div>,
    document.body,
  );
}

export function EncounterPotentialAdversaryOverlay({
  overlay,
  adjust,
  asideRef,
  zIndexClass = 'z-[56]',
  featureCountdowns,
  onRollAttack,
}) {
  if (!overlay.isOpen || !overlay.data || typeof document === 'undefined') return null;
  const el = overlay.data.element;
  const asideLeft = resolveEncounterAsideLeft(asideRef?.current);
  const style = encounterPotAdvOverlayStyle({
    asideLeft,
    viewportWidth: window.innerWidth,
    triggerTop: overlay.data.top,
    triggerBottom: overlay.data.bottom,
    adjust,
  });

  return createPortal(
    <div
      ref={overlay.overlayRef}
      data-testid="encounter-pot-adv-overlay"
      className={`fixed ${zIndexClass}`}
      style={style}
      {...overlay.overlayHandlers}
    >
      <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 110px)' }}>
        <div className="p-5 relative">
          {el.imageUrl && (
            <div className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl">
              <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" />
            </div>
          )}
          <h3 className="text-xl font-bold text-dh mb-1 pr-16">{el.name}</h3>
          <AdversaryCardContent
            element={el}
            hoveredFeature={null}
            cardKey={el.id}
            count={1}
            instances={[]}
            updateFn={null}
            showInstanceRemove={false}
            featureCountdowns={featureCountdowns}
            updateCountdown={null}
            onRollAttack={onRollAttack ? (data, e) => onRollAttack(data, el, [], e) : undefined}
            damageBoost={null}
            scaledMeta={null}
            onScaledToggle={null}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
