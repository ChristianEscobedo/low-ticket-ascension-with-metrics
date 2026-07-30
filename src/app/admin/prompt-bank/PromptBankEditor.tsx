'use client';

/**
 * The Prompt Bank editor. Lists the merged bank (code seeds with DB overrides
 * plus custom recipes), edits any field, toggles recipes on/off, resets
 * builtins to the code default, and imports Notion-style swipe-file entries
 * (Why it works / Template / Examples) as new custom recipes. The assembled
 * preview shows exactly what the generators will receive.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FlaskConical,
  History,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  PLATFORM_LABEL,
  FORMAT_LABEL,
  PLATFORM_SIZE_PRESETS,
  buildImagePrompt,
  recipeCraftBlock,
  imageRecipeCraftBlock,
  type ContentFormat,
  type ContentPiece,
  type ContentPlatform,
  type PromptRecipe,
  type RecipeGoal,
  type RecipeGroup,
  type RecipeInputField,
} from '@/lib/mothermode/content';
import {
  parseNotionEntry,
  slugifyRecipeId,
} from '@/lib/mothermode/content/promptBankImport';
import {
  appendExample,
  buildRemixDraft,
  clampSequenceCount,
} from '@/lib/mothermode/content/promptBankActions';
import { saveGeneratedBatch } from '@/components/mothermode/content/generatedClient';
import { OFFERS } from '@/lib/mothermode/offers';
import { PlatformPreview } from '@/components/mothermode/content/previews/PlatformPreview';

const PLATFORMS = Object.keys(PLATFORM_LABEL) as ContentPlatform[];
const FORMATS = Object.keys(FORMAT_LABEL) as ContentFormat[];
const GOALS: { id: RecipeGoal; label: string }[] = [
  { id: 'replies', label: 'Replies' },
  { id: 'saves', label: 'Saves' },
  { id: 'shares', label: 'Shares' },
  { id: 'follows', label: 'Follows' },
  { id: 'clicks', label: 'Clicks' },
];

const fieldCls =
  'w-full rounded-lg border border-bone/15 bg-black/20 px-2.5 py-1.5 text-sm text-bone placeholder:text-bone/30 focus:border-brass/50 focus:outline-none';
const labelCls = 'mb-1 block text-xs uppercase tracking-wide text-bone/50';
const btnSolid =
  'inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50';
const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-bone/15 px-3 py-1.5 text-xs text-bone/70 transition-colors hover:bg-bone/5 disabled:opacity-50';

/** A blank custom recipe draft. */
function blankRecipe(): PromptRecipe {
  return {
    id: '',
    label: '',
    hint: '',
    group: 'framework',
    goal: 'shares',
    whyItWorks: [],
    template: '',
    exampleHooks: [],
    craft: '',
    platforms: [],
    formats: [],
    platformNotes: {},
    sourceUrls: [],
    builtin: false,
    enabled: true,
  };
}

/** Toggle a value in a list. */
const toggleIn = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** The assembled block the generators receive: text craft for frameworks and
 *  styles, art direction for image recipes. */
function assembledBlock(r: PromptRecipe, platform: ContentPlatform): string {
  return r.group === 'image'
    ? imageRecipeCraftBlock(r, platform)
    : recipeCraftBlock(r, platform);
}

export function PromptBankEditor() {
  const [recipes, setRecipes] = useState<PromptRecipe[]>([]);
  const [overriddenIds, setOverriddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | RecipeGroup | 'custom'>(
    'all',
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptRecipe | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importLabel, setImportLabel] = useState('');
  const [importText, setImportText] = useState('');

  const [previewPlatform, setPreviewPlatform] =
    useState<ContentPlatform>('x');

  // Test lab: run the selected recipe through the real generator and preview
  // the piece it makes, in the actual platform chrome.
  const [testPlatform, setTestPlatform] = useState<ContentPlatform>('instagram');
  const [testFormat, setTestFormat] = useState<ContentFormat>('feed');
  const [testOffer, setTestOffer] = useState(OFFERS[0]?.slug ?? '');
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testPiece, setTestPiece] = useState<ContentPiece | null>(null);
  const [testModel, setTestModel] = useState<string | null>(null);

  // Test lab output actions (PROMPT_BANK_TEST_ACTIONS_TASK.md): every test
  // output can be copied, kept, edited, saved, expanded, and fed back into
  // the bank. One busy flag per action so buttons lock while their call runs.
  const [testInputValues, setTestInputValues] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentPiece[]>([]);
  const [changesText, setChangesText] = useState('');
  const [savedMain, setSavedMain] = useState(false);
  const [sequence, setSequence] = useState<ContentPiece[] | null>(null);
  const [sequenceCount, setSequenceCount] = useState(4);
  const [sequenceSavedIds, setSequenceSavedIds] = useState<string[]>([]);
  const [leadMagnetKitId, setLeadMagnetKitId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mothermode-prompts');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Load failed (${res.status})`);
      }
      setRecipes(json.recipes ?? []);
      setOverriddenIds(json.overriddenIds ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (groupFilter === 'custom' && r.builtin) return false;
      if (
        (groupFilter === 'framework' ||
          groupFilter === 'style' ||
          groupFilter === 'image') &&
        r.group !== groupFilter
      )
        return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.id.includes(q) ||
        r.hint.toLowerCase().includes(q)
      );
    });
  }, [recipes, query, groupFilter]);

  const resetTestWorkbench = () => {
    setTestNotice(null);
    setRevisions([]);
    setChangesText('');
    setSavedMain(false);
    setSequence(null);
    setSequenceSavedIds([]);
    setLeadMagnetKitId(null);
    setTestInputValues({});
  };

  const select = (r: PromptRecipe) => {
    setSelectedId(r.id);
    setDraft(JSON.parse(JSON.stringify(r)) as PromptRecipe);
    setDirty(false);
    setNotice(null);
    setTestPiece(null);
    setTestError(null);
    setTestPlatform(r.platforms[0] ?? 'instagram');
    setTestFormat(r.formats[0] ?? 'feed');
    resetTestWorkbench();
  };

  const update = <K extends keyof PromptRecipe>(key: K, value: PromptRecipe[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
  };

  // -- Custom input fields on the recipe (extended context the admin fills
  // in at generation time; recipe.inputs) --
  const updateInputField = (
    index: number,
    patch: Partial<RecipeInputField>,
  ) => {
    if (!draft) return;
    update(
      'inputs',
      (draft.inputs ?? []).map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ),
    );
  };
  const addInputField = () => {
    if (!draft) return;
    const existing = draft.inputs ?? [];
    let id = `field-${existing.length + 1}`;
    let n = existing.length + 1;
    while (existing.some((f) => f.id === id)) {
      n += 1;
      id = `field-${n}`;
    }
    update('inputs', [...existing, { id, label: '' }]);
  };
  const removeInputField = (index: number) => {
    if (!draft) return;
    update(
      'inputs',
      (draft.inputs ?? []).filter((_, i) => i !== index),
    );
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/mothermode-prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipe: draft }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Save failed (${res.status})`);
      }
      setNotice(`Saved "${draft.label}". Generators pick it up on the next run.`);
      setSelectedId(draft.id);
      setDirty(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string, isReset: boolean) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/mothermode-prompts?slug=${encodeURIComponent(slug)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Delete failed (${res.status})`);
      }
      setNotice(
        isReset
          ? `Reset "${slug}" to the code default.`
          : `Deleted custom recipe "${slug}".`,
      );
      if (selectedId === slug) {
        setSelectedId(null);
        setDraft(null);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (r: PromptRecipe) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mothermode-prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipe: { ...r, enabled: r.enabled === false } }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Toggle failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setBusy(false);
    }
  };

  const applyImport = () => {
    const parsed = parseNotionEntry(importText);
    const label = importLabel.trim();
    const id = slugifyRecipeId(label);
    if (!label || !id) {
      setError('Give the imported framework a label first.');
      return;
    }
    if (recipes.some((r) => r.id === id)) {
      setError(`A recipe with id "${id}" already exists. Rename this one.`);
      return;
    }
    const next: PromptRecipe = {
      ...blankRecipe(),
      id,
      label,
      hint: parsed.whyItWorks[0] ?? '',
      whyItWorks: parsed.whyItWorks,
      template: parsed.template,
      sourceUrls: parsed.sourceUrls,
    };
    setDraft(next);
    setSelectedId(null);
    setDirty(true);
    setImportOpen(false);
    setImportText('');
    setImportLabel('');
    setNotice('Imported. Review the draft, set platforms and craft, then save.');
  };

  const copyPrompt = () => {
    if (!draft) return;
    void navigator.clipboard.writeText(assembledBlock(draft, previewPlatform));
    setNotice('Assembled prompt copied.');
  };

  /** Generate one piece from the current recipe and show it in platform chrome. */
  const runTest = async () => {
    if (!draft) return;
    setTestBusy(true);
    setTestError(null);
    setTestPiece(null);
    try {
      const res = await fetch('/api/admin/mothermode-prompts/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipeId: draft.id,
          platform: testPlatform,
          format: testFormat,
          offerSlug: testOffer || undefined,
          inputValues: testInputValues,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Test failed (${res.status})`);
      }
      const piece = json.piece as ContentPiece;
      setTestPiece(piece);
      setTestModel(json.model ?? null);
      // Fresh run: v1 of the revision stack, workbench state cleared.
      resetTestWorkbench();
      setRevisions([piece]);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestBusy(false);
    }
  };

  // ---------------------------- Test lab actions ----------------------------

  /** The fully composed, hook-anchored image prompt for the test piece. */
  const composedImagePrompt =
    testPiece?.media?.prompt && testPiece.hook
      ? buildImagePrompt(testPiece.media.prompt, testPiece.hook)
      : null;

  const copyComposedImagePrompt = () => {
    if (!composedImagePrompt) return;
    void navigator.clipboard.writeText(composedImagePrompt);
    setTestNotice('Composed image prompt copied.');
  };

  /** Persist one piece to the content hub generated library (fresh id per
   *  save so repeat saves never collide with an earlier row). */
  const savePieceToLibrary = async (piece: ContentPiece) => {
    const stamped: ContentPiece = {
      ...piece,
      id: `${piece.id}-lib-${Date.now().toString(36)}${Math.floor(
        Math.random() * 1296,
      ).toString(36)}`,
      framework: piece.framework ?? draft?.id,
    };
    await saveGeneratedBatch({
      pieces: [stamped],
      offerSlug: testOffer || undefined,
      model: testModel ?? undefined,
      guides: draft ? `Test lab: ${draft.id}` : undefined,
    });
  };

  const saveTestPiece = async () => {
    if (!testPiece || actionBusy) return;
    setActionBusy('save');
    setTestNotice(null);
    setTestError(null);
    try {
      await savePieceToLibrary(testPiece);
      setSavedMain(true);
      setTestNotice('Saved to the generated library in the content hub.');
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setActionBusy(null);
    }
  };

  /** Add the output's hook (or image prompt) as a steering example and save
   *  the recipe so every future run learns from this output. */
  const addAsExample = async () => {
    if (!draft || !testPiece || actionBusy) return;
    const candidate =
      draft.group === 'image'
        ? (testPiece.media?.prompt ?? testPiece.hook)
        : testPiece.hook;
    const result = appendExample(draft.exampleHooks, candidate);
    if (!result.added) {
      setTestNotice('That output is already an example on this recipe.');
      return;
    }
    const nextDraft = { ...draft, exampleHooks: result.next };
    setActionBusy('example');
    setTestNotice(null);
    setTestError(null);
    try {
      const res = await fetch('/api/admin/mothermode-prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipe: nextDraft }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Save failed (${res.status})`);
      }
      setDraft(nextDraft);
      setSelectedId(nextDraft.id);
      setDirty(false);
      setTestNotice(
        result.dropped
          ? `Example added and saved. The oldest example dropped off to keep 6: "${result.dropped.slice(0, 60)}".`
          : 'Example added and saved. Future runs steer toward this output.',
      );
      await load();
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setActionBusy(null);
    }
  };

  /** Rewrite the test piece's fields with the freeform change instructions,
   *  held to the recipe's framework, and push the result as a new revision. */
  const applyChanges = async () => {
    if (!draft || !testPiece || actionBusy) return;
    const instructions = changesText.trim();
    if (!instructions) {
      setTestError('Describe the change first (one or two sentences).');
      return;
    }
    setActionBusy('changes');
    setTestNotice(null);
    setTestError(null);
    try {
      const context = {
        theme: testPiece.theme,
        tone: testPiece.tone,
        platform: testPiece.platform,
        format: testPiece.format,
      };
      const rewriteField = async (
        field: 'hook' | 'caption' | 'body',
        text: string,
      ): Promise<string> => {
        const res = await fetch('/api/mothermode/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'rewrite',
            field,
            text,
            instructions,
            framework: draft.id,
            context,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Rewrite failed (${res.status})`);
        }
        return String(json.text ?? '');
      };

      const next: ContentPiece = { ...testPiece };
      if (testPiece.hook) next.hook = await rewriteField('hook', testPiece.hook);
      if (testPiece.caption)
        next.caption = await rewriteField('caption', testPiece.caption);
      if (testPiece.body?.length) {
        const joined = await rewriteField('body', testPiece.body.join('\n\n'));
        next.body = joined.split(/\n{2,}/).filter((p) => p.trim());
      }
      setTestPiece(next);
      setRevisions((r) => [...r, next]);
      setSavedMain(false);
      setTestNotice(`Applied. Now at v${revisions.length + 1}.`);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Rewrite failed');
    } finally {
      setActionBusy(null);
    }
  };

  /** Restore an earlier revision and drop the ones after it. */
  const restoreRevision = (index: number) => {
    const target = revisions[index];
    if (!target) return;
    setTestPiece(target);
    setRevisions((r) => r.slice(0, index + 1));
    setTestNotice(`Restored v${index + 1}.`);
  };

  /** Draft a NEW custom recipe from what the test produced. Lands unsaved in
   *  the editor for human review, exactly like Import-from-notes. */
  const remixIntoPrompt = () => {
    if (!draft || !testPiece) return;
    const remix = buildRemixDraft(
      draft,
      testPiece,
      recipes.map((r) => r.id),
    );
    setDraft(remix);
    setSelectedId(null);
    setDirty(true);
    setTestPiece(null);
    resetTestWorkbench();
    setNotice(
      `Remixed into "${remix.label}". Review the draft, then save it like any custom recipe.`,
    );
  };

  /** Expand the test piece into a connected 3-5 post content funnel. */
  const createSequence = async () => {
    if (!draft || !testPiece || actionBusy) return;
    setActionBusy('sequence');
    setTestNotice(null);
    setTestError(null);
    setSequence(null);
    setSequenceSavedIds([]);
    try {
      const res = await fetch('/api/admin/mothermode-prompts/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'sequence',
          recipeId: draft.id,
          platform: testPlatform,
          format: testFormat,
          offerSlug: testOffer || undefined,
          count: clampSequenceCount(sequenceCount),
          source: testPiece,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Sequence failed (${res.status})`);
      }
      const pieces = (json.pieces ?? []) as ContentPiece[];
      setSequence(pieces);
      setTestNotice(
        `Sequence drafted: ${pieces.length} connected posts. Save them one by one or all at once.`,
      );
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Sequence failed');
    } finally {
      setActionBusy(null);
    }
  };

  const saveSequencePiece = async (piece: ContentPiece) => {
    if (actionBusy) return;
    setActionBusy(`seq:${piece.id}`);
    setTestError(null);
    try {
      await savePieceToLibrary(piece);
      setSequenceSavedIds((ids) => [...ids, piece.id]);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setActionBusy(null);
    }
  };

  const saveAllSequence = async () => {
    if (!sequence || actionBusy) return;
    setActionBusy('seqAll');
    setTestError(null);
    try {
      for (const piece of sequence) {
        if (sequenceSavedIds.includes(piece.id)) continue;
        await savePieceToLibrary(piece);
        setSequenceSavedIds((ids) => [...ids, piece.id]);
      }
      setTestNotice('Whole sequence saved to the generated library.');
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setActionBusy(null);
    }
  };

  /** Seed a Lead Gen Kit from the test piece (theme to angle, hook to
   *  promise, body to outline seed), then deep-link to the kit editor. */
  const makeLeadMagnet = async () => {
    if (!draft || !testPiece || actionBusy) return;
    setActionBusy('leadmagnet');
    setTestNotice(null);
    setTestError(null);
    try {
      const offer = OFFERS.find((o) => o.slug === testOffer);
      const format = 'guide';
      const seedIntake = {
        topic: testPiece.theme || testPiece.title,
        audience: offer?.hero?.audience ?? '',
        goal: 'opt-in',
        transformation: testPiece.hook,
        length: 'standard',
        tone: 'confidante',
        cta: testPiece.cta,
        offerSlug: testOffer,
        notes: [
          `Seeded from a Test lab piece built with the "${draft.label}" recipe.`,
          `Hook: ${testPiece.hook}`,
          testPiece.body?.length
            ? `Post body:\n${testPiece.body.join('\n')}`
            : '',
          testPiece.caption ? `Caption:\n${testPiece.caption}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
      const postLeadgen = async (body: Record<string, unknown>) => {
        const res = await fetch('/api/mothermode/leadgen-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Lead gen failed (${res.status})`);
        }
        return json;
      };
      const filled = await postLeadgen({
        action: 'fillIntake',
        intake: seedIntake,
        format,
      });
      const outlined = await postLeadgen({
        action: 'outline',
        intake: filled.intake,
        format,
      });
      const name = `${testPiece.theme || testPiece.title} (from post)`.slice(0, 120);
      const slug = `from-post-${draft.id}-${Date.now().toString(36)}`.slice(0, 80);
      const res = await fetch('/api/admin/mothermode-leadgen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          format,
          status: 'draft',
          intake: filled.intake,
          doc: outlined.doc,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Kit save failed (${res.status})`);
      }
      setLeadMagnetKitId(json.item?.id ?? null);
      setTestNotice(
        'Lead magnet drafted. Open it in the Lead Gen Kit editor to review and publish.',
      );
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Lead magnet failed');
    } finally {
      setActionBusy(null);
    }
  };

  const isOverridden = (id: string) => overriddenIds.includes(id);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ------------------------------ Bank list ------------------------------ */}
      <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 lg:col-span-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-bone/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search frameworks"
              className={`${fieldCls} pl-8`}
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={btnGhost}
            title="Reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(blankRecipe());
              setSelectedId(null);
              setDirty(true);
            }}
            className={btnSolid}
            title="New custom recipe"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={btnGhost}
            title="Import from notes"
          >
            <Download className="h-3.5 w-3.5" />
            Import
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['all', 'framework', 'style', 'image', 'custom'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                groupFilter === g
                  ? 'border-brass bg-brass/10 font-semibold text-brass'
                  : 'border-bone/15 text-bone/60 hover:bg-bone/5'
              }`}
            >
              {g === 'all' ? `All (${recipes.length})` : g}
            </button>
          ))}
        </div>

        <ul className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
          {loading ? (
            <li className="py-6 text-center text-xs text-bone/45">Loading...</li>
          ) : filtered.length === 0 ? (
            <li className="py-6 text-center text-xs text-bone/45">
              No recipes match.
            </li>
          ) : (
            filtered.map((r) => {
              const off = r.enabled === false;
              const active = draft?.id === r.id;
              return (
                <li key={r.id}>
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                      active
                        ? 'border-brass bg-brass/10'
                        : 'border-bone/10 hover:border-bone/25'
                    } ${off ? 'opacity-55' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => select(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-bone">
                        {r.label}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wide text-bone/40">
                        <span
                          className={
                            r.group === 'framework'
                              ? 'text-brass'
                              : r.group === 'image'
                                ? 'text-bone/70'
                                : 'text-mushroom'
                          }
                        >
                          {r.group}
                        </span>
                        <span>· {r.goal}</span>
                        {r.kind && <span>· {r.kind}</span>}
                        {!r.builtin && (
                          <span className="rounded bg-brass/15 px-1 font-semibold text-brass">
                            custom
                          </span>
                        )}
                        {r.builtin && isOverridden(r.id) && (
                          <span className="rounded bg-brass/15 px-1 font-semibold text-brass">
                            edited
                          </span>
                        )}
                        {off && (
                          <span className="rounded bg-bone/10 px-1">off</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleEnabled(r)}
                      title={off ? 'Enable' : 'Disable'}
                      className={`h-4 w-7 shrink-0 rounded-full transition-colors ${
                        off ? 'bg-bone/20' : 'bg-brass'
                      } relative`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                          off ? 'left-0.5' : 'left-3.5'
                        }`}
                      />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {notice && <p className="mt-2 text-xs text-brass">{notice}</p>}
      </div>

      {/* ------------------------------ Edit panel ----------------------------- */}
      <div className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 lg:col-span-2">
        {!draft ? (
          <p className="py-16 text-center text-sm text-bone/45">
            Select a recipe to edit, or create a new one.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    draft.group === 'framework'
                      ? 'bg-brass/15 text-brass'
                      : draft.group === 'image'
                        ? 'bg-bone/10 text-bone/70'
                        : 'bg-mushroom/15 text-mushroom'
                  }`}
                >
                  {draft.group}
                </span>
                {draft.kind && (
                  <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brass">
                    {draft.kind}
                  </span>
                )}
                {draft.builtin ? (
                  <span className="text-[11px] text-bone/45">
                    builtin · edits become an override
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-brass">
                    custom recipe
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-bone/60">
                  <input
                    type="checkbox"
                    checked={draft.enabled !== false}
                    onChange={(e) => update('enabled', e.target.checked)}
                    className="accent-brass"
                  />
                  Enabled
                </label>
                {draft.builtin && isOverridden(draft.id) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(draft.id, true)}
                    className={btnGhost}
                    title="Reset to the code default"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
                {!draft.builtin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(draft.id, false)}
                    className={`${btnGhost} text-red-400`}
                    title="Delete this custom recipe"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => void save()}
                  className={btnSolid}
                >
                  <Check className="h-3.5 w-3.5" />
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Label</label>
                <input
                  value={draft.label}
                  onChange={(e) => update('label', e.target.value)}
                  className={fieldCls}
                  placeholder="How I went from X to Y"
                />
              </div>
              <div>
                <label className={labelCls}>Id (slug)</label>
                <input
                  value={draft.id}
                  disabled={draft.builtin}
                  onChange={(e) =>
                    update(
                      'id',
                      slugifyRecipeId(e.target.value) || e.target.value,
                    )
                  }
                  className={`${fieldCls} disabled:opacity-60`}
                  placeholder="how-i-went-from-x-to-y"
                />
              </div>
              <div>
                <label className={labelCls}>Hint (one line)</label>
                <input
                  value={draft.hint}
                  onChange={(e) => update('hint', e.target.value)}
                  className={fieldCls}
                  placeholder="Transformation with receipts"
                />
              </div>
              <div>
                <label className={labelCls}>Primary goal</label>
                <select
                  value={draft.goal}
                  onChange={(e) => update('goal', e.target.value as RecipeGoal)}
                  className={fieldCls}
                >
                  {GOALS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              {!draft.builtin && (
                <div>
                  <label className={labelCls}>Group</label>
                  <select
                    value={draft.group}
                    onChange={(e) =>
                      update('group', e.target.value as RecipeGroup)
                    }
                    className={fieldCls}
                  >
                    <option value="framework">framework</option>
                    <option value="style">style</option>
                    <option value="image">image</option>
                  </select>
                </div>
              )}
            </div>

            {draft.group === 'image' && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-bone/10 bg-black/20 p-3">
                <div>
                  <label className={labelCls}>Placement kind</label>
                  <select
                    value={draft.kind ?? ''}
                    onChange={(e) =>
                      update(
                        'kind',
                        (e.target.value || undefined) as PromptRecipe['kind'],
                      )
                    }
                    className={fieldCls}
                  >
                    <option value="">(unset)</option>
                    <option value="organic">Organic</option>
                    <option value="ad">Ad</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>
                    Target sizes (platform size presets)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORM_SIZE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          update(
                            'sizePresetIds',
                            toggleIn(draft.sizePresetIds ?? [], p.id),
                          )
                        }
                        title={`${p.size} · ${p.aspect}`}
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          (draft.sizePresetIds ?? []).includes(p.id)
                            ? 'border-brass bg-brass/10 font-semibold text-brass'
                            : 'border-bone/15 text-bone/55'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>
                Strong-fit platforms (empty = any)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update('platforms', toggleIn(draft.platforms, p))}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      draft.platforms.includes(p)
                        ? 'border-brass bg-brass/10 font-semibold text-brass'
                        : 'border-bone/15 text-bone/55'
                    }`}
                  >
                    {PLATFORM_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Strong-fit formats (empty = any)</label>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update('formats', toggleIn(draft.formats, f))}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      draft.formats.includes(f)
                        ? 'border-brass bg-brass/10 font-semibold text-brass'
                        : 'border-bone/15 text-bone/55'
                    }`}
                  >
                    {FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Why it works (one bullet per line)
              </label>
              <textarea
                value={draft.whyItWorks.join('\n')}
                onChange={(e) =>
                  update(
                    'whyItWorks',
                    e.target.value.split('\n').filter((l) => l.trim()),
                  )
                }
                rows={3}
                className={`${fieldCls} resize-none`}
              />
            </div>

            <div>
              <label className={labelCls}>
                {draft.group === 'image'
                  ? 'Image prompt skeleton (the {Slot} scene brief)'
                  : 'Template (the {Slot} skeleton)'}
              </label>
              <textarea
                value={draft.template}
                onChange={(e) => update('template', e.target.value)}
                rows={8}
                className={`${fieldCls} resize-y font-mono text-xs`}
                placeholder={
                  draft.group === 'image'
                    ? '{TheScene} photographed {Treatment} in {Setting}.\n\nLight: {NaturalLight}. Negative space on {Side} for the overlay.\nNo people. No text. No logos.'
                    : 'How I went from:\n- {CrappyThing1}\n\nTo:\n- {ImpressiveAccomplishment1}\n\n{HereIsMyStory:}'
                }
              />
            </div>

            <div>
              <label className={labelCls}>
                {draft.group === 'image'
                  ? 'Art direction (composition orders the render must follow)'
                  : 'Craft (generation orders, voice rules always win)'}
              </label>
              <textarea
                value={draft.craft}
                onChange={(e) => update('craft', e.target.value)}
                rows={4}
                className={`${fieldCls} resize-y`}
                placeholder="Direct orders the model must follow when executing this framework."
              />
            </div>

            <div>
              <label className={labelCls}>
                {draft.group === 'image'
                  ? 'Example prompts (one complete prompt per line)'
                  : 'Example openers (one per line, MotherMode-adapted)'}
              </label>
              <textarea
                value={draft.exampleHooks.join('\n')}
                onChange={(e) =>
                  update(
                    'exampleHooks',
                    e.target.value.split('\n').filter((l) => l.trim()),
                  )
                }
                rows={2}
                className={`${fieldCls} resize-none`}
              />
            </div>

            <div className="rounded-lg border border-bone/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className={`${labelCls} mb-0`}>
                    Custom input fields (extended context)
                  </label>
                  <p className="mt-0.5 text-[11px] text-bone/40">
                    Fields the admin fills in before a run (Test lab, or an
                    explicit pick in the Generate drawer). Filled values ground
                    the output in real material. Empty fields fall back to the
                    model inventing from the offer facts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addInputField}
                  className={`${btnGhost} shrink-0`}
                  title="Add an input field"
                >
                  <Plus className="h-3 w-3" />
                  Add field
                </button>
              </div>
              {(draft.inputs ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(draft.inputs ?? []).map((f, i) => (
                    <div
                      key={`${f.id}-${i}`}
                      className="rounded-lg border border-bone/10 bg-black/20 p-2.5"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>
                            The ask (shown as the label)
                          </label>
                          <input
                            value={f.label}
                            onChange={(e) =>
                              updateInputField(i, { label: e.target.value })
                            }
                            className={fieldCls}
                            placeholder="Your story in 2-3 sentences"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Field id</label>
                          <input
                            value={f.id}
                            onChange={(e) =>
                              updateInputField(i, {
                                id:
                                  slugifyRecipeId(e.target.value) ||
                                  e.target.value,
                              })
                            }
                            className={`${fieldCls} font-mono text-xs`}
                            placeholder="story"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Placeholder (example answer, never sent)
                          </label>
                          <input
                            value={f.placeholder ?? ''}
                            onChange={(e) =>
                              updateInputField(i, {
                                placeholder: e.target.value,
                              })
                            }
                            className={fieldCls}
                            placeholder="The scene, what happened, what it taught you."
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Output steer (how the model uses it)
                          </label>
                          <input
                            value={f.hint ?? ''}
                            onChange={(e) =>
                              updateInputField(i, { hint: e.target.value })
                            }
                            className={fieldCls}
                            placeholder="the narrative spine. Retell this, never invent"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-[11px] text-bone/60">
                          <input
                            type="checkbox"
                            checked={f.required === true}
                            onChange={(e) =>
                              updateInputField(i, {
                                required: e.target.checked,
                              })
                            }
                            className="accent-brass"
                          />
                          Expected (marked, never hard-blocked)
                        </label>
                        <button
                          type="button"
                          onClick={() => removeInputField(i)}
                          className={`${btnGhost} py-1 text-red-400`}
                          title="Remove this field"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {draft.platforms.length > 0 && (
              <div>
                <label className={labelCls}>Per-platform execution notes</label>
                <div className="space-y-2">
                  {draft.platforms.map((p) => (
                    <div key={p}>
                      <span className="mb-0.5 block text-[11px] font-semibold text-bone/55">
                        {PLATFORM_LABEL[p]}
                      </span>
                      <textarea
                        value={draft.platformNotes?.[p] ?? ''}
                        onChange={(e) =>
                          update('platformNotes', {
                            ...(draft.platformNotes ?? {}),
                            [p]: e.target.value,
                          })
                        }
                        rows={2}
                        className={`${fieldCls} resize-none text-xs`}
                        placeholder={`How this framework executes natively on ${PLATFORM_LABEL[p]}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>
                Reference posts (one URL per line, review only)
              </label>
              <textarea
                value={(draft.sourceUrls ?? []).join('\n')}
                onChange={(e) =>
                  update(
                    'sourceUrls',
                    e.target.value.split('\n').filter((l) => l.trim()),
                  )
                }
                rows={2}
                className={`${fieldCls} resize-none font-mono text-xs`}
              />
            </div>

            <div className="rounded-lg border border-brass/25 bg-brass/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-bone/45">
                  {draft.group === 'image'
                    ? 'Assembled image prompt preview'
                    : 'Assembled prompt preview'}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={previewPlatform}
                    onChange={(e) =>
                      setPreviewPlatform(e.target.value as ContentPlatform)
                    }
                    className="rounded-md border border-bone/15 bg-black/20 px-2 py-1 text-[11px] text-bone focus:border-brass/50 focus:outline-none"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className={`${btnGhost} py-1`}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-bone/70">
                {assembledBlock(draft, previewPlatform)}
              </p>
            </div>

            {/* --------------------------- Test lab --------------------------- */}
            <div className="rounded-lg border border-brass/25 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-bone/45">
                  <FlaskConical className="h-3.5 w-3.5 text-brass" />
                  Test lab
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={testPlatform}
                    onChange={(e) =>
                      setTestPlatform(e.target.value as ContentPlatform)
                    }
                    className="rounded-md border border-bone/15 bg-black/20 px-2 py-1 text-[11px] text-bone focus:border-brass/50 focus:outline-none"
                    aria-label="Test platform"
                  >
                    {(draft.platforms.length ? draft.platforms : PLATFORMS).map(
                      (p) => (
                        <option key={p} value={p}>
                          {PLATFORM_LABEL[p]}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    value={testFormat}
                    onChange={(e) =>
                      setTestFormat(e.target.value as ContentFormat)
                    }
                    className="rounded-md border border-bone/15 bg-black/20 px-2 py-1 text-[11px] text-bone focus:border-brass/50 focus:outline-none"
                    aria-label="Test format"
                  >
                    {(draft.formats.length ? draft.formats : FORMATS).map(
                      (f) => (
                        <option key={f} value={f}>
                          {FORMAT_LABEL[f]}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    value={testOffer}
                    onChange={(e) => setTestOffer(e.target.value)}
                    className="rounded-md border border-bone/15 bg-black/20 px-2 py-1 text-[11px] text-bone focus:border-brass/50 focus:outline-none"
                    aria-label="Test offer"
                  >
                    {OFFERS.map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={testBusy || !draft.id}
                    onClick={() => void runTest()}
                    className={btnSolid}
                    title="Generate one piece with this recipe and preview it"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    {testBusy ? 'Generating...' : 'Run test'}
                  </button>
                </div>
              </div>

              {(draft.inputs ?? []).length > 0 && (
                <div className="mt-3 rounded-lg border border-brass/20 bg-brass/5 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-bone/45">
                    Your material (custom inputs)
                  </p>
                  <p className="mt-0.5 text-[11px] text-bone/40">
                    Filled in once, sent with every Run test below. Left blank,
                    the model invents from the offer facts.
                  </p>
                  <div className="mt-2 space-y-2">
                    {(draft.inputs ?? []).map((f) => (
                      <div key={f.id}>
                        <label
                          className="mb-0.5 block text-[11px] font-semibold text-bone/60"
                          htmlFor={`test-input-${f.id}`}
                        >
                          {f.label || f.id}
                          {f.required === true && (
                            <span className="ml-1 text-brass">*</span>
                          )}
                        </label>
                        <textarea
                          id={`test-input-${f.id}`}
                          value={testInputValues[f.id] ?? ''}
                          onChange={(e) =>
                            setTestInputValues((v) => ({
                              ...v,
                              [f.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          className={`${fieldCls} resize-none text-xs`}
                          placeholder={f.placeholder}
                        />
                        {f.hint && (
                          <p className="mt-0.5 text-[10px] text-bone/35">
                            Output steer: {f.hint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testError && (
                <p className="mt-2 text-xs text-red-400">{testError}</p>
              )}
              {testBusy && (
                <p className="mt-2 text-xs text-bone/50">
                  Writing one piece with this recipe (about 30 seconds)...
                </p>
              )}

              {testPiece && (
                <div className="mt-3 space-y-3">
                  <div className="flex justify-center rounded-lg border border-bone/10 bg-bone/90 p-3">
                    <PlatformPreview piece={testPiece} review={{}} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-bone/45">
                      Hook
                    </p>
                    <p className="mt-1 text-sm text-bone/80">{testPiece.hook}</p>
                  </div>
                  {composedImagePrompt && (
                    <div className="rounded-lg border border-bone/10 bg-black/20 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-bone/45">
                          Composed image prompt
                        </p>
                        <button
                          type="button"
                          onClick={copyComposedImagePrompt}
                          className={`${btnGhost} py-1`}
                          title="Copy the fully composed, hook-anchored image prompt"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-bone/65">
                        {composedImagePrompt}
                      </p>
                      {draft.group === 'image' && (
                        <p className="mt-1.5 text-[11px] text-bone/40">
                          Shaped by the "{draft.label}" image creative
                          framework (its art direction steered the scene).
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-bone/35">
                    Generated with {testModel ?? 'auto'} · framework:{' '}
                    {testPiece.framework ?? draft.id}
                    {revisions.length > 1 ? ` · v${revisions.length}` : ''}
                  </p>

                  {/* ------------------ Output actions ------------------ */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-bone/10 pt-3">
                    <button
                      type="button"
                      disabled={!!actionBusy}
                      onClick={() => void addAsExample()}
                      className={btnGhost}
                      title={
                        draft.group === 'image'
                          ? 'Add this image prompt as a steering example and save the recipe'
                          : 'Add this hook as a steering example and save the recipe'
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {actionBusy === 'example'
                        ? 'Adding...'
                        : draft.group === 'image'
                          ? 'Add prompt as example'
                          : 'Add hook as example'}
                    </button>
                    <button
                      type="button"
                      disabled={!!actionBusy || savedMain}
                      onClick={() => void saveTestPiece()}
                      className={btnGhost}
                      title="Persist this piece to the content hub generated library"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savedMain
                        ? 'Saved'
                        : actionBusy === 'save'
                          ? 'Saving...'
                          : 'Save to library'}
                    </button>
                    {savedMain && (
                      <a
                        href="/admin/content"
                        className="text-[11px] font-semibold text-brass underline-offset-2 hover:underline"
                      >
                        Open the content hub
                      </a>
                    )}
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="test-changes">
                      Changes (applied to the hook, caption, and body)
                    </label>
                    <textarea
                      id="test-changes"
                      value={changesText}
                      onChange={(e) => setChangesText(e.target.value)}
                      rows={2}
                      className={`${fieldCls} resize-none`}
                      placeholder='e.g. "Make the hook shorter and more confrontational. Keep the story."'
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!!actionBusy || !changesText.trim()}
                        onClick={() => void applyChanges()}
                        className={btnSolid}
                        title="Rewrite the fields with these instructions, held to this recipe"
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        {actionBusy === 'changes'
                          ? 'Applying...'
                          : 'Apply changes'}
                      </button>
                      {revisions.length > 1 && (
                        <span className="flex items-center gap-1 text-[11px] text-bone/45">
                          <History className="h-3 w-3" />
                          Revisions:
                          {revisions.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              disabled={i === revisions.length - 1}
                              onClick={() => restoreRevision(i)}
                              title={
                                i === revisions.length - 1
                                  ? 'Current version'
                                  : `Restore v${i + 1} (drops later versions)`
                              }
                              className={`rounded px-1.5 py-0.5 font-semibold transition-colors ${
                                i === revisions.length - 1
                                  ? 'bg-brass/15 text-brass'
                                  : 'text-bone/55 hover:bg-bone/10'
                              }`}
                            >
                              v{i + 1}
                            </button>
                          ))}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={testBusy || !!actionBusy}
                        onClick={() => void runTest()}
                        className={btnGhost}
                        title="Run the test again from the recipe (fresh structure, clears revisions)"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Run again
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-bone/10 pt-3">
                    <button
                      type="button"
                      disabled={!!actionBusy}
                      onClick={() => void makeLeadMagnet()}
                      className={btnGhost}
                      title="Seed a Lead Gen Kit from this post (angle, promise, outline) and review it in the kit editor"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {actionBusy === 'leadmagnet'
                        ? 'Drafting kit...'
                        : 'Lead magnet'}
                    </button>
                    {leadMagnetKitId && (
                      <a
                        href={`/admin/lead-gen?kit=${encodeURIComponent(leadMagnetKitId)}`}
                        className="text-[11px] font-semibold text-brass underline-offset-2 hover:underline"
                      >
                        Open the kit
                      </a>
                    )}
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!!actionBusy}
                        onClick={() => void createSequence()}
                        className={btnGhost}
                        title="Expand this piece into a connected post funnel (hook, proof, CTA)"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {actionBusy === 'sequence'
                          ? 'Expanding...'
                          : 'Create sequence'}
                      </button>
                      <select
                        value={sequenceCount}
                        onChange={(e) =>
                          setSequenceCount(clampSequenceCount(Number(e.target.value)))
                        }
                        className="rounded-md border border-bone/15 bg-black/20 px-1.5 py-1 text-[11px] text-bone focus:border-brass/50 focus:outline-none"
                        aria-label="Sequence length"
                        title="How many posts in the funnel"
                      >
                        {[3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} posts
                          </option>
                        ))}
                      </select>
                    </span>
                    <button
                      type="button"
                      disabled={!!actionBusy}
                      onClick={remixIntoPrompt}
                      className={btnGhost}
                      title="Draft a new custom recipe from what this test produced (lands unsaved for review)"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Remix into prompt
                    </button>
                  </div>

                  {testNotice && (
                    <p className="text-xs text-brass">{testNotice}</p>
                  )}

                  {/* ------------------ Sequence drafts ------------------ */}
                  {sequence && sequence.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-brass/20 bg-brass/5 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-bone/45">
                          Sequence draft ({sequence.length} posts)
                        </p>
                        <button
                          type="button"
                          disabled={
                            !!actionBusy ||
                            sequenceSavedIds.length === sequence.length
                          }
                          onClick={() => void saveAllSequence()}
                          className={btnSolid}
                          title="Save every post in the sequence to the generated library"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {actionBusy === 'seqAll'
                            ? 'Saving...'
                            : sequenceSavedIds.length === sequence.length
                              ? 'All saved'
                              : 'Save all'}
                        </button>
                      </div>
                      <ol className="space-y-2">
                        {sequence.map((piece, i) => {
                          const saved = sequenceSavedIds.includes(piece.id);
                          return (
                            <li
                              key={piece.id}
                              className="rounded-lg border border-bone/10 bg-black/20 p-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brass">
                                    Post {i + 1} of {sequence.length}
                                    {i === 0
                                      ? ' · hook'
                                      : i === sequence.length - 1
                                        ? ' · cta'
                                        : ' · proof'}
                                  </p>
                                  <p className="mt-0.5 text-xs font-medium leading-snug text-bone/85">
                                    {piece.hook}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-bone/35">
                                    framework: {piece.framework ?? draft.id}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={!!actionBusy || saved}
                                  onClick={() => void saveSequencePiece(piece)}
                                  className={`${btnGhost} shrink-0`}
                                  title="Save this post to the generated library"
                                >
                                  <Save className="h-3 w-3" />
                                  {saved
                                    ? 'Saved'
                                    : actionBusy === `seq:${piece.id}`
                                      ? 'Saving...'
                                      : 'Save'}
                                </button>
                              </div>
                              <details className="mt-1.5">
                                <summary className="cursor-pointer text-[11px] text-bone/45 hover:text-bone/70">
                                  Preview in platform chrome
                                </summary>
                                <div className="mt-2 flex justify-center rounded-lg border border-bone/10 bg-bone/90 p-2">
                                  <PlatformPreview piece={piece} review={{}} />
                                </div>
                              </details>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------ Import modal --------------------------- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-brass/20 bg-ink p-5 shadow-xl">
            <h3 className="font-display text-xl text-bone">
              Import from notes
            </h3>
            <p className="mt-1 text-xs text-bone/55">
              Paste a swipe-file entry in the Why it works / Template / Examples
              format. It lands as a draft you can review and save.
            </p>
            <div className="mt-3">
              <label className={labelCls}>Framework label</label>
              <input
                value={importLabel}
                onChange={(e) => setImportLabel(e.target.value)}
                className={fieldCls}
                placeholder="How I went from X to Y"
              />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Pasted entry</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={14}
                className={`${fieldCls} resize-y font-mono text-xs`}
                placeholder={[
                  '- Why it works:',
                  '    - Shows that you are an interesting person.',
                  '    - Gets people engaged in your progress.',
                  '- Template:',
                  '',
                  '    How I went from:',
                  '    - {CrappyThing1}',
                  '',
                  '    To:',
                  '    - {ImpressiveAccomplishment1}',
                  '',
                  '    {HereIsMyStory:}',
                  '',
                  '- Examples:',
                  '',
                  '    https://twitter.com/someone/status/123',
                ].join('\n')}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importText.trim() || !importLabel.trim()}
                onClick={applyImport}
                className={btnSolid}
              >
                <Download className="h-3.5 w-3.5" />
                Parse into draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
