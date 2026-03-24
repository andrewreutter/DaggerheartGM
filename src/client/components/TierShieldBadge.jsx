import { ArrowUpRight } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';

/**
 * Hex shield + tier digit — same visual as adversary `ItemCard` header.
 *
 * @param {number|string|null|undefined} props.tier
 * @param {number|null|undefined} [props.scaledFromTier] — when set, an up-right arrow at the top-right marks a scaled-up adversary
 * @param {'sm'|'md'} [props.size]
 * @param {string} [props.className]
 */
export function TierShieldBadge({ tier, scaledFromTier, size = 'sm', className = '' }) {
  const t = tier ?? '?';
  const box = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const font = size === 'md' ? 'text-[11px] mt-0.5' : 'text-[10px] mt-0.5';
  const tierLabel = `Tier ${t}`;
  const label =
    scaledFromTier != null
      ? `${tierLabel} · Scaled from tier ${scaledFromTier}`
      : tierLabel;
  // Large enough that the stroke runs from the top-right corner toward the tier digit (~20px / ~24px shields).
  const arrowSize = size === 'md' ? 17 : 14;
  return (
    <Tooltip label={label} className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`relative inline-flex items-center justify-center ${box}`}
        aria-label={label}
      >
        <svg viewBox="0 0 20 22" className="absolute inset-0 z-0 h-full w-full" fill="none" aria-hidden>
          <path
            d="M10 1L19 5v7c0 5-4 8-9 9C5 20 1 17 1 12V5l9-4z"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1.5"
          />
        </svg>
        {scaledFromTier != null && (
          <span
            className="pointer-events-none absolute -right-px -top-px z-[1] text-amber-400 drop-shadow-[0_0_2px_rgba(0,0,0,0.85)]"
            aria-hidden
          >
            <ArrowUpRight size={arrowSize} strokeWidth={2.5} className="block" style={{ position: 'relative', top: `${arrowSize}px`, left: `-${arrowSize}px` }} />
          </span>
        )}
        <span className={`relative z-[2] font-bold leading-none text-slate-200 ${font}`}>{t}</span>
      </span>
    </Tooltip>
  );
}
