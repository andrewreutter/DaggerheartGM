/**
 * Layout constraints for the Game Table 3D dice canvas vs. result-banner strip.
 *
 * The dice "floor" is the bottom edge of the canvas container. Banners sit
 * {@link BANNER_STRIP_BOTTOM} above the overlay bottom and grow upward.
 * The strip is {@link BANNER_STRIP_FLEX_DIRECTION} `row-reverse`: the oldest
 * banner anchors at the bottom-right of the map and newer banners stack left.
 * To keep settled dice from landing behind banners:
 * 1. Each banner card is hard-capped at {@link BANNER_MAX_HEIGHT} and scrolls internally.
 * 2. The canvas bottom inset is always banner max height + strip offset — not a disconnected guess.
 */

/** Flex direction so the first (oldest) banner sits on the right. */
export const BANNER_STRIP_FLEX_DIRECTION = 'row-reverse';

/** Distance from the overlay bottom to the banner strip. */
export const BANNER_STRIP_BOTTOM = '2.5rem';

/**
 * Hard ceiling on each result / action / rest banner card.
 * `25rem` (= 400px at a 16px root) matches `50vh` on an 800px-tall viewport;
 * the `min()` picks whichever is smaller so short viewports stay usable.
 * Overflow content (rest-move columns, stacked V2 review chips) scrolls inside the card.
 */
export const BANNER_MAX_HEIGHT = 'min(25rem, 50vh)';

/**
 * CSS `bottom` for the 3D dice canvas — derived from the two values above so
 * the physics floor sits at the top of the reserved banner zone.
 */
export const DICE_BOTTOM_RESERVE = `calc(${BANNER_MAX_HEIGHT} + ${BANNER_STRIP_BOTTOM})`;

/** Applied to the rounded inner card of RestBanner / ActionBanner / ResultBanner. */
export const BANNER_CARD_SCROLL_STYLE = {
  maxHeight: BANNER_MAX_HEIGHT,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
};

/** Extra gap between the strip and each token tray. */
const BANNER_STRIP_TRAY_GAP_PX = 16;

/**
 * Absolute layout for the pending-banner strip. `leftOffset` / `rightOffset`
 * keep the strip off the character / adversary trays so the oldest banner sits
 * on the map, not over a tray.
 */
export function bannerStripStyle({ leftOffset = 0, rightOffset = 0 } = {}) {
  return {
    position: 'absolute',
    bottom: BANNER_STRIP_BOTTOM,
    left: leftOffset,
    right: rightOffset,
    marginLeft: BANNER_STRIP_TRAY_GAP_PX,
    marginRight: BANNER_STRIP_TRAY_GAP_PX,
    display: 'flex',
    flexDirection: BANNER_STRIP_FLEX_DIRECTION,
    alignItems: 'flex-end',
    gap: '0.5rem',
    padding: '0 0.75rem',
    overflow: 'hidden',
    pointerEvents: 'auto',
  };
}
