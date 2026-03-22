import { postRoll as apiPostRoll } from './api.js';

/**
 * Build the standard context.system subdocument for feature hooks.
 * Use when the view has tableId and a way to add action banners (e.g. diceRollerRef).
 *
 * @param {string | null} tableId - Table id for roll route (null = GM roll).
 * @param {(roll: object) => void} addRoll - Callback to add a roll/banner (e.g. (n) => diceRollerRef.current?.addRoll(n)).
 * @returns {{ postRoll: (text: string, displayName: string, rollMeta?: object) => Promise<object>, postRollSilent: (text: string, displayName: string) => Promise<object>, addActionBanner: (notification: object) => void }}
 */
export function buildSystemContext(tableId, addRoll) {
  return {
    postRoll(rollText, displayName, rollMeta = {}) {
      return apiPostRoll(rollText, displayName, tableId, rollMeta);
    },
    postRollSilent(rollText, displayName) {
      return apiPostRoll(rollText, displayName, tableId, { silent: true });
    },
    addActionBanner: addRoll,
  };
}
