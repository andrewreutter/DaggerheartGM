import { splitDisplayNameForSheetParen } from './sheet-display-names.js';

/**
 * @param {{ primary: string, parenthetical: string | null, primaryClassName?: string, parenClassName?: string }} props
 */
export function SheetDisplayLabelInline({ primary, parenthetical, primaryClassName = '', parenClassName }) {
  const parenCls =
    parenClassName ?? 'text-[9px] font-normal text-dh-muted leading-snug shrink-0';
  if (parenthetical == null) {
    return <span className={primaryClassName}>{primary}</span>;
  }
  return (
    <span className="min-w-0 inline-flex flex-wrap items-baseline gap-x-0.5 gap-y-0">
      <span className={primaryClassName}>{primary}</span>
      <span className={parenCls}>{` (${parenthetical})`}</span>
    </span>
  );
}

/**
 * Dice banner title line: optional smaller parenthetical original after `attackerName` prefix.
 * @param {{ displayName: string, attackerName?: string|null, targetSuffix?: string }} props
 */
export function BannerSheetDisplayNameLine({ displayName, attackerName, targetSuffix = '' }) {
  const split = splitDisplayNameForSheetParen(displayName, attackerName);
  if (split.parenthetical == null) {
    return (
      <>
        {displayName}
        {targetSuffix}
      </>
    );
  }
  return (
    <>
      {split.base}
      <span className="text-[8px] font-medium normal-case opacity-75 tracking-normal">{` (${split.parenthetical})`}</span>
      {split.suffix}
      {targetSuffix}
    </>
  );
}
