import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

/**
 * Prep banner must stay below common fullscreen modal roots so Edit / Import / Library
 * overlays (and AI flows inside them) are not covered.
 */
describe('prep banner vs modal z-order', () => {
  it('SessionBlockedBanner exposes GM idle-pause resume as a button', () => {
    const banner = readFileSync(join(root, 'src/client/components/SessionBlockedBanner.jsx'), 'utf8');
    expect(banner).toMatch(/type="button"/);
    expect(banner).toMatch(/onClick=\{onResume\}/);
    const app = readFileSync(join(root, 'src/client/app.jsx'), 'utf8');
    expect(app).toMatch(/sessionPaused && createPortal/);
    expect(app).toMatch(/onResume=\{!effectiveIsPlayer \? handleSessionBannerResume/);
    expect(app).toMatch(/set-table-top.*sessionPaused: false/s);
  });

  it('SessionBlockedBanner stacks below standard modal backdrops', () => {
    const banner = readFileSync(join(root, 'src/client/components/SessionBlockedBanner.jsx'), 'utf8');
    expect(banner).toMatch(/z-\[52\]/);

    for (const rel of [
      'src/client/components/modals/EditChoiceDialog.jsx',
      'src/client/components/modals/ImportModalShell.jsx',
      'src/client/components/LibraryView.jsx',
      'src/client/components/modals/CreateSceneModal.jsx',
    ]) {
      const src = readFileSync(join(root, rel), 'utf8');
      expect(src, rel).toMatch(/z-\[53\]/);
    }
  });

  it('PrepSetupChecklist unmounts when leaving the table view (body portal)', () => {
    // Game Table stays mounted with display:none; the checklist portals to document.body,
    // so it must be gated on route.view === 'table' or cards linger over Library/Home.
    const gmTable = readFileSync(join(root, 'src/client/components/GMTableView.jsx'), 'utf8');
    expect(gmTable).toMatch(
      /!isPlayer && route\?\.view === ['"]table['"] && \(\s*<PrepSetupChecklist/,
    );
    const checklist = readFileSync(join(root, 'src/client/components/PrepSetupChecklist.jsx'), 'utf8');
    expect(checklist).toMatch(/createPortal\(/);
    expect(checklist).toMatch(/document\.body/);
  });
});
