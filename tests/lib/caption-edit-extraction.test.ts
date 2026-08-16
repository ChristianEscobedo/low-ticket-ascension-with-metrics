/**
 * The caption-edit extraction guard (Task 3 of REEL_STUDIO_NEXT_TASKS).
 *
 * page.tsx used to own the caption-edit surface's state + handlers inline —
 * ~450 lines of the most-touched logic in the studio. They now live in
 * `useCaptionEdit.ts` (the hook) with the four free helpers as the single
 * source. This test pins the CONTRACT so a future edit can't silently
 * re-inline a copy (two sources = the drift this extraction killed):
 *
 *   1. the hook file exports the hook + the four helpers;
 *   2. the page imports them from './useCaptionEdit' and destructures the
 *      SAME names its JSX uses;
 *   3. the page does NOT re-declare any moved state slot or handler.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '../../src/app/(fullscreen)/admin/reel-studio');
const hook = readFileSync(join(DIR, 'useCaptionEdit.ts'), 'utf8');
const page = readFileSync(join(DIR, 'page.tsx'), 'utf8');

/** The state slots + handlers the hook owns (the page destructures them). */
const HOOK_RETURN_NAMES = [
  'wordPlaceLocal',
  'wordScaleLocal',
  'stackEditMode',
  'showAllCardWords',
  'wordCtxMenu',
  'fxMode',
  'fxWords',
  'fxScope',
  'fxTarget',
  'applyWordMark',
  'applyWordMarks',
  'clearWordFx',
  'toggleFxWord',
  'freePlaceWord',
  'removeWordPlace',
  'toggleWordBehind',
  'resetCaptionWords',
  'exitStackEdit',
  'onCaptionWordPointerDown',
  'onCaptionWordContextMenu',
] as const;

/** The four free helpers (single source in the hook file). */
const HELPERS = [
  'timelineStartOf',
  'clipWordIndexFromPlanIndex',
  'planWordIndexFromClipIndex',
  'wordStylePatchToMark',
] as const;

describe('the caption-edit extraction (useCaptionEdit.ts)', () => {
  it('the hook file exports the hook + the four helpers', () => {
    expect(hook).toContain('export function useCaptionEdit(');
    for (const h of HELPERS) {
      expect(hook).toContain(`export function ${h}(`);
    }
  });

  it('the hook returns every name the page destructures', () => {
    for (const name of HOOK_RETURN_NAMES) {
      // Each name appears in the hook's return object.
      expect(hook).toMatch(new RegExp(`return \\{[\\s\\S]*\\b${name}\\b[\\s\\S]*\\}`));
    }
  });

  it('the page imports the hook + the helpers from ./useCaptionEdit', () => {
    expect(page).toContain("from './useCaptionEdit'");
    expect(page).toContain('useCaptionEdit({');
    for (const h of HELPERS) {
      expect(page).toMatch(new RegExp(`\\b${h}\\b`));
    }
  });

  it('the page destructures the SAME names from the hook call', () => {
    const call = page.match(/const \{([\s\S]*?)\} = useCaptionEdit\(/);
    expect(call).not.toBeNull();
    const destructured = call![1];
    for (const name of HOOK_RETURN_NAMES) {
      expect(destructured).toContain(name);
    }
  });

  it('the page does NOT re-declare a moved state slot or handler', () => {
    // No useState for the moved slots.
    expect(page).not.toMatch(/useState\(false\)[^;]*stackEditMode/);
    expect(page).not.toContain('const [stackEditMode, setStackEditMode] = useState');
    expect(page).not.toContain('const [wordPlaceLocal, setWordPlaceLocal] = useState');
    expect(page).not.toContain('const [wordScaleLocal, setWordScaleLocal] = useState');
    expect(page).not.toContain('const [showAllCardWords, setShowAllCardWords] = useState');
    expect(page).not.toContain('const [wordCtxMenu, setWordCtxMenu] = useState');
    expect(page).not.toContain('const [fxMode, setFxMode] = useState');
    expect(page).not.toContain('const [fxWords, setFxWords] = useState');
    expect(page).not.toContain('const [fxScope, setFxScope] = useState');
    expect(page).not.toContain('const [fxTarget, setFxTarget] = useState');
    // No function bodies for the moved handlers.
    for (const fn of [
      'applyWordMark',
      'applyWordMarks',
      'clearWordFx',
      'toggleFxWord',
      'freePlaceWord',
      'removeWordPlace',
      'toggleWordBehind',
      'resetCaptionWords',
      'exitStackEdit',
      'onCaptionWordPointerDown',
      'onCaptionWordContextMenu',
    ]) {
      expect(page).not.toMatch(new RegExp(`function ${fn}\\(`));
    }
    // And the four helpers aren't re-defined in the page either.
    for (const h of HELPERS) {
      expect(page).not.toMatch(new RegExp(`function ${h}\\(`));
    }
  });
});
