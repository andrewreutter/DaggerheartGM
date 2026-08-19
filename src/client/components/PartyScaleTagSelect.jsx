import { normalizeMinPartySize, partyScaleOptions } from '../lib/party-scaled-adversaries.js';

const OPTIONS = partyScaleOptions();

/**
 * Compact Always / 2+ players / … / 8+ players present-at control.
 */
export function PartyScaleTagSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  title = 'Present when the party has this many characters',
}) {
  const current = normalizeMinPartySize(value);
  return (
    <select
      value={current}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange?.(Number(e.target.value));
      }}
      className={`h-5 max-w-[6.75rem] shrink-0 rounded border border-dh-border bg-dh-raised px-0.5 text-[10px] font-semibold tabular-nums text-dh-muted hover:text-dh disabled:opacity-50 ${className}`}
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
