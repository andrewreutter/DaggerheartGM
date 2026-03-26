import { Tooltip } from './Tooltip.jsx';

/**
 * Circular level badge — library chrome for spell / ability level (distinct from tier hex shield).
 *
 * @param {number|string|null|undefined} props.level
 * @param {'sm'|'md'} [props.size]
 * @param {string} [props.className]
 */
export function LevelBadge({ level, size = 'sm', className = '' }) {
  const L = level ?? '?';
  const box = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const font = size === 'md' ? 'text-[11px]' : 'text-[10px]';
  const label = `Level ${L}`;
  return (
    <Tooltip label={label} className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`relative inline-flex items-center justify-center rounded-full ${box} border-[1.5px] border-dh-level-badge-border bg-dh-level-badge-bg shadow-[inset_0_0_0_1px_rgba(167,139,250,0.18)]`}
        aria-label={label}
      >
        <span
          className={`relative z-[1] font-bold leading-none text-dh-level-badge-text -translate-y-[1px] ${font}`}
        >
          {L}
        </span>
      </span>
    </Tooltip>
  );
}
