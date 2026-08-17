import { isOwnItem } from './constants.js';

/**
 * Whether Add-to-Table should auto-clone a non-own item into the user's library
 * before placing it on the table.
 *
 * Scenes are flat `table_state` snapshots with value semantics — placing one
 * deep-clones the snapshot onto the table (`add-scene-snapshot`). A user-owned
 * `items` row is not needed. Other collections (adversaries, environments)
 * still clone-on-play when the item is not already owned.
 *
 * @param {string} collectionName
 * @param {object} [item]
 * @returns {boolean}
 */
export function shouldCloneOnAddToTable(collectionName, item) {
  if (collectionName === 'scenes') return false;
  if (collectionName === 'adversaries' || collectionName === 'environments' || collectionName === 'maps') {
    return !isOwnItem(item);
  }
  return false;
}
