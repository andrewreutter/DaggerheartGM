/**
 * Whether dismissing a banner should clear the 3D dice canvas.
 * Exported for unit tests (mirrors DiceRoller.dismissBannerById).
 */
export function shouldClearDiceCanvasOnBannerDismiss({
  animatingBannerId,
  dismissedBannerId,
  dismissedResolved,
}) {
  if (animatingBannerId === dismissedBannerId) return true;
  // After animation completes, animatingBannerId is null but dice stay on the felt until the next roll.
  if (dismissedResolved && animatingBannerId == null) return true;
  return false;
}
