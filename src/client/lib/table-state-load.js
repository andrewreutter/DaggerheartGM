/**
 * GET table_state must wait until Firebase auth has settled. An anonymous
 * request against a private owned table 403s; if that result sticks, reload
 * shows "Private table" even after the session restores.
 */

export function shouldFetchTableState({ view, tableId, authSettled }) {
  return view === 'table' && Boolean(tableId) && authSettled === true;
}

/**
 * @returns {null | 'private' | 'not-found' | undefined} `undefined` means leave the previous error unchanged.
 */
export function tableAccessErrorAfterFetch({ ok, httpStatus }) {
  if (ok) return null;
  if (httpStatus === 403) return 'private';
  if (httpStatus === 404) return 'not-found';
  return undefined;
}
