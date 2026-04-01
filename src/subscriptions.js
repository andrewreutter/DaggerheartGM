/**
 * Postgres LISTEN/NOTIFY-backed subscription manager.
 *
 * Maintains a dedicated pg.Client that LISTENs on Postgres notification channels.
 * When a change is detected (either from Postgres NOTIFY or from a direct
 * notifyChange() call), it re-queries the current authoritative state and pushes
 * a full snapshot to all subscribed SSE response objects.
 *
 * Usage:
 *   import subscriptionManager from './subscriptions.js';
 *
 *   // On SSE connect:
 *   subscriptionManager.subscribe('banners', gmUid, res);
 *   // On SSE disconnect:
 *   subscriptionManager.unsubscribe('banners', gmUid, res);
 *   // After any mutation (fast path — avoids NOTIFY round-trip):
 *   subscriptionManager.notifyChange('banners', gmUid);
 */

import pg from 'pg';
import { getPendingBanners, getResolvedTableState } from './db.js';
import { redactTableStateForPlayerAudience } from './client/lib/session-countdowns.js';

const { Client } = pg;

/** @type {WeakMap<import('http').ServerResponse, 'gm' | 'player'>} */
const tableStateAudienceByResponse = new WeakMap();

const DEBOUNCE_MS = 50;

/** Channel definitions: each maps a channel name to a query function. */
const CHANNEL_QUERIES = {
  banners: (appId, key) => getPendingBanners(appId, key),
  table_state: (appId, key) => getResolvedTableState(appId, key),
};

/** Maps a Postgres NOTIFY channel to the subscription channel name. */
const NOTIFY_TO_CHANNEL = {
  dice_rolls_changed: 'banners',
  table_state_changed: 'table_state',
};

class SubscriptionManager {
  constructor() {
    /** Map<channelName, Map<key, Set<res>>> */
    this._subs = new Map();
    /** Map<`${channel}:${key}`, timeoutId> — pending debounce timers */
    this._pending = new Map();
    this._client = null;
    this._appId = null;
    this._reconnectTimer = null;
    this._shuttingDown = false;
  }

  /** Call once at server startup if DATABASE_URL is configured. */
  async init(appId) {
    this._appId = appId;
    if (!process.env.DATABASE_URL) return;
    await this._connect();
  }

  async _connect() {
    if (this._shuttingDown) return;
    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();

      client.on('notification', (msg) => {
        const channelName = NOTIFY_TO_CHANNEL[msg.channel];
        if (!channelName) return;
        try {
          const payload = JSON.parse(msg.payload || '{}');
          // table_state_changed sends table_id; dice_rolls_changed sends gm_uid (banners key)
          const key = payload.table_id ?? payload.gm_uid;
          if (key) this.notifyChange(channelName, key);
        } catch {
          // malformed payload — ignore
        }
      });

      client.on('error', (err) => {
        console.error('[subscriptions] pg client error:', err.message);
        this._scheduleReconnect();
      });

      client.on('end', () => {
        if (!this._shuttingDown) {
          console.warn('[subscriptions] pg client disconnected, reconnecting...');
          this._scheduleReconnect();
        }
      });

      for (const notifyChannel of Object.keys(NOTIFY_TO_CHANNEL)) {
        await client.query(`LISTEN ${notifyChannel}`);
      }

      this._client = client;
      console.log('[subscriptions] LISTEN client connected');
    } catch (err) {
      console.error('[subscriptions] failed to connect LISTEN client:', err.message);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    this._client = null;
    if (this._reconnectTimer || this._shuttingDown) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, 5000);
  }

  /**
   * Subscribe an SSE response object to a channel.
   * Immediately pushes the current snapshot so the client doesn't miss initial state.
   * @param {{ tableStateAudience?: 'gm' | 'player' }} [meta] — for `table_state`, controls GM-only redaction (countdowns + encounter notes)
   */
  subscribe(channelName, key, res, meta = {}) {
    if (meta.tableStateAudience === 'player') {
      tableStateAudienceByResponse.set(res, 'player');
    } else if (meta.tableStateAudience === 'gm') {
      tableStateAudienceByResponse.set(res, 'gm');
    }
    if (!this._subs.has(channelName)) this._subs.set(channelName, new Map());
    const keyMap = this._subs.get(channelName);
    if (!keyMap.has(key)) keyMap.set(key, new Set());
    keyMap.get(key).add(res);

    // Push initial snapshot immediately
    this._pushSnapshot(channelName, key, [res]);
  }

  /**
   * Send a one-off SSE event to all subscribers of `banners` for this gmUid key
   * (e.g. roll-log-append for acknowledged-only action rows that skip the pending banner queue).
   * @param {string} key — gmUid (same key as banners subscription)
   * @param {string} eventName — SSE event name (not `banners`)
   * @param {unknown} data — JSON-serializable payload
   */
  broadcastBannersChannelEvent(key, eventName, data) {
    const keyMap = this._subs.get('banners');
    if (!keyMap) return;
    const resSet = keyMap.get(key);
    if (!resSet || resSet.size === 0) return;
    let body;
    try {
      body = JSON.stringify(data);
    } catch {
      return;
    }
    const msg = `event: ${eventName}\ndata: ${body}\n\n`;
    for (const res of resSet) {
      try {
        if (res.writableEnded) continue;
        res.write(msg);
        res.flush?.();
      } catch {
        /* ignore */
      }
    }
  }

  /** Unsubscribe an SSE response object from a channel. */
  unsubscribe(channelName, key, res) {
    const keyMap = this._subs.get(channelName);
    if (!keyMap) return;
    const resSet = keyMap.get(key);
    if (!resSet) return;
    resSet.delete(res);
    if (resSet.size === 0) keyMap.delete(key);
  }

  /**
   * Signal that data for a channel+key has changed.
   * Debounces rapid changes and re-queries once before pushing.
   * Called both by the Postgres NOTIFY handler and directly by mutation code (fast path).
   */
  notifyChange(channelName, key) {
    const debounceKey = `${channelName}:${key}`;
    if (this._pending.has(debounceKey)) clearTimeout(this._pending.get(debounceKey));
    const timer = setTimeout(() => {
      this._pending.delete(debounceKey);
      const keyMap = this._subs.get(channelName);
      if (!keyMap) return;
      const resSet = keyMap.get(key);
      if (!resSet || resSet.size === 0) return;
      this._pushSnapshot(channelName, key, [...resSet]);
    }, DEBOUNCE_MS);
    this._pending.set(debounceKey, timer);
  }

  async _pushSnapshot(channelName, key, responses) {
    if (!this._appId || responses.length === 0) return;
    const queryFn = CHANNEL_QUERIES[channelName];
    if (!queryFn) return;

    let snapshot;
    try {
      snapshot = await queryFn(this._appId, key);
    } catch (err) {
      console.error(`[subscriptions] query failed for ${channelName}:${key}:`, err.message);
      return;
    }

    for (const res of responses) {
      try {
        if (res.writableEnded) continue;
        let data = snapshot;
        if (channelName === 'table_state' && tableStateAudienceByResponse.get(res) === 'player') {
          data = redactTableStateForPlayerAudience(snapshot);
        }
        const payload = `event: ${channelName}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(payload);
        res.flush?.();
      } catch {
        // Client already disconnected — will be cleaned up on 'close'
      }
    }
  }

  async shutdown() {
    this._shuttingDown = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    for (const timer of this._pending.values()) clearTimeout(timer);
    if (this._client) {
      try { await this._client.end(); } catch { /* ignore */ }
    }
  }
}

export default new SubscriptionManager();
