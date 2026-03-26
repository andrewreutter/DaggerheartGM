import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Repository root (parent of `scripts/`). */
export const REPO_ROOT = join(__dirname, '..', '..');
