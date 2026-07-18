import { BrainDumpWorkspace } from './BrainDumpWorkspace';
import { WeeklyResetWorkspace } from './WeeklyResetWorkspace';
import { LoadMapWorkspace } from './LoadMapWorkspace';
import { DelegateTrackerWorkspace } from './DelegateTrackerWorkspace';

/**
 * Maps a `data-mm-slot` id (written by kit.ts's `interactiveSlot`) to the
 * React component ResourceDocument mounts in its place. Add a new
 * interactive tool by dropping a component here and calling
 * `interactiveSlot('its-id')` once from the matching deliverable doc.
 */
export const WORKSPACE_REGISTRY: Record<string, React.FC> = {
  'brain-dump-workspace': BrainDumpWorkspace,
  'weekly-reset-workspace': WeeklyResetWorkspace,
  'load-map-workspace': LoadMapWorkspace,
  'delegate-tracker-workspace': DelegateTrackerWorkspace,
};
