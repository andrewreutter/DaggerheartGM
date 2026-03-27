import { useCallback, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Draw additional camera rectangles on a map image (normalized 0–1 coords).
 * Each crop uses the same aspect ratio as the battle map viewport (width/height).
 *
 * @param {{ mapImageUrl: string, mapImageNaturalWidth: number, mapImageNaturalHeight: number, viewportAspect: number, rectsNorm: { x: number, y: number, w: number, h: number }[], onRectsChange: (next: { x: number, y: number, w: number, h: number }[]) => void }} props
 */
export function MapImportCameraEditor({
  mapImageUrl,
  mapImageNaturalWidth: W,
  mapImageNaturalHeight: H,
  viewportAspect,
  rectsNorm,
  onRectsChange,
}) {
  const wrapRef = useRef(null);
  const [draft, setDraft] = useState(null);

  const aspect = viewportAspect > 0 ? viewportAspect : 16 / 9;

  const fitAspect = useCallback(
    (x0, y0, x1, y1) => {
      let bw = Math.abs(x1 - x0);
      let bh = Math.abs(y1 - y0);
      const ar = bw / (bh || 1);
      if (ar > aspect) {
        bh = bw / aspect;
      } else {
        bw = bh * aspect;
      }
      let left = Math.min(x0, x1);
      let top = Math.min(y0, y1);
      if (left + bw > W) left = Math.max(0, W - bw);
      if (top + bh > H) top = Math.max(0, H - bh);
      left = Math.max(0, Math.min(left, W - bw));
      top = Math.max(0, Math.min(top, H - bh));
      bw = Math.min(bw, W - left);
      bh = Math.min(bh, H - top);
      return { x: left / W, y: top / H, w: bw / W, h: bh / H };
    },
    [W, H, aspect],
  );

  const clientToImg = (clientX, clientY) => {
    const el = wrapRef.current?.querySelector('[data-map-img]');
    if (!el || W <= 0 || H <= 0) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width;
    const sy = (clientY - r.top) / r.height;
    return { x: sx * W, y: sy * H };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = clientToImg(e.clientX, e.clientY);
    setDraft({ x0: x, y0: y, x1: x, y1: y });
  };

  const onPointerMove = (e) => {
    if (!draft) return;
    const { x, y } = clientToImg(e.clientX, e.clientY);
    setDraft((d) => (d ? { ...d, x1: x, y1: y } : null));
  };

  const onPointerUp = (e) => {
    if (!draft) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = clientToImg(e.clientX, e.clientY);
    const norm = fitAspect(draft.x0, draft.y0, x, y);
    if (norm.w > 0.002 && norm.h > 0.002) {
      onRectsChange([...rectsNorm, norm]);
    }
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-dh-muted">
        Drag on the map to add camera views (same aspect ratio as the battle map viewport). Each rectangle becomes an extra map
        view after import.
      </p>
      <div
        ref={wrapRef}
        className="relative max-h-[min(50vh,420px)] w-full cursor-crosshair overflow-hidden rounded-lg border border-dh-border bg-dh-canvas touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(null)}
      >
        <img
          data-map-img
          src={mapImageUrl}
          alt=""
          className="pointer-events-none block h-auto w-full max-h-[min(50vh,420px)] object-contain select-none"
          draggable={false}
        />
        {rectsNorm.map((b, i) => (
          <div
            key={`${b.x}-${b.y}-${i}`}
            className="pointer-events-none absolute border-2 border-amber-400/90 bg-amber-500/15"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
            }}
          />
        ))}
        {draft ? (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-sky-400/80 bg-sky-500/10"
            style={{
              ...(() => {
                const n = fitAspect(draft.x0, draft.y0, draft.x1, draft.y1);
                return { left: `${n.x * 100}%`, top: `${n.y * 100}%`, width: `${n.w * 100}%`, height: `${n.h * 100}%` };
              })(),
            }}
          />
        ) : null}
      </div>
      {rectsNorm.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {rectsNorm.map((b, i) => (
            <li
              key={`cam-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-dh-border bg-dh-raised/50 px-2 py-1 text-[11px] text-dh"
            >
              Camera {i + 2}
              <button
                type="button"
                className="rounded p-0.5 text-red-400 hover:bg-dh-hover"
                aria-label={`Remove camera ${i + 2}`}
                onClick={() => onRectsChange(rectsNorm.filter((_, j) => j !== i))}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
