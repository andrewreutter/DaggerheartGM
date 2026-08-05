import { Link2, Unlink2, Minus, Plus } from 'lucide-react';
import {
  TOKEN_SIZE_MIN,
  TOKEN_SIZE_MAX,
  TOKEN_SIZE_STEP,
  getTokenSizeMultipliers,
  buildTokenSizeUpdate,
  buildTokenSizeLinkToggleUpdate,
} from '../../lib/token-size.js';

function AxisStepper({ label, value, onChange }) {
  const dec = () => onChange(Math.max(TOKEN_SIZE_MIN, value - TOKEN_SIZE_STEP));
  const inc = () => onChange(Math.min(TOKEN_SIZE_MAX, value + TOKEN_SIZE_STEP));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-dh-muted w-12 shrink-0">{label}</span>
      <button
        type="button"
        onClick={dec}
        disabled={value <= TOKEN_SIZE_MIN}
        className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-dh-border bg-dh-raised text-dh hover:bg-dh-inset disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Decrease ${label}`}
      >
        <Minus size={12} />
      </button>
      <span className="w-12 text-center text-sm text-dh tabular-nums">{value.toFixed(1)}x</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= TOKEN_SIZE_MAX}
        className="w-6 h-6 shrink-0 flex items-center justify-center rounded border border-dh-border bg-dh-raised text-dh hover:bg-dh-inset disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Increase ${label}`}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

/**
 * Width/Length steppers + link toggle for a library record's battle-map token footprint.
 * Backed by `token-size.js` helpers; used by CharacterForm, AdversaryForm, and the
 * declarative `sizeMultiplierPair` schema type (Beastbound companion).
 *
 * @param {{ tokenSizeWidth?: number, tokenSizeLength?: number, tokenSizeLinked?: boolean }} value
 * @param {(patch: object) => void} onChange
 */
export function TokenSizeFields({ value, onChange }) {
  const { width, length, linked } = getTokenSizeMultipliers(value);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AxisStepper
        label="Width"
        value={width}
        onChange={(v) => onChange(buildTokenSizeUpdate(value, { axis: 'width', value: v }))}
      />
      <button
        type="button"
        onClick={() => onChange(buildTokenSizeLinkToggleUpdate(value, !linked))}
        className={`w-6 h-6 shrink-0 flex items-center justify-center rounded border transition-colors ${
          linked
            ? 'border-sky-700 bg-sky-900/60 text-sky-300 hover:bg-sky-800'
            : 'border-dh-border bg-dh-raised text-dh-muted hover:bg-dh-inset'
        }`}
        title={linked ? 'Width and Length are linked — click to unlink' : 'Width and Length are independent — click to link'}
        aria-label={linked ? 'Unlink width and length' : 'Link width and length'}
      >
        {linked ? <Link2 size={12} /> : <Unlink2 size={12} />}
      </button>
      <AxisStepper
        label="Length"
        value={length}
        onChange={(v) => onChange(buildTokenSizeUpdate(value, { axis: 'length', value: v }))}
      />
      {(width !== 1 || length !== 1) && (
        <span className="text-[10px] text-dh-muted">Standard token is 1x/1x (5'x5')</span>
      )}
    </div>
  );
}
