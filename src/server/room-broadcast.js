/**
 * In-memory Game Table SSE room helpers (GM clients, invited players, spectators).
 */

export function createEmptyRoom() {
  return { players: new Map(), gmClients: new Set(), audience: new Map() };
}

export function ensureRoomAudience(room) {
  if (!room.audience) room.audience = new Map();
  return room;
}

/**
 * @param {object} room
 * @returns {{ players: Array<{ uid: string, name: string, email: string, photoURL: string }>, audienceOnlineCount: number }}
 */
export function buildPresencePayload(room) {
  const r = ensureRoomAudience(room);
  const players = [...r.players.entries()].map(([uid, p]) => ({
    uid,
    name: p.name,
    email: p.email,
    photoURL: p.photoURL,
  }));
  return { players, audienceOnlineCount: r.audience.size };
}

/**
 * Audience list for GET /api/room/:tableId/audience — names only, no emails.
 * @param {object} room
 * @returns {{ attendees: Array<{ displayName: string }> }}
 */
export function buildAudienceAttendees(room) {
  const r = ensureRoomAudience(room);
  const attendees = [...r.audience.values()].map((a) => ({
    displayName: (a?.displayName && String(a.displayName).trim()) || 'Guest',
  }));
  return { attendees };
}

/**
 * Write an SSE event string to GM, invited players, and spectators.
 * @param {object} room
 * @param {(res: import('http').ServerResponse) => void} fn
 */
export function forEachRoomSseClient(room, fn) {
  if (!room) return;
  for (const clientRes of room.gmClients || []) {
    try {
      if (clientRes && !clientRes.writableEnded) fn(clientRes);
    } catch { /* ignore */ }
  }
  for (const [, p] of room.players || []) {
    try {
      if (p?.res && !p.res.writableEnded) fn(p.res);
    } catch { /* ignore */ }
  }
  for (const [, a] of room.audience || []) {
    try {
      if (a?.res && !a.res.writableEnded) fn(a.res);
    } catch { /* ignore */ }
  }
}
