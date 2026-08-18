/**
 * Regression: InventoryItemPickerModal is opened from CharacterHoverCard, whose
 * Game Table sheet uses overflow-hidden. A nested position:fixed dialog is clipped
 * by that sheet (and any transform containing block). It must portal to document.body.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('InventoryItemPickerModal', () => {
  it('portals the dialog to document.body so the character sheet cannot clip it', () => {
    const path = join(__dirname, '../../src/client/components/modals/InventoryItemPickerModal.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toContain("import { createPortal } from 'react-dom'");
    expect(src).toContain('createPortal(modal, document.body)');
  });

  it('accumulates a footer basket with per-item quantity instead of applying on click', () => {
    const path = join(__dirname, '../../src/client/components/modals/InventoryItemPickerModal.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toContain('toggleLibraryInventorySelection');
    expect(src).toContain('setInventorySelectionCount');
    expect(src).toContain('inventorySelectionToEntries');
    expect(src).toContain('Add to selection');
    expect(src).toContain('commitSelection');
    expect(src).not.toContain('confirmLibraryItem');
  });
});
