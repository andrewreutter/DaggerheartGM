/**
 * `DAGGERHEART_WHITELIST_DISABLED=1` — omit Daggerheart marketing on the
 * anonymous homepage and refuse new account creation.
 */
export function isDaggerheartWhitelistDisabled(env = process.env) {
  return env.DAGGERHEART_WHITELIST_DISABLED === '1';
}
