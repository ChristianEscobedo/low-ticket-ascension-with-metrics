# Compliance Agent System — Port Guide

MotherMode content hub **Compliance** tab: brand voice + platform ad-policy scoring, with local heuristics and an AI agent that can rewrite non-compliant fields into the piece edit store.

## What it does

1. **Local score (instant)** — brand NO-list / dashes / ALL CAPS via existing `compliance.ts`, plus platform claim heuristics (Meta, TikTok, Google/AEO, email, X, Pinterest). Ads weight platform higher; organic weights brand higher.
2. **AI agent score** — deeper judgment on the same copy + local issues; returns 0–100 score, grade (`pass` | `review` | `fail`), sub-scores, and issue list.
3. **Fix what is safe** — deterministic strip of dashes / `!` into `PieceEdits`.
4. **Fix with agent** — AI rewrite of blocked/warned fields into hooks, caption, body, ad primary/headline/description, email subject/preheader.

## Files to port

| Path | Role |
|------|------|
| `src/lib/mothermode/content/platformCompliance.ts` | Packs, heuristics, `scoreLocalCompliance`, policy brief |
| `src/lib/mothermode/content/compliancePass.ts` | `effectivePiece` / `complianceFixPatch` / `aiCompliancePatchToEdits` (ad + email fields) |
| `src/lib/mothermode/content/compliance.ts` | Brand engine (existing) |
| `src/lib/mothermode/content/review.ts` | `PieceEdits` ad/email fields; `StoredComplianceReport`; `PieceReview.compliance` |
| `src/utils/integrations/openai-compliance.ts` | Server agent: `scoreComplianceWithAgent`, `fixComplianceWithAgent` |
| `src/app/api/mothermode/ai/route.ts` | Actions `complianceScore`, `complianceFix` |
| `src/components/mothermode/content/aiClient.ts` | `aiComplianceScore`, `aiComplianceFix` |
| `src/components/mothermode/content/CompliancePanel.tsx` | UI tab |
| `src/components/mothermode/content/ContentSheet.tsx` | Compliance tab wiring + persist |
| `tests/lib/platform-compliance.test.ts` | Unit tests |

Export barrel: `src/lib/mothermode/content/index.ts` re-exports `platformCompliance` and `compliancePass`.

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
    "hook": "...",
    "hooks": ["..."],
    "caption": "...",
    "body": ["..."],
    "adPrimaryText": "...",
    "adHeadline": "...",
    "emailSubject": "..."
  }
}
```

Response: scorecard fields + `issues[]` + optional `local` baseline.

### `complianceFix`

Same `piece` + optional `issues[]`. Response:

```json
{
  "ok": true,
  "patch": { "hooks": [], "caption": "", "body": "", "adPrimaryText": "" },
  "changelog": ["..."],
  "model": "..."
}
```

## Grades

| Grade | Rule |
|-------|------|
| `pass` | score ≥ 85 and no blocks |
| `review` | 60–84 or warnings only |
| `fail` | score < 60 or any block |

## Platform packs

- **meta** — Facebook / Instagram (personal attributes, guarantees, sensational bait)
- **tiktok** — fear hooks, link spam
- **google** — blog / AEO clickbait
- **email** — fake Re:/Fwd:, urgency spam
- **x** / **pinterest** — core claim blocks

## Persistence

Scorecard snapshot lives on `PieceReview.compliance` (JSON in existing review row). No new migration.

## Env

Same text keys as the rest of the hub: `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` (plus admin runtime overrides).

## Tests

```bash
npx vitest run tests/lib/platform-compliance.test.ts
```
