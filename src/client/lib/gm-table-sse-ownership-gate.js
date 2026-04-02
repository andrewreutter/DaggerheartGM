/**
 * GM SSE + postTableOp only when the signed-in user owns the `table_state` row.
 * Before `loadTableState`, `tableOwnerUid` is `undefined` — for `/table/<uuid>` where uuid ≠ user.uid,
 * skip until owner hydrates so invitees do not hit `POST /api/room/my/op` (403).
 *
 * @param {{ routeTableId: string, userUid: string, tableOwnerUid: string|null|undefined }} args
 */
export function shouldStartGmTableRoomEffects({ routeTableId, userUid, tableOwnerUid }) {
  if (!userUid || !routeTableId) return false;
  if (tableOwnerUid === userUid) return true;
  if (routeTableId === userUid) return true;
  if (tableOwnerUid === undefined) return false;
  return false;
}
