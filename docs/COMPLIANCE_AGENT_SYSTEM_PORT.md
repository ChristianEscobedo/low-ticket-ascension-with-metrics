# Compliance Agent — Port Checklist

Use this to copy **brand + platform compliance scoring**, **deterministic safe fixes**, and an **AI rewrite agent** into a sibling codebase that already has the MotherMode content hub sheet and `/api/mothermode/ai`.

Master overview: `docs/CONTENT_HUB_FEATURES_PORT.md`  
**Commit:** `8aa5477` — `feat(content): compliance agent with brand + platform score/fix`

---

## Feature summary

| Area | What was added |
|------|----------------|
| UI | Content sheet **Compliance** tab (score ring, issues, agent actions) |
| Local | Instant brand + platform heuristics (`scoreLocalCompliance`) |
| AI score | Action `complianceScore` → 0–100 scorecard + issues |
| Safe fix | Strip dashes / `!` into `PieceEdits` (`complianceFixPatch`) |
| AI fix | Action `complianceFix` → rewrite patch for hooks/caption/body/ad/email |
| Edit form | Paid ad fields + email subject/preheader |
| Previews | Facebook ad primary/headline/description; email subject/preheader from edits |
| State | `PieceReview.compliance` + ad/email keys on `PieceEdits` |
| Tests | `tests/lib/platform-compliance.test.ts` (5 cases) |

No DB migration. No new env vars (uses existing OpenAI / Anthropic text keys).

---

## Prerequisites

- [ ] Content sheet with tabs (`ContentSheet`)
- [ ] `review.ts` + `reviewClient.ts` (persist `PieceReview`)
- [ ] Brand compliance engine: `src/lib/mothermode/content/compliance.ts` (`checkPiece`, `applyFixes`, `checkText`)
- [ ] `/api/mothermode/ai` admin-gated + text model resolution
- [ ] `TEXT_MODELS` / `AUTO_MODEL` in `models.ts`
- [ ] Runtime keys: `getOpenAiKey` / `getAnthropicKey` (same as rewrite/amplify)

---

## Files (17)

Copy or re-apply in this order.

### New files

| Path | Role |
|------|------|
| `src/lib/mothermode/content/platformCompliance.ts` | Platform packs, claim heuristics, `scoreLocalCompliance`, `platformPolicyBrief` |
| `src/utils/integrations/openai-compliance.ts` | Server: `scoreComplianceWithAgent`, `fixComplianceWithAgent` |
| `src/components/mothermode/content/CompliancePanel.tsx` | Compliance tab UI |
| `tests/lib/platform-compliance.test.ts` | Unit tests |
| `docs/COMPLIANCE_AGENT_SYSTEM_PORT.md` | This guide |

### Patched files

| Path | Change |
|------|--------|
| `src/lib/mothermode/content/compliancePass.ts` | Ad/email on `effectiveCopy` / `effectivePiece` / fix patches / `aiCompliancePatchToEdits` |
| `src/lib/mothermode/content/review.ts` | `PieceEdits` ad/email; `StoredComplianceReport`; `PieceReview.compliance`; `isEmptyReview` keeps compliance + ad/email edits |
| `src/lib/mothermode/content/index.ts` | Re-export `platformCompliance` (+ existing `compliancePass`) |
| `src/app/api/mothermode/ai/route.ts` | Actions `complianceScore`, `complianceFix` |
| `src/components/mothermode/content/aiClient.ts` | `aiComplianceScore`, `aiComplianceFix` |
| `src/components/mothermode/content/ContentSheet.tsx` | Compliance tab + persist via `saveReview` |
| `src/components/mothermode/content/SheetForms.tsx` | Edit: ad primary/headline/description; email subject/preheader |
| `src/components/mothermode/content/previews/shared.tsx` | `PreviewView` ad/email fields |
| `src/components/mothermode/content/previews/PlatformPreview.tsx` | `buildView` merges ad/email edits |
| `src/components/mothermode/content/previews/FacebookPreview.tsx` | Ad surface uses view ad fields |
| `src/components/mothermode/content/previews/EmailPreview.tsx` | Subject/preheader from view |
| `docs/CONTENT_HUB_FEATURES_PORT.md` | Link + feature map row + API actions |

---

## Types (review store)

```ts
// PieceEdits — add:
adPrimaryText?: string;
adHeadline?: string;
adDescription?: string;
emailSubject?: string;
emailPreheader?: string;

// PieceReview — add:
compliance?: StoredComplianceReport;

interface StoredComplianceReport {
  score: number;
  grade: 'pass' | 'review' | 'fail';
  brandScore?: number;
  platformScore?: number;
  claimScore?: number;
  blockCount?: number;
  warnCount?: number;
  noteCount?: number;
  summary?: string;
  platformPack?: string;
  isAd?: boolean;
  scoredAt?: string;
  model?: string;
  issues?: Array<{
    id: string;
    severity: 'block' | 'warn' | 'note';
    source: string;
    field: string;
    message: string;
    match?: string;
    suggestion?: string;
    fixable?: 'deterministic' | 'ai' | 'manual';
  }>;
}
```

**`isEmptyReview`:** treat `compliance` (numeric score) and ad/email edit strings as non-empty so they are not dropped on persist.

---

## Local scoring (`platformCompliance.ts`)

1. Map platform → pack: `meta` | `tiktok` | `google` | `email` | `x` | `pinterest` | `general`.
2. Run brand `checkPiece` on the **effective** piece (edits over catalog).
3. Run pack-specific regex heuristics (stronger on `kind === 'ad'`).
4. Weight: ads lean platform; organic leans brand.
5. Grade:

| Grade | Rule |
|-------|------|
| `pass` | score ≥ 85 and no blocks |
| `review` | 60–84 or warnings only |
| `fail` | score < 60 or any block |

### Platform packs (heuristics)

- **meta** (FB/IG) — personal attributes (“are you a depressed mom…”), income guarantees, sensational bait
- **tiktok** — fear hooks, link spam
- **google** (blog/AEO) — clickbait patterns
- **email** — fake Re:/Fwd:, urgency spam
- **x** / **pinterest** — core claim blocks shared with ads

---

## API

`POST /api/mothermode/ai` (admin-gated)

### `complianceScore`

```json
{
  "action": "complianceScore",
  "model": "",
  "piece": {
    "platform": "instagram",
    "format": "feed",
    "kind": "ad",
    "theme": "...",
    "tone": "confidante",
    "hook": "...",
    "hooks": ["..."],
    "caption": "...",
    "body": ["..."],
    "cta": "...",
    "adPrimaryText": "...",
    "adHeadline": "...",
    "adDescription": "...",
    "emailSubject": "...",
    "emailPreheader": "..."
  }
}
```

**Response (shape):**

```json
{
  "ok": true,
  "score": 72,
  "grade": "review",
  "brandScore": 80,
  "platformScore": 65,
  "claimScore": 70,
  "blockCount": 1,
  "warnCount": 2,
  "noteCount": 0,
  "issues": [],
  "summary": "...",
  "platformPack": "meta",
  "isAd": true,
  "scoredAt": "ISO",
  "model": "...",
  "local": { }
}
```

Server always computes `local` first and passes it into the agent as a grounded baseline.

### `complianceFix`

Same `piece` + optional `issues[]` (blocks/warns). Response:

```json
{
  "ok": true,
  "patch": {
    "hooks": ["..."],
    "caption": "...",
    "body": "...",
    "adPrimaryText": "...",
    "adHeadline": "...",
    "adDescription": "...",
    "emailSubject": "...",
    "emailPreheader": "..."
  },
  "changelog": ["Rewrote ad primary to remove personal attribute"],
  "model": "..."
}
```

Client maps patch → `PieceEdits` via `aiCompliancePatchToEdits` (runs `applyFixes` on every string).

---

## UI wiring

### ContentSheet tabs

```ts
type Tab = 'preview' | 'edit' | 'compliance' | 'notes' | 'metrics' | 'schedule' | 'amplify';
```

Compliance panel:

```tsx
<CompliancePanel
  piece={piece}
  review={review}
  offerSlug={offerSlug}
  onEditPatch={applyEdits}
  onReviewChange={(next) =>
    setReview(saveReview(offerSlug, piece.id, { compliance: next.compliance }))
  }
/>
```

### Panel actions

1. **Run compliance agent** → `aiComplianceScore` → store scorecard
2. **Fix what is safe** → `complianceFixPatch` → `onEditPatch`
3. **Fix with agent** → `aiComplianceFix` → `aiCompliancePatchToEdits` → `onEditPatch` + local re-score

Local score always shows when no agent run yet (`agentCard ?? local`).

---

## Preview / Edit integration

Agent fixes only matter if previews and Edit show them:

- `buildView` merges `adPrimaryText`, `adHeadline`, `adDescription`, `emailSubject`, `emailPreheader`
- Facebook feed ads use `view.adPrimaryText` / `view.adHeadline` / `view.adDescription`
- Email preview uses `view.emailSubject` / `view.emailPreheader`
- Edit form shows ad block when `kind === 'ad' || piece.ad`; email block when platform/email present

---

## Env

No new keys. Same as rewrite/amplify:

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
MOTHERMODE_AI_TEXT_PROVIDER=
MOTHERMODE_AI_TEXT_MODEL=
```

Local heuristics work with **zero** AI keys. Agent score/fix need at least one text key.

---

## Tests

```bash
npx vitest run tests/lib/platform-compliance.test.ts
```

Covers: pack mapping, brand NO-list fail, Meta personal-attribute on ads, income guarantees ads-only, clean pass.

---

## Smoke-test checklist

- [ ] Open any piece → **Compliance** tab loads
- [ ] Clean confidante organic copy → local **pass**, score ≥ 85
- [ ] Hook with banned word (e.g. “thrive…mama”) → **fail**, brand issues listed
- [ ] Meta **ad** with “Are you a depressed single mom…” → personal-attr block
- [ ] **Fix what is safe** removes em dashes / `!` into edits; Preview updates
- [ ] **Run compliance agent** (with API key) returns score + model label
- [ ] **Fix with agent** writes hooks/caption/body and/or ad/email fields
- [ ] Ad piece: Edit shows primary/headline/description; Facebook preview shows them
- [ ] Email piece: Edit subject/preheader; Email preview shows them
- [ ] Refresh page → last agent scorecard still on review (if persisted)
- [ ] Without AI keys: local score still works; agent buttons error clearly

---

## Common failure modes

| Symptom | Likely cause |
|---------|----------------|
| Compliance tab missing | `ContentSheet` TABS / import not updated |
| Agent 501 / no key | Same as rewrite; check OpenAI/Anthropic keys |
| Fix with agent “no editable changes” | Model returned empty patch; check issues payload |
| Ad fix not in preview | `buildView` / FacebookPreview still read `piece.ad` only |
| Score wiped on save | `isEmptyReview` ignores `compliance` |
| Brand issues only, never platform | `kind` not `'ad'` or wrong platform pack |
| Double-count hooks | `effectivePiece` must blank legacy `hook` when using `hooks[]` |

---

## Quick copy strategy

1. Copy the **new files** list wholesale.
2. Diff-merge **patched** files (prefer this repo’s `review.ts`, `compliancePass.ts`, `ai/route.ts` compliance block, `CompliancePanel.tsx`).
3. Wire the Compliance tab in `ContentSheet`.
4. Run unit tests + smoke checklist.
5. No Vercel env change required if text AI already works.

---

## Out of scope

- Full Meta/TikTok Ads Manager API pre-flight
- Legal counsel sign-off / regulated health claims beyond heuristics
- Batch compliance over the whole hub calendar (single-piece only)
- Auto-block publish (score is advisory in the sheet)

Port those separately if needed.
