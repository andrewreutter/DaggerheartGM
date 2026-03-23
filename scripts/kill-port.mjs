#!/usr/bin/env node
/**
 * Frees TCP listen port PORT (from env, default 3456) for local dev/start.
 * macOS/Linux: lsof. No-op when nothing is listening.
 */
import { execFileSync } from 'node:child_process';

const raw = process.env.PORT ?? '3456';
const port = Number.parseInt(String(raw), 10);
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error(`kill-port: invalid PORT "${raw}"`);
  process.exit(1);
}

let stdout = '';
try {
  stdout = execFileSync(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    { encoding: 'utf8' }
  );
} catch (e) {
  const code = e?.status ?? e?.code;
  // lsof exits 1 when no matches
  if (code === 1) process.exit(0);
  console.error(`kill-port: lsof failed (is lsof installed?): ${e?.message ?? e}`);
  process.exit(code && typeof code === 'number' ? code : 1);
}

const pids = [...new Set(stdout.trim().split(/\s+/).filter(Boolean))];
for (const s of pids) {
  const pid = Number.parseInt(s, 10);
  if (!Number.isFinite(pid)) continue;
  try {
    process.kill(pid, 'SIGKILL');
  } catch (err) {
    if (err?.code !== 'ESRCH') throw err;
  }
}

if (pids.length) {
  console.log(`kill-port: freed :${port} (${pids.join(', ')})`);
}
