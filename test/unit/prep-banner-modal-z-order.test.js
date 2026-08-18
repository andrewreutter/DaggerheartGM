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

  it('ChooseSpotlightBanner uses the same slot and stacks below modal backdrops', () => {
    const banner = readFileSync(join(root, 'src/client/components/ChooseSpotlightBanner.jsx'), 'utf8');
    expect(banner).toMatch(/Choose Spotlight/);
    expect(banner).toMatch(/bottom-\[7rem\]/);
    expect(banner).toMatch(/z-\[52\]/);
    const app = readFileSync(join(root, 'src/client/app.jsx'), 'utf8');
    expect(app).toMatch(/showChooseSpotlightBanner\(sessionPlayAllowed, spotlight\)/);
    expect(app).toMatch(/<ChooseSpotlightBanner \/>/);
  });

  it('PrepSetupChecklist cards use an opaque dark fill so they stay readable over a light map', () => {
    const src = readFileSync(join(root, 'src/client/components/PrepSetupChecklist.jsx'), 'utf8');
    expect(src).toMatch(/bg-dh-canvas\/95/);
    expect(src).not.toMatch(/bg-yellow-400\/1[05]/);
    expect(src).not.toMatch(/bg-(violet|emerald|yellow)-\d+\/[1-4]\d/);
  });

  it('PrepSetupChecklist unmounts when leaving the table view (body portal)', () => {
    // Game Table stays mounted with display:none; the checklist portals to document.body,
    // so it must be gated on route.view === 'table' or cards linger over Library/Home.
    const gmTable = readFileSync(join(root, 'src/client/components/GMTableView.jsx'), 'utf8');
    expect(gmTable).toMatch(
      /!isPlayer && !isSpectator && route\?\.view === ['"]table['"] && \(\s*<PrepSetupChecklist/,
    );
    const checklist = readFileSync(join(root, 'src/client/components/PrepSetupChecklist.jsx'), 'utf8');
    expect(checklist).toMatch(/createPortal\(/);
    expect(checklist).toMatch(/document\.body/);
  });
});
