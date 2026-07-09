# Content export system

Export MotherMode hub content into planner-ready CSVs for **Metricool** and **GoHighLevel Social Planner** (basic + advanced), with optional **Google Sheets** upload.

## Where it lives

| Layer | Path |
|-------|------|
| Pure mappers | `src/lib/mothermode/content/export/` |
| UI | `src/components/mothermode/content/ExportPanel.tsx` |
| Client download | `src/components/mothermode/content/exportClient.ts` |
| Sheets API | `src/app/api/mothermode/content/export/route.ts` |
| Sheets client | `src/utils/integrations/google-sheets.ts` |
| Templates | `docs/Mtr_calendar_template.csv`, `docs/social-planner-basic-sample.csv`, `docs/social-planner-advance-sample.csv` |

## Targets

1. **Metricool** — single header row matching `Mtr_calendar_template.csv`. One row per piece; the piece’s platform flag is `true`.
2. **GHL Basic** — `postAtSpecificTime`, `content`, link, media columns.
3. **GHL Advanced** — two header rows (platform group + field names) matching the advance sample.

## Selection scopes

- Current hub filters  
- Selected pieces (checkboxes on cards while Export is open)  
- Weeks 1–12  
- Campaign months (1 = weeks 1–4, 2 = 5–8, 3 = 9–12)  
- Platforms  
- Date range + platforms (after week→date assignment)  
- All (social channels by default)

Email / blog / AEO are excluded unless “Include email / blog / AEO” is checked.

## Dates

Pieces use plan weeks 1–12. Export requires a **campaign start** date:

- Week N starts at `campaignStart + (N-1)×7 days`
- Posts in the same week are staggered (Mon/Wed/Fri-style slots + minute offsets)
- Default time of day is configurable (e.g. `10:00:00`)
- SavedVersion `scheduledFor` is preferred when present

## Media

Only absolute `http(s)` image/video URLs are written. Data URLs and relative `/public` paths are omitted; the panel reports how many rows are missing media.

## Google Sheets

CSV download always works client-side.

Sheets requires env (see `.env.example`):

- `GOOGLE_SHEETS_CLIENT_EMAIL` + `GOOGLE_SHEETS_PRIVATE_KEY`, or  
- `GOOGLE_SERVICE_ACCOUNT_JSON`

The service account needs the Google Sheets API enabled. The admin export route creates a new spreadsheet and appends the CSV grid.

## Tests

```bash
pnpm test tests/lib/content-export.test.ts
```
