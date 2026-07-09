/**
 * Optional Google Sheets export via a service-account JWT.
 * Credentials: GOOGLE_SHEETS_CLIENT_EMAIL + GOOGLE_SHEETS_PRIVATE_KEY
 * (or a single GOOGLE_SERVICE_ACCOUNT_JSON blob). When unset, callers get a
 * clear "not configured" error so the UI can fall back to CSV download.
 */
export interface SheetsWriteResult {
  ok: true;
  spreadsheetId: string;
  url: string;
}

export type SheetsResult =
  | SheetsWriteResult
  | { ok: false; status: number; error: string };

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function readServiceAccount(): ServiceAccount | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      return null;
    }
  }
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (email && key) return { client_email: email, private_key: key };
  return null;
}

/** True when Sheets credentials are present in the environment. */
export function isGoogleSheetsConfigured(): boolean {
  return readServiceAccount() !== null;
}

/** Base64url without padding. */
function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}


/** Sign a JWT with the service-account private key (RS256). */
async function signJwt(
  sa: ServiceAccount,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  // Prefer Web Crypto when available (Node 19+ / edge); fall back to node:crypto.
  try {
    const crypto = await import('node:crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    sign.end();
    const sig = sign.sign(sa.private_key);
    return `${unsigned}.${b64url(sig)}`;
  } catch (err) {
    throw err;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const assertion = await signJwt(
    sa,
    'https://www.googleapis.com/auth/spreadsheets',
  );
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Token exchange ${res.status}`,
    );
  }
  return json.access_token;
}

/** Parse a CSV string into a 2D array of cell strings (RFC 4180-ish). */
export function parseCsvToGrid(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const s = csv.replace(/^\uFEFF/, '');
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || (ch === '\r' && s[i + 1] === '\n')) {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      i += ch === '\r' ? 2 : 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Trailing cell / row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop a final empty row produced by a trailing newline.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

/**
 * Create a new spreadsheet titled `title` and write the CSV grid into Sheet1.
 */
export async function createSpreadsheetFromCsv(
  title: string,
  csv: string,
): Promise<SheetsResult> {
  const sa = readServiceAccount();
  if (!sa) {
    return {
      ok: false,
      status: 503,
      error:
        'Google Sheets is not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).',
    };
  }

  try {
    const token = await accessToken(sa);
    const auth = { authorization: `Bearer ${token}` };

    const createRes = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({
          properties: { title: title.slice(0, 100) },
        }),
      },
    );
    const created = (await createRes.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !created.spreadsheetId) {
      return {
        ok: false,
        status: createRes.status,
        error: created.error?.message ?? `Sheets create ${createRes.status}`,
      };
    }

    const values = parseCsvToGrid(csv);
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    );
    if (!writeRes.ok) {
      const err = (await writeRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        ok: false,
        status: writeRes.status,
        error: err.error?.message ?? `Sheets write ${writeRes.status}`,
      };
    }

    const url =
      created.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}`;
    return { ok: true, spreadsheetId: created.spreadsheetId, url };
  } catch (err) {
    console.error('createSpreadsheetFromCsv failed', err);
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : 'Could not reach Google Sheets',
    };
  }
}
