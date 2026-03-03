import { HelpCircle } from 'lucide-react';
import { useState, useRef } from 'react';

const GFM_URL = 'https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax';

/**
 * Small help icon that shows a markdown cheat sheet tooltip on hover.
 * Intended to appear inline next to textarea labels in forms.
 */
export function MarkdownHelpTooltip() {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  const show = () => {
    clearTimeout(hideTimer.current);
    setVisible(true);
  };

  const hide = () => {
    // Small delay so mouse can move from icon into the tooltip panel
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  };

  return (
    <span className="relative inline-flex items-center">
      <HelpCircle
        size={12}
        className="text-slate-500 hover:text-slate-300 cursor-help transition-colors ml-1"
        onMouseEnter={show}
        onMouseLeave={hide}
      />
      {visible && (
        <div
          className="absolute top-0 left-full ml-2 z-50 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs text-slate-300"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <p className="font-semibold text-slate-200 mb-2">Markdown supported</p>
          <table className="w-full text-[10px] leading-relaxed">
            <tbody>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5">**bold**</td><td><strong>bold</strong></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5">*italic*</td><td><em>italic</em></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5">- item</td><td>bullet list</td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5">1. item</td><td>numbered list</td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5">(blank line)</td><td>new paragraph</td></tr>
            </tbody>
          </table>
          <a
            href={GFM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-sky-400 hover:text-sky-300"
          >
            Full syntax ↗
          </a>
          <p className="font-semibold text-slate-200 mt-3 mb-1">Auto-decorated</p>
          <table className="w-full text-[10px] leading-relaxed">
            <tbody>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5 align-top">spend … fear</td><td><strong className="text-slate-200">bolded</strong></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5 align-top">mark … fear</td><td><strong className="text-slate-200">bolded</strong></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5 align-top">mark … stress</td><td><strong className="text-slate-200">bolded</strong></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5 align-top">trailing ?</td><td><em>italicized</em></td></tr>
              <tr><td className="font-mono text-slate-400 pr-2 py-0.5 align-top">Countdown (N)</td><td>interactive counter</td></tr>
            </tbody>
          </table>
          {/* Left-pointing arrow */}
          <div className="absolute top-2 right-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-slate-700" />
        </div>
      )}
    </span>
  );
}
