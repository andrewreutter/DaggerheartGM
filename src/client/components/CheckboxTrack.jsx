import { useState, useRef, useEffect } from 'react';

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
 * With `onSetFilled`, hover shows the would-be state and a brighter outline on the hovered box.
 */
export function CheckboxTrack({
  total,
  filled,
  pendingFilled = 0,
  pendingClearFilled = 0,
  onSetFilled,
  fillColor,
  label,
  valueOffset = 0,
  verbs,
  currentAbsoluteValue,
  targetToAbsolute,
  pulseOnDecreaseOnly = false,
  fillRow = false,
  className: rowClassName = '',
  itemClassName = '',
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
    if (label && delta > 0) {
      if (verbs) {
        const verb = (currentAbsoluteValue != null && typeof targetToAbsolute === 'function'
          ? targetToAbsolute(targetValue) < currentAbsoluteValue
          : targetValue < filled) ? verbs[1] : verbs[0];
        title = `${verb} ${delta} ${label}`;
      } else {
        title = `${label} → ${targetValue + valueOffset}`;
      }
    }
    if (isPendingClear) title = title ? `${title} (pending GM ack)` : 'Pending GM ack';
    else if (isPending) title = title ? `${title} (pending GM ack)` : 'Pending GM ack';

    const El = onSetFilled ? 'button' : 'div';
    const isHovered = !!onSetFilled && hoverIndex === i;

    /** Solid fill using `fillColor` — mutually exclusive with empty branch (single bg in DOM). */
    let slotClass;
    if (previewOn) {
      const previewDiffers = isCheckboxTrackPreviewSlotChanged(i, filled, effectiveFilled);
      if (previewDiffers) {
        slotClass = 'bg-dh-muted/35 border-dh-strong/55';
      } else if (i < effectiveFilled) {
        slotClass = `${fillColor} border-transparent`;
      } else {
        slotClass = onSetFilled ? 'bg-transparent border-dh-strong/60' : 'bg-transparent border-dh-strong';
      }
    } else if (isPendingClear && isChecked) {
      slotClass = `${fillColor} border-emerald-400/70 border-dashed opacity-75`;
    } else if (isChecked && !isPendingClear) {
      slotClass = `${fillColor} border-transparent`;
    } else if (isPending) {
      slotClass = `${fillColor} border-amber-400/60 border-dashed opacity-60`;
    } else {
      slotClass = onSetFilled ? 'bg-transparent border-dh-strong/60' : 'bg-transparent border-dh-strong';
    }

    const hoverOutline = isHovered
      ? 'relative z-[1] ring-2 ring-dh ring-offset-0'
      : '';

    items.push(
      <El
        key={i}
        type={El === 'button' ? 'button' : undefined}
        onClick={onSetFilled ? () => onSetFilled(targetValue) : undefined}
        onMouseEnter={onSetFilled ? () => setHoverIndex(i) : undefined}
        title={onSetFilled || isPending || isPendingClear ? title : undefined}
        className={`checkbox-track-item ${fillRow ? 'flex-1 min-w-0 min-h-5 rounded-sm border-2' : 'w-4 h-4 rounded-sm border-2 flex-shrink-0'} transition-[box-shadow,border-color,background-color] ${onSetFilled ? 'cursor-pointer' : ''} ${itemClassName} ${slotClass} ${hoverOutline}`}
      />
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
