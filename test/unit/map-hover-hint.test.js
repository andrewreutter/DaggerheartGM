import { describe, expect, it } from 'vitest';
import {
  detectMapControlPlatform,
  GAME_MAP_FOLLOW_GM_LEAD,
  GAME_MAP_LOCKED_LEAD,
  GAME_MAP_TITLE,
  gameMapGestureLines,
  MAP_CHROME_TOOLTIP_GAP_PX,
  MAP_CHROME_TOOLTIP_MIN_WIDTH_PX,
  MAP_OBJECT_VIEW_ONLY_LINE,
  mapChromeTooltipLeftPx,
  mapChromeTooltipMaxWidthPx,
  mapObjectHoverHintModel,
  mapZoomChordLabel,
  resolveMapChromeTooltip,
  chromeTooltipLineText,
  chromeTooltipLineTexts,
  groupChromeTooltipLines,
} from '../../src/client/lib/map-hover-hint.js';
import {
  GM_TOKEN_HOVER_HINT_ELEMENT,
  GM_TOKEN_HOVER_HINT_LINES,
  GM_TOKEN_HOVER_HINT_LINES_TOUCH,
  TOKEN_HOVER_HINT_LINES,
} from '../../src/client/lib/token-overlay-activate.js';

describe('mapChromeTooltipMaxWidthPx', () => {
  it('leaves a gap between the picker right edge and the tooltip left edge', () => {
    expect(mapChromeTooltipMaxWidthPx({
      viewportWidth: 800,
      pickerLeft: 300,
      pickerWidth: 200,
      tooltipRightInset: 47,
      gapPx: 8,
    })).toBe(245);
  });

  it('caps against half the viewport minus the right inset when the picker is hidden', () => {
    expect(mapChromeTooltipMaxWidthPx({
      viewportWidth: 800,
      tooltipRightInset: 47,
    })).toBe(800 / 2 - 47);
  });

  it('floors at a readable minimum when the remaining slot is tiny', () => {
    expect(mapChromeTooltipMaxWidthPx({
      viewportWidth: 200,
      pickerLeft: 20,
      pickerWidth: 160,
      tooltipRightInset: 47,
    })).toBe(MAP_CHROME_TOOLTIP_MIN_WIDTH_PX);
  });
});

describe('mapChromeTooltipLeftPx', () => {
  it('defaults to a 32px gap (4× the original 8px clearance)', () => {
    expect(MAP_CHROME_TOOLTIP_GAP_PX).toBe(32);
  });

  it('sits a fixed gap to the right of the picker', () => {
    expect(mapChromeTooltipLeftPx({
      pickerLeft: 300,
      pickerWidth: 200,
      gapPx: 8,
    })).toBe(508);
  });

  it('uses the same default gap as max-width padding when gapPx is omitted', () => {
    expect(mapChromeTooltipLeftPx({
      pickerLeft: 300,
      pickerWidth: 200,
    })).toBe(300 + 200 + MAP_CHROME_TOOLTIP_GAP_PX);
  });

  it('sits just right of the viewport midline when the picker is hidden', () => {
    expect(mapChromeTooltipLeftPx({
      viewportWidth: 800,
    })).toBe(800 / 2 + MAP_CHROME_TOOLTIP_GAP_PX);
  });
});

describe('detectMapControlPlatform', () => {
  it('classifies mac / windows / linux / other from platform and userAgent', () => {
    expect(detectMapControlPlatform({ platform: 'MacIntel' })).toBe('mac');
    expect(detectMapControlPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe('mac');
    expect(detectMapControlPlatform({ platform: 'Win32' })).toBe('windows');
    expect(detectMapControlPlatform({ platform: 'Linux x86_64' })).toBe('linux');
    expect(detectMapControlPlatform({
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })).toBe('other');
    expect(detectMapControlPlatform({})).toBe('other');
    expect(detectMapControlPlatform(null)).toBe('other');
  });

  it('uses ⌘-scroll on Mac and Ctrl-scroll elsewhere', () => {
    expect(mapZoomChordLabel('mac')).toBe('⌘-scroll');
    expect(mapZoomChordLabel('windows')).toBe('Ctrl-scroll');
    expect(mapZoomChordLabel('linux')).toBe('Ctrl-scroll');
    expect(mapZoomChordLabel('other')).toBe('Ctrl-scroll');
  });
});

describe('resolveMapChromeTooltip', () => {
  const token = { instanceId: 'c1', elementType: 'character', name: 'Vivius' };
  const image = { instanceId: 'img1', elementType: 'mapImage' };

  it('prefers a sidebar panel hint over a hovered token', () => {
    const tip = resolveMapChromeTooltip({
      panelHint: { id: 'c1', title: 'Vivius', lines: ['Click to open the character sheet.'] },
      tokenElement: token,
      mapObject: image,
    });
    expect(tip).toEqual({
      id: 'c1',
      title: 'Vivius',
      lines: ['Click to open the character sheet.'],
      showInstructionsToggle: true,
    });
  });

  it('hides panel-hint title and instruction lines when showInstructions is false', () => {
    const tip = resolveMapChromeTooltip({
      panelHint: { id: 'party-loot', title: 'Party Loot', lines: ['Click to open shared gold and items.'] },
      showInstructions: false,
    });
    expect(tip.title).toBe('');
    expect(tip.lines).toEqual([]);
    expect(tip.showInstructionsToggle).toBe(true);
  });

  it('prefers a hovered token over a map object', () => {
    const tip = resolveMapChromeTooltip({ tokenElement: token, mapObject: image });
    expect(tip).toEqual({
      id: 'c1',
      title: 'Vivius',
      lines: TOKEN_HOVER_HINT_LINES,
      showInstructionsToggle: true,
    });
  });

  it('documents GM Moves open affordance plus table-running copy', () => {
    expect(resolveMapChromeTooltip({ tokenElement: GM_TOKEN_HOVER_HINT_ELEMENT })).toEqual({
      id: 'gm-token',
      title: 'GM Moves',
      lines: GM_TOKEN_HOVER_HINT_LINES,
      showInstructionsToggle: true,
    });
    expect(resolveMapChromeTooltip({
      tokenElement: GM_TOKEN_HOVER_HINT_ELEMENT,
      isTouch: true,
    }).lines).toEqual(GM_TOKEN_HOVER_HINT_LINES_TOUCH);
    expect(resolveMapChromeTooltip({
      tokenElement: GM_TOKEN_HOVER_HINT_ELEMENT,
      isPlayer: true,
    }).lines).toEqual([]);
  });

  it('uses map-object copy when no token is hovered', () => {
    const tip = resolveMapChromeTooltip({ mapObject: image, canModifyMapObject: true });
    expect(tip.id).toBe('img1');
    expect(tip.title).toBe('Map Image');
    expect(chromeTooltipLineTexts(tip.lines)).toContain('Double-click to open.');
    expect(tip.showInstructionsToggle).toBe(true);
  });

  it('falls back to Game Map idle copy with pointer gestures only on desktop', () => {
    const tip = resolveMapChromeTooltip({ platform: 'mac', showInstructions: true });
    expect(tip.id).toBe('game-map');
    expect(tip.title).toBe(GAME_MAP_TITLE);
    expect(tip.showInstructionsToggle).toBe(true);
    expect(tip.lines).toEqual(gameMapGestureLines('mac'));
    expect(tip.lines).toEqual([
      'Pan up and down: scroll',
      'Pan left and right: shift-scroll',
      'Pan in any direction: right-click and drag',
      'Zoom toward the pointer: ⌘-scroll',
    ]);
    expect(tip.lines.join('\n')).not.toContain('Pinch');
    expect(tip.lines.join('\n')).not.toContain('two-finger swipe');
    expect(tip.lines.join('\n')).not.toContain('Zoom to Actors');
  });

  it('lists only touch gestures on a coarse pointer', () => {
    const tip = resolveMapChromeTooltip({ platform: 'mac', isTouch: true });
    expect(tip.lines).toEqual(gameMapGestureLines('mac', { isTouch: true }));
    expect(tip.lines).toEqual([
      'Pan: two-finger swipe',
      'Zoom: pinch',
    ]);
    expect(tip.lines.join('\n')).not.toContain('scroll');
    expect(tip.lines.join('\n')).not.toContain('right-click');
    expect(tip.lines.join('\n')).not.toContain('Zoom to Actors');
  });

  it('hides the title and instruction lines on every tooltip when showInstructions is false', () => {
    const mapTip = resolveMapChromeTooltip({
      cameraLocked: true,
      showInstructions: false,
      platform: 'windows',
    });
    expect(mapTip.title).toBe('');
    expect(mapTip.lines).toEqual([]);
    expect(mapTip.showInstructionsToggle).toBe(true);

    const tokenTip = resolveMapChromeTooltip({
      tokenElement: token,
      showInstructions: false,
    });
    expect(tokenTip.title).toBe('');
    expect(tokenTip.lines).toEqual([]);
    expect(tokenTip.showInstructionsToggle).toBe(true);

    const objectTip = resolveMapChromeTooltip({
      mapObject: image,
      showInstructions: false,
    });
    expect(objectTip.title).toBe('');
    expect(objectTip.lines).toEqual([]);
    expect(objectTip.showInstructionsToggle).toBe(true);
  });

  it('leads with the locked-camera note then still lists gestures', () => {
    const tip = resolveMapChromeTooltip({ cameraLocked: true, platform: 'windows' });
    expect(chromeTooltipLineText(tip.lines[0])).toBe(GAME_MAP_LOCKED_LEAD);
    expect(tip.lines.slice(1)).toEqual(gameMapGestureLines('windows'));
    expect(chromeTooltipLineTexts(tip.lines).join('\n')).toContain('Zoom toward the pointer: Ctrl-scroll');
  });

  it('hides the gesture list when the camera follows the GM', () => {
    const tip = resolveMapChromeTooltip({ canControlMapView: false, platform: 'mac' });
    expect(tip.lines).toEqual([GAME_MAP_FOLLOW_GM_LEAD]);
  });
});

describe('mapObjectHoverHintModel', () => {
  it('titles image / rect / oval / brush and uses view-only copy when locked', () => {
    expect(mapObjectHoverHintModel({ elementType: 'mapImage' }).title).toBe('Map Image');
    expect(mapObjectHoverHintModel({ elementType: 'drawShape', shapeTool: 'rect' }).title).toBe('Rectangle');
    expect(mapObjectHoverHintModel({ elementType: 'drawShape', shapeTool: 'oval' }).title).toBe('Oval');
    expect(mapObjectHoverHintModel({ elementType: 'drawShape', shapeTool: 'brush' }).title).toBe('Brush stroke');
    expect(chromeTooltipLineTexts(mapObjectHoverHintModel({ elementType: 'drawShape', shapeTool: 'brush' }).lines).join(' '))
      .toContain('scales the stroke uniformly');
    expect(mapObjectHoverHintModel({ elementType: 'mapImage' }, { canModify: false })).toEqual({
      title: 'Map Image',
      lines: [MAP_OBJECT_VIEW_ONLY_LINE],
    });
  });
});

describe('groupChromeTooltipLines', () => {
  it('splits an explicit lead from body and icon rows', () => {
    expect(groupChromeTooltipLines([
      { text: 'Click to open.', role: 'lead' },
      'Click a track to mark Hope.',
      { text: 'Assign players', icon: 'users' },
      { text: 'Remove', icon: 'trash' },
    ])).toEqual({
      lead: [{ text: 'Click to open.', role: 'lead' }],
      body: [{ text: 'Click a track to mark Hope.' }],
      actions: [
        { text: 'Assign players', icon: 'users' },
        { text: 'Remove', icon: 'trash' },
      ],
      legends: [[
        { text: 'Assign players', icon: 'users' },
        { text: 'Remove', icon: 'trash' },
      ]],
    });
  });

  it('does not treat a plain first string as a lead', () => {
    expect(groupChromeTooltipLines(['Pan: scroll', 'Zoom: pinch'])).toEqual({
      lead: [],
      body: [{ text: 'Pan: scroll' }, { text: 'Zoom: pinch' }],
      actions: [],
      legends: [],
    });
  });

  it('keeps distinct icon legends as separate side-by-side groups', () => {
    const grouped = groupChromeTooltipLines([
      { text: 'Hope', icon: 'hope', legend: 'resources' },
      { text: 'HP', icon: 'hp', legend: 'resources' },
      { text: 'Assign players', icon: 'users', legend: 'functions' },
      { text: 'Remove', icon: 'trash', legend: 'functions' },
    ]);
    expect(grouped.legends).toEqual([
      [
        { text: 'Hope', icon: 'hope', legend: 'resources' },
        { text: 'HP', icon: 'hp', legend: 'resources' },
      ],
      [
        { text: 'Assign players', icon: 'users', legend: 'functions' },
        { text: 'Remove', icon: 'trash', legend: 'functions' },
      ],
    ]);
  });
});
