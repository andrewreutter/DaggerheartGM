import { Puzzle } from 'lucide-react';

/**
 * Library sidebar: V2 feature modules are browsable as a first-class **Features** tab (`/library/features`).
 */
export function getLibrarySidebarFeatures() {
  return [
    {
      id: 'v2-features-tab',
      title: 'Features (V2)',
      description: 'Browse the full V2 feature catalog from the Library sidebar → Features tab.',
      Icon: Puzzle,
    },
  ];
}
