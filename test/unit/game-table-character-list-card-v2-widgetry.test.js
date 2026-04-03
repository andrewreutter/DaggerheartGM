import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

/**
 * Assigned players should see V2 card chips / value lines on their own sidebar character card
 * (same widgetry as the GM sees), not only on the hover sheet.
 */
describe('GameTableCharacterListCard V2 widgetry for players', () => {
  it('remove from table delegates to onRemoveFromTable without its own confirm (GMTableView confirms)', () => {
    const card = readFileSync(join(root, 'src/client/components/GameTableCharacterListCard.jsx'), 'utf8');
    expect(card).not.toMatch(/window\.confirm/);
    expect(card).toMatch(/onClick=\{\(\)\s*=>\s*onRemoveFromTable\(el\.instanceId\)\}/);
  });

  it('shows V2 toggle/value block when player owns the character', () => {
    const card = readFileSync(join(root, 'src/client/components/GameTableCharacterListCard.jsx'), 'utf8');
    expect(card).toMatch(/\(!isPlayer \|\| isMyCharacter\)\s*&&/);
    expect(card).not.toMatch(/\{!isPlayer\s*&&\s*\n\s*v2Registry/);
  });

  it('routes panel V2 chips through runV2OwnedCardChipTableAction for assigned players', () => {
    const gm = readFileSync(join(root, 'src/client/components/GMTableView.jsx'), 'utf8');
    expect(gm).toMatch(/handleCharacterPanelV2CardChip[\s\S]*?runV2OwnedCardChipTableAction\(/);
    expect(gm).toMatch(/isPlayer:\s*usePlayerTablePath/);
    expect(gm).toMatch(/onActionLoopNotification:\s*usePlayerTablePath\s*\?\s*handlePlayerActionNotification/);
  });
});
