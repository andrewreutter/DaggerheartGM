/**
 * Build the Game Table "Joined" roster: invited emails merged with live presence.
 * Display name prefers the Online (presence) name, then a cached name seen in a
 * prior presence snapshot (nameCache), falling back to the invited email.
 *
 * @param {string[]} playerEmails
 * @param {{ uid?: string, email?: string, name?: string }[]} connectedPlayers
 * @param {Record<string, string>} [nameCache] - accumulated email-keyed (lowercase) → display name
 * @returns {{ email: string, name: string, online: boolean, uid?: string }[]}
 */
export function buildJoinedPlayerRoster(playerEmails = [], connectedPlayers = [], nameCache = {}) {
  const connectedByEmail = new Map();
  for (const p of connectedPlayers) {
    const key = typeof p?.email === 'string' ? p.email.trim().toLowerCase() : '';
    if (!key) continue;
    connectedByEmail.set(key, p);
  }

  const resolveName = (email, connected) => {
    if (connected?.name && String(connected.name).trim()) return String(connected.name).trim();
    const cached = nameCache[email.toLowerCase()];
    if (cached && String(cached).trim()) return String(cached).trim();
    return email;
  };

  const seen = new Set();
  const rows = [];

  for (const raw of playerEmails) {
    if (typeof raw !== 'string') continue;
    const email = raw.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const connected = connectedByEmail.get(key);
    rows.push({
      email,
      name: resolveName(email, connected),
      online: !!connected,
      uid: connected?.uid,
    });
  }

  // Presence-only edges (should be rare once invite redeem is the join path).
  for (const p of connectedPlayers) {
    const email = typeof p?.email === 'string' ? p.email.trim() : '';
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      email,
      name: resolveName(email, p),
      online: true,
      uid: p.uid,
    });
  }

  return rows;
}

/**
 * Merge newly-seen presence names into an existing cache object (mutates in place).
 * Only records names that are meaningfully different from the raw email address.
 *
 * @param {Record<string, string>} cache
 * @param {{ email?: string, name?: string }[]} connectedPlayers
 */
export function mergePresenceNamesIntoCache(cache, connectedPlayers = []) {
  for (const p of connectedPlayers) {
    const email = typeof p?.email === 'string' ? p.email.trim() : '';
    const name = typeof p?.name === 'string' ? p.name.trim() : '';
    if (!email || !name || name.toLowerCase() === email.toLowerCase()) continue;
    cache[email.toLowerCase()] = name;
  }
}
