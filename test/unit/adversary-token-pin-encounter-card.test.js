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

  it('tray adversaries hover-open a left-of-tray overlay instead of click-to-pin', () => {
    const src = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
    expect(src).toContain('shouldPinTokenOnClick');
    expect(src).toContain('isTokenOverlayActivateEvent');
    expect(src).toContain('TokenHoverHintInset');
    expect(src).toContain('token-hover-hint-inset');
    expect(src).toContain('TokenNameChip');
    expect(src).toContain('token-name-chip');
    expect(src).toContain('placeTokenNameChip');
    expect(src).toContain("style={{ right: TABLE_NAME_INSET_LEFT_PX }}");
    expect(src).toMatch(/function TokenHoverHintInset[\s\S]*text-left/);
    expect(src).toMatch(/function TokenHoverHintInset[\s\S]*fontSize: '1\.2rem'/);
    expect(src).toContain('trayAdversaryOverlay');
    expect(src).toContain('data-testid="tray-adversary-overlay"');
    expect(src).toContain('overlayLeftOfEdgeStyle');
    expect(src).toContain('hoverOverlay={trayAdversaryOverlay}');
    expect(src).toContain('data-testid="gm-spotlight-token"');
    expect(src).toContain('<GmSpotlightToken tokenSizePx={trayTokenSizePx} />');
    expect(src).toMatch(/<GmSpotlightToken tokenSizePx=\{trayTokenSizePx\} \/>\s*<div\s+className="absolute top-1\/2 right-full z-30 -translate-y-1\/2"\s+style=\{\{ marginRight: -SPOTLIGHT_BEAM_OVERLAP_PX \}\}/);
    expect(src).toContain('gmMovesOverlay.triggerProps');
    expect(src).toContain("source: 'gm-token'");
    expect(src).toContain('edgeLeft');
  });
});
