import {
  DIFFICULTY_BANDS,
  DIFFICULTY_LABEL_WIDTH_WORD,
  DIFFICULTY_SLIDER_MAX,
  DIFFICULTY_SLIDER_MIN,
  difficultyLabelLines,
  difficultySliderTrackInsetCss,
} from '../lib/helpers.js';

const DIFFICULTY_BAND_GRID_CLASS = 'grid grid-cols-6 gap-0.5';

function DifficultyBandTickRow({ className, style }) {
  return (
    <div
      className={`pointer-events-none ${DIFFICULTY_BAND_GRID_CLASS} ${className || ''}`}
      style={style}
      aria-hidden="true"
    >
      {DIFFICULTY_BANDS.map((band) => (
        <span key={band.value} className="flex justify-center">
          <span className="w-px h-full bg-dh-muted/70" />
        </span>
      ))}
    </div>
  );
}

/**
 * SRD 5–30 difficulty range with named-band ticks, snap buttons, and DC label.
 * Pre-roll keeps `id="intent-difficulty"` so Playwright helpers still match.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {number|string} props.value
 * @param {(next: number) => void} [props.onChange]
 * @param {boolean} [props.disabled]
 * @param {string} [props.label]
 * @param {string} [props.labelClassName]
 * @param {string} [props.className]
 * @param {string} [props.testIdPrefix]
 * @param {string} [props.ariaLabel]
 * @param {import('react').ReactNode} [props.trailing]
 */
export function DifficultySlider({
  id,
  value,
  onChange,
  disabled = false,
  label = 'Difficulty',
  labelClassName = 'text-[11px] font-semibold text-dh',
  className = 'w-full flex flex-col gap-1',
  testIdPrefix = 'difficulty',
  ariaLabel = 'Difficulty (DC 5–30)',
  trailing = null,
}) {
  const sliderTrackInset = difficultySliderTrackInsetCss();
  const numeric = Number(value);

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      <div className="flex items-start gap-2 w-full">
        <div className="flex-1 min-w-0 relative">
          <div className="relative">
            <DifficultyBandTickRow className="absolute left-0 right-0 bottom-full h-1" />
            <div style={{ paddingLeft: sliderTrackInset, paddingRight: sliderTrackInset }}>
              <input
                id={id}
                type="range"
                min={DIFFICULTY_SLIDER_MIN}
                max={DIFFICULTY_SLIDER_MAX}
                step={1}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange?.(Number(e.target.value))}
                className={`relative z-10 w-full h-2 rounded-full appearance-none bg-gradient-to-r from-slate-600 to-slate-900 accent-sky-500 disabled:opacity-100 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                aria-label={ariaLabel}
              />
            </div>
            <DifficultyBandTickRow className="absolute left-0 right-0 top-full h-1" />
          </div>
          <div className={`${DIFFICULTY_BAND_GRID_CLASS} mt-1`}>
            {DIFFICULTY_BANDS.map((band) => {
              const selected = numeric === band.value;
              return (
                <button
                  key={band.value}
                  type="button"
                  data-testid={`${testIdPrefix}-band-${band.value}`}
                  disabled={disabled}
                  title={`${band.label} (DC ${band.value})`}
                  aria-label={`${band.label} (DC ${band.value})`}
                  aria-pressed={selected}
                  onClick={() => {
                    if (disabled) return;
                    onChange?.(band.value);
                  }}
                  className={`px-0.5 py-0.5 rounded text-[8px] font-semibold leading-tight border truncate disabled:opacity-100 ${
                    selected
                      ? 'border-sky-500 bg-sky-900/60 text-sky-100'
                      : 'border-dh-strong bg-dh-raised text-dh-muted'
                  } ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-dh-hover hover:text-dh'}`}
                >
                  {band.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0 pt-px">
          <span
            data-testid={`${testIdPrefix}-value`}
            className="text-sm font-bold tabular-nums text-dh leading-none"
            aria-live="polite"
          >
            {value}
          </span>
          <span className="relative grid text-[8px] leading-tight text-dh-muted text-center mt-0.5">
            <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">
              {DIFFICULTY_LABEL_WIDTH_WORD}
            </span>
            <span className="col-start-1 row-start-1" data-testid={`${testIdPrefix}-label`}>
              {difficultyLabelLines(value).map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </span>
          </span>
        </div>
        {trailing}
      </div>
    </div>
  );
}
