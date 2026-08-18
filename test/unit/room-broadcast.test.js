import { describe, it, expect } from 'vitest';
import {
  createEmptyRoom,
  buildPresencePayload,
  buildAudienceAttendees,
  forEachRoomSseClient,
} from '../../src/server/room-broadcast.js';

describe('room audience vs joined', () => {
  it('presence lists invited players separately from audienceOnlineCount', () => {
    const room = createEmptyRoom();
    room.players.set('u1', { res: {}, name: 'Ada', email: 'ada@example.com', photoURL: '' });
    room.audience.set('guest-1', { res: {}, displayName: 'Guest' });
    room.audience.set('guest-2', { res: {}, displayName: 'Sam' });
    const payload = buildPresencePayload(room);
    expect(payload.players).toEqual([
      { uid: 'u1', name: 'Ada', email: 'ada@example.com', photoURL: '' },
    ]);
    expect(payload.audienceOnlineCount).toBe(2);
  });

  it('audience attendees expose display names only (no emails)', () => {
    const room = createEmptyRoom();
    room.audience.set('s1', { displayName: 'Jordan', email: 'hidden@example.com' });
    room.audience.set('s2', { displayName: '' });
    const { attendees } = buildAudienceAttendees(room);
    expect(attendees).toEqual([{ displayName: 'Jordan' }, { displayName: 'Guest' }]);
    expect(JSON.stringify(attendees)).not.toMatch(/@/);
  });

  it('forEachRoomSseClient writes to gm, players, and audience', () => {
    const room = createEmptyRoom();
    const seen = [];
    const gm = { writableEnded: false };
    const pRes = { writableEnded: false };
    const aRes = { writableEnded: false };
    room.gmClients.add(gm);
    room.players.set('u1', { res: pRes });
    room.audience.set('g1', { res: aRes });
    forEachRoomSseClient(room, (res) => seen.push(res));
    expect(seen).toEqual([gm, pRes, aRes]);
  });
});

describe('createEmptyRoom', () => {
  it('starts with empty audience', () => {
    const room = createEmptyRoom();
    expect(room.audience.size).toBe(0);
    expect(room.players.size).toBe(0);
    expect(room.gmClients.size).toBe(0);
  });
});
