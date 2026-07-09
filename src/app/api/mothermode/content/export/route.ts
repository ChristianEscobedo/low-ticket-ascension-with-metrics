/**
 * Admin-only content export endpoint.
 *   POST { destination: 'sheets', title, csv, target? }
 *     -> create a Google Sheet from a prebuilt CSV (client already mapped rows).
 *   GET  -> { sheetsConfigured: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  createSpreadsheetFromCsv,
  isGoogleSheetsConfigured,
} from '@/utils/integrations/google-sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  return NextResponse.json({
    ok: true,
    sheetsConfigured: isGoogleSheetsConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const destination = typeof o.destination === 'string' ? o.destination : '';

  if (destination !== 'sheets') {
    return bad('Unsupported destination (use "sheets")');
  }

  const title =
    typeof o.title === 'string' && o.title.trim()
      ? o.title.trim()
      : 'MotherMode content export';
  const csv = typeof o.csv === 'string' ? o.csv : '';
  if (!csv.trim()) return bad('csv is required');

  const result = await createSpreadsheetFromCsv(title, csv);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({
    ok: true,
    url: result.url,
    spreadsheetId: result.spreadsheetId,
  });
}
