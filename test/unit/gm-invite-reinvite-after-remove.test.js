/**
 * Regression: remove accepted player then re-invite to pending.
 * GMTableView skips posting if email still appears in accepted list; without optimistic
 * invite-list state in app.jsx, UI can stay stale until SSE and block the re-invite.
 */
import { describe, it, expect } from 'vitest';

function normInvEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function emailOnInviteList(email, list) {
  return (list || []).some((x) => normInvEmail(x) === normInvEmail(email));
}

/** Mirrors GMTableView add-pending branch (functional update input = app invite state). */
function tryAddPendingInvite(prev, em) {
  if (emailOnInviteList(em, prev.playerEmails) || emailOnInviteList(em, prev.pendingPlayerEmails)) {
    return prev;
  }
  return {
    playerEmails: prev.playerEmails,
    pendingPlayerEmails: [...(prev.pendingPlayerEmails || []), em],
  };
}

describe('GM re-invite after remove (dedupe vs stale accepted list)', () => {
  it('does not add pending when accepted list still contains email (stale until SSE)', () => {
    const stale = { playerEmails: ['pat@example.com'], pendingPlayerEmails: [] };
    const out = tryAddPendingInvite(stale, 'pat@example.com');
    expect(out).toBe(stale);
    expect(out.pendingPlayerEmails).toHaveLength(0);
  });

  it('adds pending when accepted list no longer contains email', () => {
    const fresh = { playerEmails: [], pendingPlayerEmails: [] };
    const out = tryAddPendingInvite(fresh, 'pat@example.com');
    expect(out.pendingPlayerEmails).toEqual(['pat@example.com']);
  });
});
