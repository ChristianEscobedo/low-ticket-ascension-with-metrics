import { listBiblesForAdmin } from '@/lib/mothermode/brandbible/store';
import BrandBibleEditor from './BrandBibleEditor';

export const dynamic = 'force-dynamic';

/**
 * Admin-gated Brand Bible editor. A Brand Bible is a reusable "visual identity"
 * record — visual direction, color language, emotion, camera grammar and a
 * negative-prompt list — that reskins the entire Reel Director / Seedance
 * cinematic pipeline. Selecting a bible as a context source changes the look of
 * every generated storyboard and clip without touching the engine.
 */
export default async function BrandBibleAdminPage() {
  const bibles = await listBiblesForAdmin();

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Brand Bible
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Cinematic brand identity
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Define the look and feel that drives the Reel Director. Each bible sets
          the visual direction, color language, emotional tone, camera grammar
          and the &ldquo;never do this&rdquo; negatives that flow into every
          generated storyboard and Seedance clip. Select one as a context source
          in any generator to reskin its output.
        </p>
      </div>

      <BrandBibleEditor initialBibles={bibles} />
    </div>
  );
}
