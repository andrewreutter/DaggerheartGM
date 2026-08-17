import React from 'react';
import { shouldHandleSpaNavClick } from '../lib/router.js';

const FOOTER_LINKS = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Support', href: '/support' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'Discord', href: 'https://discord.gg/qjabRtAr7p', external: true },
];

/**
 * Single-row site footer: four uppercase, letter-spaced links to the legal/support
 * static pages, separated by middot dividers. Rendered at the bottom of the
 * anonymous marketing home and `HomeAuthenticated`.
 */
export function Footer({ navigate }) {
  return (
    <footer className="w-full border-t border-dh-border shrink-0">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col items-center gap-2">
        <nav className="flex items-center gap-3 sm:gap-4" aria-label="Legal">
          {FOOTER_LINKS.map((link, i) => (
            <React.Fragment key={link.href}>
              {i > 0 && (
                <span className="text-dh-muted/40 text-xs select-none" aria-hidden="true">
                  &middot;
                </span>
              )}
              <a
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                onClick={
                  link.external
                    ? undefined
                    : (e) => {
                        if (shouldHandleSpaNavClick(e)) {
                          e.preventDefault();
                          navigate?.(link.href);
                        }
                      }
                }
                className="text-xs font-semibold uppercase tracking-widest text-dh-muted hover:text-red-400 transition-colors no-underline"
              >
                {link.label}
              </a>
            </React.Fragment>
          ))}
        </nav>
        <p className="text-[11px] text-dh-muted/60">&copy; 2026 Daggertop</p>
      </div>
    </footer>
  );
}
