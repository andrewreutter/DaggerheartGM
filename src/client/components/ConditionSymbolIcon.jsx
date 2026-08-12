/**
 * Circular glyph used on tokens and as the left-hand icon in condition chips.
 * @param {{ symbol: string, size?: number, className?: string }} props
 */
export function ConditionSymbolIcon({ symbol, size = 14, className = '' }) {
  const px = Math.max(10, Math.round(size));
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 font-bold leading-none select-none ${className}`}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(7, Math.round(px * 0.72)),
        background: 'rgba(15,15,20,0.92)',
        color: '#f8fafc',
        border: '1px solid rgba(255,255,255,0.5)',
      }}
      aria-hidden="true"
    >
      {symbol}
    </span>
  );
}
