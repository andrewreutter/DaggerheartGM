import { describe, it, expect, vi } from 'vitest';
import { resolveImagePasteActions } from '../../src/client/lib/image-paste-actions.js';

describe('resolveImagePasteActions', () => {
  // ── Priority 4 (fallback) ──────────────────────────────────────────────────

  it('returns empty array when no callbacks provided', () => {
    expect(resolveImagePasteActions()).toEqual([]);
    expect(resolveImagePasteActions({})).toEqual([]);
  });

  it('priority 4 – game table GM: four options in order', () => {
    const actions = resolveImagePasteActions({
      onNewMap: vi.fn(),
      onReplaceMap: vi.fn(),
      onNewImageObject: vi.fn(),
      onImportTools: vi.fn(),
    });
    expect(actions.map((a) => a.key)).toEqual(['new-map', 'replace-map', 'new-image-object', 'import-tools']);
    expect(actions).toHaveLength(4);
  });

  it('priority 4 – player: only new-image-object when that is the only callback', () => {
    const actions = resolveImagePasteActions({ onNewImageObject: vi.fn() });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('new-image-object');
  });

  it('priority 4 – import-tools run calls callback', async () => {
    const onImportTools = vi.fn();
    const file = new File([], 'img.png', { type: 'image/png' });
    const actions = resolveImagePasteActions({ onImportTools });
    await actions[0].run(file);
    expect(onImportTools).toHaveBeenCalledWith(file);
  });

  it('priority 4 – partial: only present callbacks appear', () => {
    const actions = resolveImagePasteActions({ onNewMap: vi.fn(), onImportTools: vi.fn() });
    expect(actions.map((a) => a.key)).toEqual(['new-map', 'import-tools']);
  });

  // ── Priority 1: character/adversary editor ─────────────────────────────────

  it('priority 1 – single item target → one add-to-item action, map options excluded', () => {
    const onAdd = vi.fn();
    const actions = resolveImagePasteActions({
      addToItemTargets: [{ key: 'primary', label: 'Fenris', onAdd }],
      onNewMap: vi.fn(),
      onReplaceMap: vi.fn(),
      onNewImageObject: vi.fn(),
      onImportTools: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('add-to-item-primary');
    expect(actions[0].label).toBe('Fenris');
    expect(actions[0].run).toBe(onAdd);
  });

  it('priority 1 – character + companion → two add-to-item actions, map options excluded', () => {
    const onAdd1 = vi.fn();
    const onAdd2 = vi.fn();
    const actions = resolveImagePasteActions({
      addToItemTargets: [
        { key: 'primary', label: 'Fenris', onAdd: onAdd1 },
        { key: 'companion', label: 'Shadow', onAdd: onAdd2 },
      ],
      onNewMap: vi.fn(),
      onReplaceMap: vi.fn(),
      onImportTools: vi.fn(),
    });
    expect(actions).toHaveLength(2);
    expect(actions[0].key).toBe('add-to-item-primary');
    expect(actions[1].key).toBe('add-to-item-companion');
    // map/import callbacks not present
    expect(actions.find((a) => a.key === 'new-map')).toBeUndefined();
    expect(actions.find((a) => a.key === 'import-tools')).toBeUndefined();
  });

  it('priority 1 – adversary target with no label still works', () => {
    const onAdd = vi.fn();
    const actions = resolveImagePasteActions({
      addToItemTargets: [{ key: 'primary', onAdd }],
      onNewMap: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('add-to-item-primary');
    expect(actions[0].label).toBeUndefined();
  });

  // ── Priority 2: Add Map picker dialog ─────────────────────────────────────

  it('priority 2 – add-map dialog: only new-map with dismiss, other options excluded', async () => {
    const dismiss = vi.fn();
    const onNewMap = vi.fn().mockResolvedValue(undefined);
    const file = new File([], 'map.png', { type: 'image/png' });
    const actions = resolveImagePasteActions({
      addMapDialogDismiss: dismiss,
      onNewMap,
      onReplaceMap: vi.fn(),
      onNewImageObject: vi.fn(),
      onImportTools: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('new-map');
    await actions[0].run(file);
    expect(onNewMap).toHaveBeenCalledWith(file);
    expect(dismiss).toHaveBeenCalled();
  });

  it('priority 2 – add-map dialog but no onNewMap: returns empty', () => {
    const actions = resolveImagePasteActions({
      addMapDialogDismiss: vi.fn(),
      onNewMap: null,
      onReplaceMap: vi.fn(),
    });
    expect(actions).toEqual([]);
  });

  it('priority 2 wins over map editor (priority 3)', () => {
    const dismiss = vi.fn();
    const onNewMap = vi.fn().mockResolvedValue(undefined);
    const actions = resolveImagePasteActions({
      addMapDialogDismiss: dismiss,
      onNewMap,
      onMapEditorReplace: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('new-map');
  });

  // ── Priority 3: Map Editor ─────────────────────────────────────────────────

  it('priority 3 – map editor: only editor replace, not live-table replace', () => {
    const onMapEditorReplace = vi.fn();
    const actions = resolveImagePasteActions({
      onMapEditorReplace,
      onReplaceMap: vi.fn(),
      onNewMap: vi.fn(),
      onImportTools: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('replace-map');
    expect(actions[0].run).toBe(onMapEditorReplace);
  });

  it('priority 3 – map editor over bare game-table options', () => {
    const onMapEditorReplace = vi.fn();
    const actions = resolveImagePasteActions({
      onMapEditorReplace,
      onNewMap: vi.fn(),
      onReplaceMap: vi.fn(),
      onNewImageObject: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].run).toBe(onMapEditorReplace);
  });

  // ── Priority interaction: priority 1 wins over everything ─────────────────

  it('priority 1 wins over add-map dialog (priority 2)', () => {
    const onAdd = vi.fn();
    const actions = resolveImagePasteActions({
      addToItemTargets: [{ key: 'primary', label: 'Hero', onAdd }],
      addMapDialogDismiss: vi.fn(),
      onNewMap: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('add-to-item-primary');
  });

  it('priority 1 wins over map editor (priority 3)', () => {
    const onAdd = vi.fn();
    const actions = resolveImagePasteActions({
      addToItemTargets: [{ key: 'primary', label: 'Hero', onAdd }],
      onMapEditorReplace: vi.fn(),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].key).toBe('add-to-item-primary');
  });
});
