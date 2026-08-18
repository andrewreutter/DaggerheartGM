/**
 * Which Postgres URL problem reports use.
 * `PROBLEM_DATABASE_URL` when set (non-empty after trim), else `DATABASE_URL`.
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function resolveProblemDatabaseUrl(env = process.env) {
  const dedicated = typeof env.PROBLEM_DATABASE_URL === 'string' ? env.PROBLEM_DATABASE_URL.trim() : '';
  if (dedicated) return dedicated;
  const fallback = typeof env.DATABASE_URL === 'string' ? env.DATABASE_URL.trim() : '';
  return fallback || null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isProblemDatabaseConfigured(env = process.env) {
  return !!resolveProblemDatabaseUrl(env);
}

/**
 * True when problem reports should use a pool other than the main app pool.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isDedicatedProblemDatabase(env = process.env) {
  const problem = typeof env.PROBLEM_DATABASE_URL === 'string' ? env.PROBLEM_DATABASE_URL.trim() : '';
  if (!problem) return false;
  const main = typeof env.DATABASE_URL === 'string' ? env.DATABASE_URL.trim() : '';
  return problem !== main;
}

/**
 * Bug-report schema files to apply on a dedicated problem DB.
 * @param {string[]} allFiles
 * @returns {string[]}
 */
export function listProblemDatabaseMigrationFiles(allFiles) {
  if (!Array.isArray(allFiles)) return [];
  return allFiles.filter(f => typeof f === 'string' && f.includes('bug_reports') && f.endsWith('.sql')).sort();
}
