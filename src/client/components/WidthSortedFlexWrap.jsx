import { Children, cloneElement, useLayoutEffect, useRef, useState } from 'react';

function sameOrder(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** Pure helper — widest index first; ties keep original order. */
export function sortIndicesByDescendingWidth(widths) {
  const measured = widths.map((w, i) => ({ i, w }));
  measured.sort((a, b) => b.w - a.w || a.i - b.i);
  return measured.map((x) => x.i);
}

/**
 * Primary key descending, then secondary (e.g. outer flex width) for ties.
 */
export function sortIndicesByDescendingWidthTwoKey(primary, secondary) {
  const measured = primary.map((w, i) => ({
    i,
    w,
    s: secondary[i] ?? 0,
  }));
  measured.sort((a, b) => {
    if (Math.abs(b.w - a.w) > 0.01) return b.w - a.w;
    if (Math.abs(b.s - a.s) > 0.01) return b.s - a.s;
    return a.i - b.i;
  });
  return measured.map((x) => x.i);
}

/**
 * Width used for ordering flex-wrap children. Prefer the widest interactive
 * control (buttons / segmented chips) so full-width rows still sort by real
 * content size instead of all tying at container width.
 */
export function measureSortWidthForNode(node) {
  if (!node?.getBoundingClientRect) return 0;
  const outer = node.getBoundingClientRect().width;
  let max = 0;
  if (typeof node.querySelectorAll === 'function') {
    node.querySelectorAll('button').forEach((el) => {
      max = Math.max(max, el.getBoundingClientRect().width);
    });
    node.querySelectorAll('[data-v2-seg-btn]').forEach((el) => {
      max = Math.max(max, el.getBoundingClientRect().width);
    });
  }
  if (max > 0) return max;
  return outer;
}

/**
 * Flex-wrap container that reorders direct children widest-first after layout.
 * Used for the character sheet Actions strip so larger controls pack first.
 *
 * Measures once per child-count change (natural order first paint, then one
 * sorted update). No ResizeObserver — reordering must not feed back into
 * measurement or the layout can oscillate.
 */
export function WidthSortedFlexWrap({ children, className = '' }) {
  const containerRef = useRef(null);
  const [order, setOrder] = useState(null);
  const childArray = Children.toArray(children).filter(Boolean);
  const n = childArray.length;

  const effectiveOrder = order != null && order.length === n ? order : null;

  useLayoutEffect(() => {
    if (n === 0) {
      setOrder(null);
      return;
    }
    const root = containerRef.current;
    if (!root) return;
    const nodes = [...root.children];
    if (nodes.length !== n) return;

    const outerWidths = nodes.map((node) => node.getBoundingClientRect().width);
    const intrinsicWidths = nodes.map((node) => measureSortWidthForNode(node));
    const nextOrder = sortIndicesByDescendingWidthTwoKey(intrinsicWidths, outerWidths);
    const natural = Array.from({ length: n }, (_, i) => i);
    const nextState = sameOrder(nextOrder, natural) ? null : nextOrder;

    setOrder((prev) => {
      if (prev === nextState) return prev;
      if (prev == null && nextState == null) return prev;
      if (prev != null && nextState != null && sameOrder(prev, nextState)) return prev;
      return nextState;
    });
  }, [n]);

  const ordered =
    effectiveOrder == null
      ? childArray
      : effectiveOrder.map((idx) => childArray[idx]).filter((x) => x != null);

  if (n === 0) return null;

  return (
    <div ref={containerRef} className={className}>
      {ordered.map((child, i) =>
        cloneElement(child, { key: child.key != null ? child.key : `ws-${i}` })
      )}
    </div>
  );
}
