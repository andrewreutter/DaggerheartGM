/**
 * Layout constraints for the Game Table 3D dice canvas vs. result-banner strip.
 *
 * The dice "floor" is the bottom edge of the canvas container. Banners sit
 * {@link BANNER_STRIP_BOTTOM} above the overlay bottom and grow upward.
 * To keep settled dice from landing behind banners:
 * 1. Each banner card is hard-capped at {@link BANNER_MAX_HEIGHT} and scrolls internally.
 * 2. The canvas bottom inset is always banner max height + strip offset — not a disconnected guess.
 */

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
