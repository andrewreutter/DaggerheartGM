import { Children, cloneElement, useLayoutEffect, useRef, useState } from 'react';
import {
  V2_SEGMENT_ROW_OUTER,
  V2_SEGMENT_BTN_BASE,
  V2_INLINE_SEG_ON,
  V2_INLINE_SEG_OFF,
  groupButtonIndicesByRow,
} from '../lib/v2-inline-select-ui.js';

function sameIndicesByRow(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row.length === b[i].length && row.every((v, j) => v === b[i][j]));
}

/** Matches “selected” sky fills from {@link V2_INLINE_SEG_ON} / sheet palettes before merge. */
function isSegmentOn(className) {
  if (typeof className !== 'string') return false;
  return (
    /\bbg-sky-950\b/.test(className) ||
    /\bbg-sky-500\b/.test(className) ||
    /\bbg-sky-600\b/.test(className)
  );
}

/** Walks Tooltip wrappers; prefers explicit `aria-pressed` (e.g. iconGrid current selection) over class heuristics. */
function findButtonAriaPressed(el) {
  if (!el || typeof el !== 'object') return undefined;
  if (el.type === 'button') {
    const p = el.props?.['aria-pressed'];
    if (p === true) return true;
    if (p === false) return false;
    return undefined;
  }
  const ch = el.props?.children;
  if (ch == null) return undefined;
  for (const c of Children.toArray(ch)) {
    const r = findButtonAriaPressed(c);
    if (r !== undefined) return r;
  }
  return undefined;
}

function resolveSegmentOn(child) {
  const origClass = findButtonClassName(child);
  const pressed = findButtonAriaPressed(child);
  if (pressed === true) return true;
  if (pressed === false) return false;
  return isSegmentOn(origClass);
}

/** Inject data attributes on the inner native <button> (e.g. inside Tooltip). */
function cloneMeasureMarkers(el, idx) {
  if (!el || typeof el !== 'object') return el;
  if (el.type === 'button') {
    return cloneElement(el, {
      'data-v2-seg-btn': true,
      'data-v2-seg-idx': String(idx),
    });
  }
  const ch = el.props?.children;
  if (ch == null) return el;
  const chArr = Children.toArray(ch);
  const mapped = chArr.map((c) => cloneMeasureMarkers(c, idx));
  return cloneElement(el, { children: mapped.length === 1 ? mapped[0] : mapped });
}

function findButtonClassName(el) {
  if (!el || typeof el !== 'object') return '';
  if (el.type === 'button') return el.props?.className || '';
  const ch = el.props?.children;
  if (ch == null) return '';
  for (const c of Children.toArray(ch)) {
    const r = findButtonClassName(c);
    if (r !== '') return r;
  }
  return '';
}

/** Apply segmented button classes to the inner native <button>. */
function cloneApplySegmentBtn(el, mergedClass) {
  if (!el || typeof el !== 'object') return el;
  if (el.type === 'button') {
    return cloneElement(el, { className: mergedClass });
  }
  const ch = el.props?.children;
  if (ch == null) return el;
  const chArr = Children.toArray(ch);
  const mapped = chArr.map((c) => cloneApplySegmentBtn(c, mergedClass));
  return cloneElement(el, { children: mapped.length === 1 ? mapped[0] : mapped });
}

/**
 * After flex-wrap layout settles, groups option buttons that share a row into segmented
 * controls (joined borders / divide-x).
 */
export function V2SegmentedRowWrap({ children, className = '', intrinsicWidth = false }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const widthRef = useRef(0);
  const [indicesByRow, setIndicesByRow] = useState(null);
  const childArray = Children.toArray(children).filter(Boolean);
  const n = childArray.length;

  const runMeasure = () => {
    const root = measureRef.current;
    if (!root) return;
    const btnEls = [...root.querySelectorAll('[data-v2-seg-btn]')];
    if (btnEls.length === 0) {
      setIndicesByRow((prev) => (prev && prev.length === 0 ? prev : []));
      return;
    }
    const tops = btnEls.map((el) => el.offsetTop);
    const groups = groupButtonIndicesByRow(tops);
    setIndicesByRow((prev) => (sameIndicesByRow(prev, groups) ? prev : groups));
  };

  useLayoutEffect(() => {
    if (n === 0) {
      setIndicesByRow([]);
      return;
    }
    if (indicesByRow !== null) return;
    runMeasure();
    const root = measureRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => runMeasure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [n, indicesByRow]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      if (widthRef.current === 0) {
        widthRef.current = w;
        return;
      }
      if (Math.abs(w - widthRef.current) < 2) return;
      widthRef.current = w;
      setIndicesByRow(null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (n === 0) return null;

  const widthCls = intrinsicWidth ? 'w-auto max-w-full min-w-0' : 'w-full min-w-0';

  if (indicesByRow === null) {
    return (
      <div ref={containerRef} className={widthCls}>
        <div ref={measureRef} className={`flex flex-wrap gap-1 ${widthCls} ${className}`}>
          {Children.map(children, (child, i) =>
            cloneElement(cloneMeasureMarkers(child, i), { key: child.key ?? i })
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col gap-1 ${widthCls} ${className}`}>
      {indicesByRow.map((row, ri) => (
        <div key={ri} className={V2_SEGMENT_ROW_OUTER}>
          {row.map((idx) => {
            const child = childArray[idx];
            if (!child) return null;
            const on = resolveSegmentOn(child);
            const merged = `${V2_SEGMENT_BTN_BASE} ${on ? V2_INLINE_SEG_ON : V2_INLINE_SEG_OFF}`;
            return cloneElement(cloneApplySegmentBtn(child, merged), { key: child.key ?? idx });
          })}
        </div>
      ))}
    </div>
  );
}
