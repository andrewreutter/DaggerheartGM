/**
 * Primary banner button copy: Dismiss when Cancel is hidden (ack is the only
 * way out); Apply when Cancel is a real alternative.
 *
 * @param {{ showCancel?: boolean, blockedLabel?: string | null }} [opts]
 * @returns {string}
 */
export function bannerPrimaryActionLabel(opts = {}) {
  const blocked = typeof opts.blockedLabel === 'string' ? opts.blockedLabel.trim() : '';
  if (blocked) return blocked;
  return opts.showCancel ? 'Apply' : 'Dismiss';
}
