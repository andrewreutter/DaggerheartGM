import { Children } from 'react';

/**
 * Flex-wrap shell for action chip rows. Children stay in source order.
 */
export function WidthSortedFlexWrap({ children, className = '' }) {
  const childArray = Children.toArray(children).filter(Boolean);
  if (childArray.length === 0) return null;
  return <div className={className}>{childArray}</div>;
}
