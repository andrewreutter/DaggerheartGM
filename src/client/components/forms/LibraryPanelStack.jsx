import { useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { FeatureLibrary } from './FeatureLibrary.jsx';
import { ExperienceLibrary } from './ExperienceLibrary.jsx';

/**
 * Stacked Feature + Experience Library panel for adversaries.
 * The front panel is fully visible; the back panel's title peeks from behind
 * the top edge. Clicking the back tab swaps which is in front.
 *
 * Props:
 *   tier               - current form tier
 *   subtype            - current form role
 *   subtypeKey         - 'role' (adversaries)
 *   currentFeatures    - features already on the form
 *   onAddFeature       - callback(feature) when adding a feature
 *   currentExperiences  - experiences already on the form
 *   onAddExperience    - callback(experience) when adding an experience
 */
export function LibraryPanelStack({
  tier,
  subtype,
  subtypeKey,
  currentFeatures,
  onAddFeature,
  currentExperiences,
  onAddExperience,
}) {
  const [frontLibrary, setFrontLibrary] = useState('feature');
  const backLibrary = frontLibrary === 'feature' ? 'experience' : 'feature';

  const swapLibrary = () => setFrontLibrary(backLibrary);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab strip: back panel's title peeking from behind, clickable to swap */}
      <button
        type="button"
        onClick={swapLibrary}
        className="h-7 shrink-0 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 bg-slate-800/60 border border-slate-700 border-b-slate-800 rounded-t-xl transition-colors cursor-pointer"
        title={`Switch to ${backLibrary === 'feature' ? 'Feature' : 'Experience'} Library`}
      >
        {backLibrary === 'feature' ? (
          <>
            <BookOpen size={12} className="text-blue-400/80" />
            Feature Library
          </>
        ) : (
          <>
            <Sparkles size={12} className="text-amber-400/80" />
            Experience Library
          </>
        )}
      </button>

      {/* Front panel: overlaps the tab strip slightly so the tab appears to peek from behind */}
      <div className="flex-1 min-h-0 -mt-0.5 relative z-10">
        {frontLibrary === 'feature' ? (
          <FeatureLibrary
            tier={tier}
            subtype={subtype}
            subtypeKey={subtypeKey}
            currentFeatures={currentFeatures}
            onAdd={onAddFeature}
          />
        ) : (
          <ExperienceLibrary
            tier={tier}
            subtype={subtype}
            currentExperiences={currentExperiences}
            onAdd={onAddExperience}
          />
        )}
      </div>
    </div>
  );
}
