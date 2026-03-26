/**
 * Shared Cursor CLI `agent` invocation for local automation scripts.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLastStateLine } from './cursor-agent-state.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = join(SCRIPT_DIR, '..', '..');

/**
 * @param {string} prompt
 * @param {{ workspace: string, model?: string, timeoutMs?: number }} opts
 */
export function runCursorAgent(prompt, { workspace = DEFAULT_REPO_ROOT, model = 'composer-2', timeoutMs = 0 } = {}) {
  const args = ['agent', '--print', '--trust', '--force', '--model', model, '--workspace', workspace, prompt];
  const r = spawnSync('cursor', args, {
    cwd: workspace,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: timeoutMs || undefined,
    env: { ...process.env },
    shell: false,
  });
  const stdout = (r.stdout || '') + (r.stderr ? `\n${r.stderr}` : '');
  return { code: r.status ?? (r.signal ? 1 : 0), stdout, error: r.error };
}

/**
 * @param {string} stdout
 * @param {string[]} allowedCanonical — e.g. ['Done', 'Blocked']
 * @param {{ workspace?: string, model?: string }} [opts]
 */
export function parseStateWithFallback(stdout, allowedCanonical, opts = {}) {
  const allowedSet = new Set(allowedCanonical);
  let s = extractLastStateLine(stdout);
  if (s && allowedSet.has(s)) return s;

  const interpList = [...allowedCanonical].join(', ');
  const interpPrompt = `The previous model output ended with unclear state. Extract the workflow state.

Previous output (tail):
---
${stdout.slice(-6000)}
---

Reply with EXACTLY ONE WORD from: ${interpList}
Nothing before or after that word.`;
  const model = opts.model ?? process.env.DEV_AGENT_MODEL ?? 'composer-2';
  const workspace = opts.workspace ?? DEFAULT_REPO_ROOT;
  const r2 = runCursorAgent(interpPrompt, { workspace, model });
  if (r2.code !== 0) return null;
  const t = extractLastStateLine(r2.stdout);
  if (t && allowedSet.has(t)) return t;
  return null;
}
