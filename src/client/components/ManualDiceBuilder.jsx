import { useEffect, useRef, useState } from 'react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { renderColoredDiceGroups, DEFAULT_COLORSET } from '../lib/dice-color-groups.js';
import { MANUAL_DICE_SIZES, buildManualRollText, buildPreviewGroups } from '../lib/manual-dice-roll-text.js';

/** Preview dice count per size is capped so a huge input (e.g. 99) doesn't blow up the physics sim. */
const TRAY_PREVIEW_CAP = 8;
/** Rebuild the size tray only once input activity pauses, not on every keystroke. */
const TRAY_DEBOUNCE_MS = 450;

let previewDiceBoxSeq = 0;

/** Mounts a small, self-contained DiceBox instance into `containerRef`'s element once it's in the DOM. */
function usePreviewDiceBox() {
  const containerRef = useRef(null);
  const containerIdRef = useRef(`manual-dice-preview-${++previewDiceBoxSeq}`);
  const dbRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.id = containerIdRef.current;

    // These preview boxes are tiny (~80px tall) compared to the full-size DiceRoller canvas
    // that baseScale:100 was tuned for. baseScale sets the die's absolute size in Three.js
    // world units, which map ~1:1 to the container's CSS pixel dimensions (dice-box-threejs
    // positions its walls at containerWidth/Height * 0.93) — so the same baseScale used on a
    // much smaller container makes dice nearly as big as the whole box.
    const PREVIEW_BASE_SCALE = 26;

    const db = new DiceBox(`#${containerIdRef.current}`, {
      assetPath:          '/dice-threejs/',
      gravity_multiplier: 400,
      light_intensity:    0.8,
      baseScale:          PREVIEW_BASE_SCALE,
      strength:           1,
      sounds:             false,
      shadows:            false,
      theme_surface:      'green-felt',
      theme_colorset:     'white',
      theme_material:     'glass',
      onRollComplete:     () => {},
      onAddDiceComplete:  () => {},
    });

    let cancelled = false;
    db.initialize()
      .then(() => {
        if (cancelled) return;
        if (db.desk) db.desk.visible = false;
        // dice-box-threejs never calls setPixelRatio itself, so the renderer draws at 1x
        // device pixels regardless of screen density — on a high-DPI (retina) display the
        // browser then upscales that low-res buffer to fill the CSS box, which looks blurry.
        // Re-apply size with the real device pixel ratio to render at full resolution.
        if (db.renderer?.setPixelRatio) {
          db.renderer.setPixelRatio(window.devicePixelRatio || 1);
          db.renderer.render(db.scene, db.camera);
        }
        dbRef.current = db;
        setReady(true);
      })
      .catch((err) => console.error('[ManualDiceBuilder] preview dice init failed:', err));

    return () => {
      cancelled = true;
      dbRef.current = null;
      setReady(false);
    };
  }, []);

  return { containerRef, dbRef, ready };
}

/**
 * Redesigned Action Log manual dice builder: a single shared live preview tray showing
 * whatever is currently selected (Duality's Hope/Fear d12s plus any active d4-d20 dice),
 * with a title/control column per die type — Duality's checkbox alongside the d4-d20 count
 * inputs, all in one aligned row.
 * rollBuilder — { onRoll(rollText, displayName), displayName }.
 * onRolled — called after a successful roll (used by ActionLog to close the overlay).
 */
export function ManualDiceBuilder({ rollBuilder, onRolled }) {
  const [dualityOn, setDualityOn] = useState(false);
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, 0]))
  );
  const [modifier, setModifier] = useState(0);

  const tray = usePreviewDiceBox();

  // Single shared preview spans the full width (including the space that used to be a
  // separate dedicated Duality box) and reflects whatever will actually be rolled — Duality's
  // Hope/Fear d12s (in their real amber/purple colors) only appear once the checkbox is on,
  // same as any other die size only appearing once its count is > 0. Rebuilt on a debounce so
  // it settles once per pause in input activity rather than animating on every keystroke.
  useEffect(() => {
    if (!tray.ready) return;
    const timer = setTimeout(() => {
      const groups = buildPreviewGroups(dualityOn, counts, TRAY_PREVIEW_CAP);
      if (groups.length) renderColoredDiceGroups(tray.dbRef.current, groups);
      else tray.dbRef.current?.clearDice();
    }, TRAY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray.ready, dualityOn, JSON.stringify(counts)]);

  const canRoll = dualityOn || MANUAL_DICE_SIZES.some((s) => (counts[s] || 0) > 0) || modifier !== 0;

  function handleRoll() {
    const rollText = buildManualRollText(dualityOn, counts, modifier);
    if (!rollText) return;
    rollBuilder.onRoll(rollText, rollBuilder.displayName);
    onRolled?.();
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Single shared preview, full width — Duality's Hope/Fear d12s (amber/purple) and
          the d4-d20 dice (neutral) only appear here once active, just like the controls below. */}
      <div className="relative w-full min-h-[5rem] overflow-hidden rounded-lg border border-dh-strong bg-dh-raised/40">
        <div ref={tray.containerRef} className="absolute inset-0" />
      </div>

      {/* Titles row + controls row, all columns aligned: Duality, then d4-d20 */}
      <div className="flex items-stretch justify-between gap-1.5">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className="w-full h-9 rounded-md border flex items-center justify-center text-[10px] font-bold leading-tight text-center transition-opacity"
            style={{
              background:  DEFAULT_COLORSET.background,
              color:       DEFAULT_COLORSET.foreground,
              borderColor: DEFAULT_COLORSET.outline,
              opacity:     dualityOn ? 1 : 0.3,
            }}
          >
            Duality
          </div>
          <label className="w-full h-12 rounded border border-dh-strong bg-dh-raised flex items-center justify-center cursor-pointer">
            <input
              type="checkbox"
              checked={dualityOn}
              onChange={(e) => setDualityOn(e.target.checked)}
              className="w-5 h-5 rounded border-dh-strong bg-dh-raised text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
          </label>
        </div>
        {MANUAL_DICE_SIZES.map((size) => {
          const active = (counts[size] || 0) > 0;
          return (
            <div key={size} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className="w-full h-9 rounded-md border flex items-center justify-center text-[11px] font-bold tabular-nums transition-opacity"
                style={{
                  background:  DEFAULT_COLORSET.background,
                  color:       DEFAULT_COLORSET.foreground,
                  borderColor: DEFAULT_COLORSET.outline,
                  opacity:     active ? 1 : 0.3,
                }}
              >
                d{size}
              </div>
              <input
                type="number"
                min={0}
                max={99}
                value={counts[size] || 0}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0));
                  setCounts((c) => ({ ...c, [size]: v }));
                }}
                className="w-full h-12 rounded border border-dh-strong bg-dh-raised text-lg text-dh text-center tabular-nums"
              />
            </div>
          );
        })}
        {/* Flat +/- modifier column (e.g. the "+3" in "2d6+3") — not a die, so it's excluded
            from the shared 3D preview above. */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className="w-full h-9 rounded-md border flex items-center justify-center text-[11px] font-bold tabular-nums transition-opacity"
            style={{
              background:  DEFAULT_COLORSET.background,
              color:       DEFAULT_COLORSET.foreground,
              borderColor: DEFAULT_COLORSET.outline,
              opacity:     modifier !== 0 ? 1 : 0.3,
            }}
          >
            +
          </div>
          <input
            type="number"
            min={-99}
            max={99}
            value={modifier}
            onChange={(e) => {
              const v = Math.max(-99, Math.min(99, parseInt(e.target.value, 10) || 0));
              setModifier(v);
            }}
            className="w-full h-12 rounded border border-dh-strong bg-dh-raised text-lg text-dh text-center tabular-nums"
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          disabled={!canRoll}
          onClick={handleRoll}
          className="px-6 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-amber-950"
        >
          Roll
        </button>
      </div>
    </div>
  );
}
