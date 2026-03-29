import { useAiUiPreferenceOptional } from '../lib/ai-ui-preference-context.jsx';

/**
 * Secondary control under “Build with AI” primary actions — hides all AI-assisted UI for this user.
 */
export function AiDismissBuildWithAiLink({ className = '' }) {
  const ctx = useAiUiPreferenceOptional();
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={() => void ctx.dismissAiUi().catch((e) => console.error(e))}
      className={`block w-full text-center text-[11px] text-dh-muted hover:text-dh underline-offset-2 hover:underline ${className}`}
    >
      Hide All AI Features
    </button>
  );
}
