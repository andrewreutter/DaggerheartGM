import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Save, X } from 'lucide-react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { renderColoredDiceGroups, DEFAULT_COLORSET } from '../lib/dice-color-groups.js';
import { MANUAL_DICE_SIZES, buildManualRollText, buildPreviewGroups } from '../lib/manual-dice-roll-text.js';
import { readSavedDiceRolls, buildSavedDiceRoll, addSavedDiceRoll, removeSavedDiceRoll } from '../lib/saved-dice-rolls.js';

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
 * A three-part stepper: decrement button / numeric input / increment button.
 * The decrement is disabled at 0; increment is disabled at max (default 99).
 */
function DiceCountStepper({ value, onChange, max = 99 }) {
  return (
    <div className="w-full h-12 rounded border border-dh-strong bg-dh-raised flex items-stretch overflow-hidden">
      <button
        type="button"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex-1 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dh-surface text-dh-muted transition-colors"
        aria-label="Decrease"
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0)))}
        className="flex-1 min-w-0 border-x border-dh-strong bg-transparent text-center text-dh text-base tabular-nums outline-none"
      />
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex-1 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dh-surface text-dh-muted transition-colors"
        aria-label="Increase"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

/**
 * Redesigned Action Log manual dice builder: a single shared live preview tray showing
 * whatever is currently selected (Duality's Hope/Fear d12s plus any active die columns),
 * with a title/control column per die type — Duality's checkbox alongside the die count
 * steppers, all in one aligned row.
 *
 * State (dualityOn, counts, modifier) is owned by the parent (ActionLog) so it persists
 * across open/close cycles. This component is fully controlled for those three values.
 *
 * Below the die columns, a left-to-right button strip shows any saved rolls (persisted via
 * `saved-dice-rolls.js`; one click loads that preset's dualityOn/counts/modifier into the
 * controls above — it does not roll immediately, the user still presses Roll), then Save
 * (prompts for a name and stores the current controls as a new saved roll), then Roll —
 * saved and Save buttons size to their content, Roll expands to fill the remaining width.
 *
 * Props:
 *   rollBuilder   — { onRoll(rollText, displayName), displayName }
 *   onRolled      — called after a successful roll (e.g. close the overlay)
 *   dualityOn / setDualityOn
 *   counts / setCounts
 *   modifier / setModifier
 */
export function ManualDiceBuilder({
  rollBuilder,
  onRolled,
  dualityOn,
  setDualityOn,
  counts,
  setCounts,
  modifier,
  setModifier,
}) {
  const tray = usePreviewDiceBox();
  const [savedRolls, setSavedRolls] = useState(() => readSavedDiceRolls());

  // Single shared preview spans the full width and reflects whatever will actually be rolled.
  // Rebuilt on a debounce so it settles once per pause in input activity.
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

  /** Loads a saved roll's dice/modifier into the builder controls; the user still presses Roll. */
  function handleLoadSaved(saved) {
    setDualityOn(!!saved.dualityOn);
    setCounts(Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, Number(saved.counts?.[s]) || 0])));
    setModifier(Number(saved.modifier) || 0);
  }

  function handleSave() {
    if (!canRoll) return;
    const name = window.prompt('Name this roll');
    if (!name || !name.trim()) return;
    const entry = buildSavedDiceRoll(name, { dualityOn, counts, modifier });
    setSavedRolls((prev) => addSavedDiceRoll(prev, entry));
  }

  function handleDeleteSaved(e, id) {
    e.stopPropagation();
    setSavedRolls((prev) => removeSavedDiceRoll(prev, id));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Single shared preview, full width */}
      <div className="relative w-full min-h-[5rem] overflow-hidden rounded-lg border border-dh-strong bg-dh-raised/40">
        <div ref={tray.containerRef} className="absolute inset-0" />
      </div>

      {/* Titles row + controls row, all columns aligned: Duality, then die sizes, then modifier */}
      <div className="flex items-stretch justify-between gap-1.5">
        {/* Duality checkbox column */}
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

        {/* One stepper column per die size (d4, d6, d8, d10, d12, d20, d100) */}
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
              <DiceCountStepper
                value={counts[size] || 0}
                onChange={(v) => setCounts((c) => ({ ...c, [size]: v }))}
              />
            </div>
          );
        })}

        {/* Flat +/- modifier column (e.g. "+3" in "2d6+3") — not a die, left as plain input */}
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

      {/* Saved rolls, then Save, then Roll — all left-to-right in one strip; saved-roll and
          Save buttons take only as much width as their content needs, Roll expands to fill
          whatever space remains. */}
      <div className="flex items-stretch gap-1.5">
        {savedRolls.map((saved) => (
          <div key={saved.id} className="relative group shrink-0">
            <button
              type="button"
              title={`Load: ${buildManualRollText(saved.dualityOn, saved.counts, saved.modifier)}`}
              onClick={() => handleLoadSaved(saved)}
              className="h-9 max-w-[8rem] truncate px-2.5 rounded border border-dh-strong bg-dh-raised hover:bg-dh-surface text-xs text-dh whitespace-nowrap"
            >
              {saved.name}
            </button>
            <button
              type="button"
              title={`Delete "${saved.name}"`}
              aria-label={`Delete saved roll ${saved.name}`}
              onClick={(e) => handleDeleteSaved(e, saved.id)}
              className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-dh-raised border border-dh-strong items-center justify-center text-dh-muted hover:text-red-300 hover:bg-red-900 transition-colors"
            >
              <X size={8} />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={!canRoll}
          onClick={handleSave}
          title="Save this roll for one-click reuse"
          className="h-9 shrink-0 flex items-center gap-1 px-2.5 rounded border border-dh-strong bg-dh-raised hover:bg-dh-surface disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-dh-muted hover:text-dh"
        >
          <Save size={12} />
          Save
        </button>
        <button
          type="button"
          disabled={!canRoll}
          onClick={handleRoll}
          className="flex-1 h-9 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-amber-950"
        >
          Roll
        </button>
      </div>
    </div>
  );
}
