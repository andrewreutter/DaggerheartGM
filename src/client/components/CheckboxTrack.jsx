import { useState, useRef, useEffect } from 'react';
import { Skull, Shield, Sparkles, Flame, AlertCircle } from 'lucide-react';

/**
 * @typedef {'hope'|'fear'|'hp'|'armor'|'stress'|'stressPurple'} CheckboxTrackKind
 */

/** Empty slots: slightly light gray icon only (no border). */
export const CHECKBOX_TRACK_EMPTY_ICON =
  'text-neutral-400/95 dh-light:text-neutral-500';

/** Preset icons + icon color when marked (borders only for hover preview / pending overlays). */
export const CHECKBOX_TRACK_PRESETS = {
  hope: {
    Icon: Sparkles,
    icon: 'text-yellow-400 dh-light:text-yellow-600',
    /** Hope-only: solid yellow vs gray cell borders (character sheet header). */
    borderFilled: 'border-2 border-yellow-400 dh-light:border-yellow-500',
    borderEmpty: 'border-2 border-dh-muted dh-light:border-dh-muted',
  },
  fear: {
    Icon: Flame,
    icon: 'text-fuchsia-400 dh-light:text-fuchsia-600',
  },
  hp: {
    Icon: Skull,
    icon: 'text-red-500 stroke-red-600 dh-light:stroke-red-600',
  },
  armor: {
    Icon: Shield,
    icon: 'text-cyan-500 stroke-cyan-600 dh-light:stroke-cyan-700',
  },
  stress: {
    Icon: AlertCircle,
    icon: 'text-orange-500 stroke-orange-600 dh-light:stroke-orange-700',
  },
  stressPurple: {
    Icon: AlertCircle,
    icon: 'text-purple-500 stroke-purple-600',
  },
};

/**
 * @param {CheckboxTrackKind} kind
 */
export function getCheckboxTrackPreset(kind) {
  return CHECKBOX_TRACK_PRESETS[kind] ?? CHECKBOX_TRACK_PRESETS.hp;
}

/**
 * Filled count after clicking the box at `hoverIndex` (same value `onSetFilled` receives
 * — damage for HP, stress/armor slots, remaining Hope, etc.).
 */
export function computeCheckboxTrackPreviewFilled(filled, hoverIndex, total) {
  if (hoverIndex == null || !Number.isFinite(hoverIndex)) return filled;
  const h = Math.max(0, Math.min(Math.floor(hoverIndex), Math.max(0, total - 1)));
  const inFilledRun = h < filled;
  const next = inFilledRun ? h : h + 1;
  return Math.max(0, Math.min(next, total));
}

/** True when slot `i` would change filled vs empty after hover preview vs actual `filled`. */
export function isCheckboxTrackPreviewSlotChanged(i, filled, effectiveFilled) {
  return (i < filled) !== (i < effectiveFilled);
}

/**
 * Resource track: `total` boxes, `filled` marked, optional pending GM-ack overlays.
 * Default: type-colored or light-gray icons only. Dashed borders on hover preview and pending GM-ack.
 *
 * @param {object} props
 * @param {CheckboxTrackKind} [props.trackKind] — icon + color palette.
 * @param {boolean} [props.slotTypeTooltip] — when true, each slot shows `label` in the native tooltip (Characters panel); default leaves other surfaces unchanged.
 * @param {boolean} [props.stopSlotClickPropagation] — when true and slots are buttons, `click` stops propagation (e.g. Game Table character card opens sheet on card click; only slot icons should not bubble).
 */
export function CheckboxTrack({
  total,
  filled,
  pendingFilled = 0,
  pendingClearFilled = 0,
  onSetFilled,
  trackKind = 'hp',
  label,
  valueOffset = 0,
  verbs,
  currentAbsoluteValue,
  targetToAbsolute,
  pulseOnDecreaseOnly = false,
  fillRow = false,
  className: rowClassName = '',
  itemClassName = '',
  slotTypeTooltip = false,
  stopSlotClickPropagation = false,
}) {
  const [pulsing, setPulsing] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const prevFilledRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (prevFilledRef.current === null) { prevFilledRef.current = filled; return; }
    if (filled !== prevFilledRef.current) {
      const increased = filled > prevFilledRef.current;
      prevFilledRef.current = filled;
      if (pulseOnDecreaseOnly && increased) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setPulsing(false);
      requestAnimationFrame(() => {
        setPulsing(true);
        timerRef.current = setTimeout(() => setPulsing(false), 400);
      });
    }
  }, [filled, pulseOnDecreaseOnly]);

  if (!total || total <= 0) return <span className="text-dh-muted text-xs">-</span>;

  const preset = getCheckboxTrackPreset(trackKind);
  const { Icon } = preset;

  const previewOn = !!onSetFilled && hoverIndex != null;
  const effectiveFilled = previewOn
    ? computeCheckboxTrackPreviewFilled(filled, hoverIndex, total)
    : filled;

  const pendingStart = filled;
  const pendingEnd = Math.min(filled + pendingFilled, total);
  const pc = Math.min(Math.max(0, pendingClearFilled), filled);

  const items = [];
  for (let i = 0; i < total; i++) {
    const isChecked = i < filled;
    const isPendingClear = !previewOn && pc > 0 && i >= filled - pc && i < filled;
    const isPending = !previewOn && !isPendingClear && i >= pendingStart && i < pendingEnd;
    const targetValue = isChecked ? i : i + 1;
    const delta = (currentAbsoluteValue != null && typeof targetToAbsolute === 'function')
      ? Math.abs(targetToAbsolute(targetValue) - currentAbsoluteValue)
      : Math.abs(targetValue - filled);
    let title = '';
    // Verb / delta hints only when slots are clickable — passive tracks (e.g. Characters panel) use label-only tooltips.
    if (onSetFilled && label && delta > 0) {
      if (verbs) {
        const verb = (currentAbsoluteValue != null && typeof targetToAbsolute === 'function'
          ? targetToAbsolute(targetValue) < currentAbsoluteValue
          : targetValue < filled) ? verbs[1] : verbs[0];
        title = `${verb} ${delta} ${label}`;
      } else {
        title = `${label} → ${targetValue + valueOffset}`;
      }
    }
    if (isPendingClear) {
      title = title
        ? `${title} (pending GM ack)`
        : (slotTypeTooltip && label ? `${label} (pending GM ack)` : 'Pending GM ack');
    } else if (isPending) {
      title = title
        ? `${title} (pending GM ack)`
        : (slotTypeTooltip && label ? `${label} (pending GM ack)` : 'Pending GM ack');
    } else if (slotTypeTooltip && !title && label) {
      title = label;
    }

    const El = onSetFilled ? 'button' : 'div';
    const isHovered = !!onSetFilled && hoverIndex === i;

    const iCheckedEffective = i < effectiveFilled;
    let previewDiffers = false;
    if (previewOn) {
      previewDiffers = isCheckboxTrackPreviewSlotChanged(i, filled, effectiveFilled);
    }

    /** Committed marks, plus pending GM-ack adds on still-empty slots */
    const isMarkedVisual = previewOn
      ? iCheckedEffective
      : (i < filled || isPending);

    let borderClass;
    let iconClass;
    if (previewDiffers) {
      borderClass = 'border-2 border-dh-strong border-dashed bg-transparent';
      iconClass = `${CHECKBOX_TRACK_EMPTY_ICON} opacity-90`;
    } else if (isPendingClear) {
      borderClass = 'border-2 border-emerald-400/70 border-dashed bg-transparent';
      iconClass = `${preset.icon} opacity-75`;
    } else if (isPending) {
      borderClass = 'border-2 border-amber-400/60 border-dashed bg-transparent';
      iconClass = `${preset.icon} opacity-60`;
    } else if (isMarkedVisual) {
      borderClass = preset.borderFilled
        ? `${preset.borderFilled} border-solid bg-transparent`
        : 'border-0 border-transparent bg-transparent';
      iconClass = preset.icon;
    } else {
      borderClass = preset.borderEmpty
        ? `${preset.borderEmpty} border-solid bg-transparent`
        : 'border-0 border-transparent bg-transparent';
      iconClass = CHECKBOX_TRACK_EMPTY_ICON;
    }

    const hoverOutline = isHovered
      ? 'relative z-[1] ring-2 ring-dh ring-offset-0'
      : '';

    const iconSize = fillRow ? 'w-[0.875rem] h-[0.875rem]' : 'w-3 h-3';

    items.push(
      <El
        key={i}
        type={El === 'button' ? 'button' : undefined}
        onClick={
          onSetFilled
            ? (e) => {
                if (stopSlotClickPropagation) e.stopPropagation();
                onSetFilled(targetValue);
              }
            : undefined
        }
        onMouseEnter={onSetFilled ? () => setHoverIndex(i) : undefined}
        title={
          slotTypeTooltip
            ? (title || undefined)
            : (onSetFilled || isPending || isPendingClear ? title : undefined)
        }
        className={`checkbox-track-item ${fillRow ? 'flex-1 min-w-0 min-h-5 rounded-sm' : 'w-4 h-4 rounded-sm flex-shrink-0'} inline-flex items-center justify-center ${onSetFilled ? 'cursor-pointer' : ''} ${itemClassName} ${borderClass} ${hoverOutline} transition-[box-shadow,border-color,opacity]`}
      >
        <Icon
          className={`${iconSize} shrink-0 pointer-events-none ${iconClass}`}
          strokeWidth={2.25}
          aria-hidden
        />
      </El>,
    );
  }

  return (
    <div
      className={`flex items-center ${fillRow ? 'flex-nowrap w-full' : 'flex-wrap'} gap-0.5${pulsing ? ' stat-pulse-anim' : ''} ${rowClassName}`}
      onMouseLeave={onSetFilled ? () => setHoverIndex(null) : undefined}
    >
      {items}
    </div>
  );
}
