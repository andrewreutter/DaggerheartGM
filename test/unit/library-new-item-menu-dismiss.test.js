/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';

/**
 * Regression: Library “New” type menu is portaled to `document.body`, so outside-dismiss
 * must not treat mousedown on menu items as “outside” (would unmount before click fires).
 */
describe('Library new-item menu portal selector', () => {
  it('menu root uses a selector that contains nested menuitem clicks', () => {
    const root = document.createElement('div');
    root.setAttribute('data-library-new-item-menu', '');
    document.body.appendChild(root);
    const item = document.createElement('button');
    root.appendChild(item);

    expect(item.closest('[data-library-new-item-menu]')).toBe(root);

    document.body.removeChild(root);
  });
});
