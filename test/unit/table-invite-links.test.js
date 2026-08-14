/**
 * Table invite-link helpers (`src/db.js`) and migration 040.
 *
 * Token-format tests run everywhere. DB-backed revoke/redeem semantics run
 * only when DATABASE_URL is set (skipped in CI without Postgres — same
 * pattern as test/unit/migration-038-character-dedup.test.js).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateTableInviteToken } from '../../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../migrations/040_table_invite_links.sql'),
  'utf8',
);

describe('generateTableInviteToken', () => {
  it('returns a base64url token from 20 random bytes', () => {
    const token = generateTableInviteToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(27);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toMatch(/[+/=]/);
    const other = generateTableInviteToken();
    expect(other).not.toBe(token);
  });
});

describe('migration 040 SQL content', () => {
  it('creates table_invite_links with PK and one-active-per-table unique index', () => {
    expect(MIGRATION_SQL).toMatch(/CREATE TABLE IF NOT EXISTS table_invite_links/i);
    expect(MIGRATION_SQL).toMatch(/PRIMARY KEY \(app_id, token\)/i);
    expect(MIGRATION_SQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS table_invite_links_active_table_idx/i);
    expect(MIGRATION_SQL).toMatch(/WHERE revoked_at IS NULL/i);
    expect(MIGRATION_SQL).toMatch(/CREATE INDEX IF NOT EXISTS table_invite_links_table_idx/i);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('LIVE Postgres: table invite link helpers', () => {
  let createTableInviteLink;
  let revokeTableInviteLink;
  let getActiveTableInviteLink;
  let redeemTableInviteLink;
  let deleteTableInviteLinksForTable;
  const appId = `test-invite-links-${Date.now()}`;
  const tableId = `${appId}-table`;

  beforeAll(async () => {
    ({
      createTableInviteLink,
      revokeTableInviteLink,
      getActiveTableInviteLink,
      redeemTableInviteLink,
      deleteTableInviteLinksForTable,
    } = await import('../../src/db.js'));
    const { getPool } = await import('../../src/db.js');
    await getPool().query(MIGRATION_SQL);
  });

  afterAll(async () => {
    if (deleteTableInviteLinksForTable) {
      await deleteTableInviteLinksForTable(appId, tableId);
    }
  });

  it('generating a link twice revokes the first; only one active row remains', async () => {
    const first = await createTableInviteLink(appId, tableId, 'gm-uid');
    expect(first.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.createdAt).toBeTruthy();

    const second = await createTableInviteLink(appId, tableId, 'gm-uid');
    expect(second.token).not.toBe(first.token);

    const active = await getActiveTableInviteLink(appId, tableId);
    expect(active).not.toBeNull();
    expect(active.token).toBe(second.token);

    expect(await redeemTableInviteLink(appId, first.token)).toBeNull();
    expect(await redeemTableInviteLink(appId, second.token)).toEqual({ tableId });
  });

  it('redeeming a revoked token returns null', async () => {
    const created = await createTableInviteLink(appId, tableId, 'gm-uid');
    await revokeTableInviteLink(appId, tableId);
    expect(await redeemTableInviteLink(appId, created.token)).toBeNull();
    expect(await getActiveTableInviteLink(appId, tableId)).toBeNull();
  });

  it('redeeming an unknown token returns null', async () => {
    expect(await redeemTableInviteLink(appId, 'not-a-real-token')).toBeNull();
  });

  it('redeeming a valid token returns the right tableId', async () => {
    const created = await createTableInviteLink(appId, tableId, 'gm-uid');
    expect(await redeemTableInviteLink(appId, created.token)).toEqual({ tableId });
  });
});
