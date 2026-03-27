import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Uniform scale + clip box for a crop preview (testable).
 *
 * @param {{ width: number, height: number }} layout
 * @param {{ x0: number, y0: number, x1: number, y1: number }} rect
 * @param {number} sizePx
 */
export function computeUnifiedImportThumbCrop(layout, rect, sizePx) {
  const W = layout.width;
  const H = layout.height;
  const bw = Math.max(1, rect.x1 - rect.x0);
  const bh = Math.max(1, rect.y1 - rect.y0);
  const s = Math.min(sizePx / bw, sizePx / bh);
  return { W, H, bw, bh, s };
}

/**
 * Cropped region preview for import slice / region tiles (reliable vs CSS background on huge data URLs).
 *
 * @param {{ layout: { width: number, height: number, dataUrl: string }, rect: { x0: number, y0: number, x1: number, y1: number }, sizePx: number, className?: string }} props
 */
export function UnifiedImportSliceThumb({ layout, rect, sizePx, className = '' }) {
  const { W, H, bw, bh, s } = computeUnifiedImportThumbCrop(layout, rect, sizePx);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-dh-canvas shrink-0 ${className}`.trim()}
      style={{ width: sizePx, height: sizePx }}
    >
      <div className="overflow-hidden shrink-0" style={{ width: bw * s, height: bh * s }}>
        <img
          src={layout.dataUrl}
          alt=""
          width={W}
          height={H}
          className="block max-w-none select-none pointer-events-none"
          style={{
            width: W * s,
            height: H * s,
            marginLeft: -rect.x0 * s,
            marginTop: -rect.y0 * s,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

/**
 * Crop preview that scales to fill the parent box (contain), for large slice preview panes.
 *
 * @param {{ layout: { width: number, height: number, dataUrl: string }, rect: { x0: number, y0: number, x1: number, y1: number }, className?: string }} props
 */
export function UnifiedImportSliceThumbMaxFill({ layout, rect, className = '' }) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = layout.width;
  const H = layout.height;
  const bw = Math.max(1, rect.x1 - rect.x0);
  const bh = Math.max(1, rect.y1 - rect.y0);
  const { w: cw, h: ch } = box;
  const s = cw > 0 && ch > 0 ? Math.min(cw / bw, ch / bh) : 0;

  return (
    <div
      ref={wrapRef}
      className={`flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-dh-canvas ${className}`.trim()}
    >
      {s > 0 ? (
        <div className="overflow-hidden shrink-0" style={{ width: bw * s, height: bh * s }}>
          <img
            src={layout.dataUrl}
            alt=""
            width={W}
            height={H}
            className="block max-w-none select-none pointer-events-none"
            style={{
              width: W * s,
              height: H * s,
              marginLeft: -rect.x0 * s,
              marginTop: -rect.y0 * s,
            }}
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}
