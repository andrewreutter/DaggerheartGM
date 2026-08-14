import React from 'react';
import { shouldHandleSpaNavClick } from '../lib/router.js';

const NAV_BTN_CLASS = (active) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 no-underline ${
    active ? 'bg-dh-raised text-dh' : 'text-dh-muted hover:text-dh hover:bg-dh-raised/50'
  }`;

/**
 * Navigation button. When `href` is provided the element renders as an `<a>`
 * so Cmd/Ctrl/middle-click opens a new tab; plain left-click calls `onClick`
 * for SPA navigation. Without `href` it renders as a `<button>` (for actions
 * like Import or New Table that have no stable destination URL).
 */
export function NavBtn({ icon, label, active, onClick, badge, href }) {
  const iconEl = React.cloneElement(icon, { size: 18 });
  const content = (
    <>
      {iconEl}
      {label}
      {badge != null && (
        <span className="text-xs font-mono text-dh-muted">
          {badge}
        </span>
      )}
    </>
  );

  if (href) {
    const handleClick = (e) => {
      if (shouldHandleSpaNavClick(e)) {
        e.preventDefault();
        onClick?.(e);
      }
      // Modified clicks (Cmd/Ctrl/Shift/middle-click) fall through to the
      // browser's native <a href> handling so the link opens in a new tab.
    };
    return (
      <a
        href={href}
        onClick={handleClick}
        aria-current={active ? 'page' : undefined}
        className={NAV_BTN_CLASS(active)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      className={NAV_BTN_CLASS(active)}
    >
      {content}
    </button>
  );
}
