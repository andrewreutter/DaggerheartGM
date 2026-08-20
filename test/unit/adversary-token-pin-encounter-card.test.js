import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('GM adversary token pin uses Encounter card + attack/feature actions', () => {
  it('BattleMap wires renderAdversaryEncounterCard into TokenDetailPanel for adversaries', () => {
    const src = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
    expect(src).toContain('renderAdversaryEncounterCard');
    expect(src).toContain('adversaryEncounterCard');
    expect(src).toContain('gmEncounterAdvPin');
    expect(src).toMatch(/gmEncounterAdvPin \? \([\s\S]*adversaryEncounterCard/);
  });

  it('player pin still uses EncounterAdversaryMarkedSummary when the GM card is not passed', () => {
    const src = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
    expect(src).toContain('playerEncounterAdvPin');
    expect(src).toContain('EncounterAdversaryMarkedSummary');
    expect(src).toMatch(/playerEncounterAdvPin \? \([\s\S]*EncounterAdversaryMarkedSummary/);
  });

  it('GMTableView pin body is the Encounter instance card plus AdversaryCardAttackAndFeatures', () => {
    const src = readFileSync(join(dir, '../../src/client/components/GMTableView.jsx'), 'utf8');
    expect(src).toContain('function renderAdversaryEncounterCard');
    expect(src).toContain('data-testid="adversary-token-pin-card"');
    expect(src).toContain('EncounterAdversaryInstanceCard');
    expect(src).toContain('AdversaryCardAttackAndFeatures');
    expect(src).toContain('renderAdversaryEncounterCard={!isPlayer ? renderAdversaryEncounterCard : undefined}');
    expect(src).toContain('gmMovesOverlay={!isPlayer ? gmMovesOverlay : undefined}');
    const pinFn = src.slice(src.indexOf('function renderAdversaryEncounterCard'));
    const pinBody = pinFn.slice(0, pinFn.indexOf('function renderAdversaryTargetAid'));
    expect(pinBody).toContain('EncounterAdversaryDifficultyRow');
    expect(pinBody).toContain('EncounterAdversaryInstanceCard');
    expect(pinBody).toContain('AdversaryCardAttackAndFeatures');
    expect(pinBody).toContain('handleCardRoll');
    expect(pinBody).not.toContain('EncounterAdversaryMarkedSummary');
  });

  it('tray adversaries pin like character tokens (no hover overlay)', () => {
    const src = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
    expect(src).toContain('isTokenOverlayActivateEvent');
    expect(src).toContain('MapChromeTooltip');
    expect(src).toContain('map-chrome-tooltip');
    expect(src).toContain('TokenNameChip');
    expect(src).toContain('token-name-chip');
    expect(src).toContain('placeTokenNameChip');
    expect(src).toContain("style={{ left, maxWidth }}");
    expect(src).toMatch(/function MapChromeTooltip[\s\S]*if \(!title && !footer\) return null/);
    expect(src).toMatch(/function MapChromeTooltip[\s\S]*\{title \? \(/);
    expect(src).toMatch(/function MapChromeTooltip[\s\S]*text-left/);
    expect(src).toMatch(/function MapChromeTooltip[\s\S]*fontSize: '0\.96rem'/);
    expect(src).toContain('map-chrome-show-instructions');
    expect(src).toContain("fontSize: '0.9rem'");
    expect(src).not.toContain('trayAdversaryOverlay');
    expect(src).not.toContain('data-testid="tray-adversary-overlay"');
    expect(src).not.toContain('hoverOverlay={trayAdversaryOverlay}');
    expect(src).not.toContain('shouldPinTokenOnClick');
    expect(src).toContain('tokenPinPrefersLeft');
    expect(src).toContain('preferLeft={!!pinnedToken.preferLeft}');
    expect(src).toContain('onContextMenuCapture={suppressBrowserContextMenu}');
    expect(src).toContain('swallowNextContextMenu');
    expect(src).toContain('data-testid="gm-spotlight-token"');
    expect(src).toContain('buildGmTokenMovesOverlayData');
    expect(src).toContain('handleGmTokenPointerDown');
    expect(src).toContain('isGmTokenOverlayActivateEvent');
    expect(src).toContain('handleGmTokenHoverEnter');
    expect(src).toContain('GM_TOKEN_HINT_INSTANCE_ID');
    expect(src).toContain('isPinned={isGmTokenMovesOverlay(gmMovesOverlay?.data)}');
    expect(src).toContain('PINNED_TOKEN_RING');
    expect(src).toContain('ring-amber-500');
    expect(src).not.toContain('ring-white ring-offset-1');
    expect(src).not.toContain('gmMovesOverlay.triggerProps');
    expect(src).toMatch(/<GmSpotlightToken[\s\S]*?\/>\s*<div\s+className="absolute top-1\/2 right-full z-30 -translate-y-1\/2"\s+style=\{\{ marginRight: -SPOTLIGHT_BEAM_OVERLAP_PX \}\}/);
  });
});
