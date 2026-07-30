/**
 * One-shot wiring: add the Moonshot (Kimi) text provider to every text
 * generator. Applies exact, occurrence-asserted string edits to the 10
 * generator files that predate the provider (openai-email.ts was patched by
 * hand as the reference implementation). Idempotency is NOT guaranteed — run
 * once. Prints a per-file report and exits non-zero on any assertion miss.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'utils', 'integrations');

let failures = 0;

function apply(file, edits) {
  const full = path.join(DIR, file);
  const raw = fs.readFileSync(full, 'utf8');
  // Files on this checkout use CRLF; normalize to LF for matching and convert
  // back on write so the diff stays minimal.
  const crlf = (raw.match(/\r\n/g) || []).length > (raw.match(/(?<!\r)\n/g) || []).length;
  let src = raw.replace(/\r\n/g, '\n');
  for (const [name, search, replace, expected] of edits) {
    const count = src.split(search).length - 1;
    if (count === 0 && src.includes(replace)) {
      console.log(`skip ${file}: ${name} (already applied)`);
      continue;
    }
    if (expected === 'once' && count !== 1) {
      console.error(`FAIL ${file}: ${name} — expected exactly 1 match, found ${count}`);
      failures += 1;
      continue;
    }
    if (expected === 'some' && count < 1) {
      console.error(`FAIL ${file}: ${name} — expected >= 1 match, found 0`);
      failures += 1;
      continue;
    }
    src = src.split(search).join(replace);
    console.log(`ok   ${file}: ${name} (${count})`);
  }
  fs.writeFileSync(full, crlf ? src.replace(/\n/g, '\r\n') : src);
}

// ---------------------------------------------------------------------------
// Shared edit snippets
// ---------------------------------------------------------------------------

const IMPORT_EDIT = [
  'import getMoonshotKey',
  '  getAnthropicKey,\n',
  '  getAnthropicKey,\n  getMoonshotKey,\n',
  'once',
];

const BASE_EDIT = [
  'MOONSHOT_BASE const',
  "const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';\n",
  "const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';\nconst MOONSHOT_BASE = 'https://api.moonshot.cn/v1';\n",
  'once',
];

const DEFAULT_MODEL_EDIT = [
  'DEFAULT_MOONSHOT_TEXT_MODEL const',
  "const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';\n",
  "const DEFAULT_ANTHROPIC_TEXT_MODEL = 'claude-opus-4-8';\nconst DEFAULT_MOONSHOT_TEXT_MODEL = 'kimi-k3';\n",
  'once',
];

const SEQ_KEYS_EDIT = [
  'sequential keys + guard',
  '  const anthropicKey = await getAnthropicKey();\n  if (!openaiKey && !anthropicKey) {',
  '  const anthropicKey = await getAnthropicKey();\n  const moonshotKey = await getMoonshotKey();\n  if (!openaiKey && !anthropicKey && !moonshotKey) {',
  'once',
];

const PICK_TERNARY_EDIT = [
  'overridePick key ternary',
  "    const key = overridePick.provider === 'anthropic' ? anthropicKey : openaiKey;",
  "    const key =\n      overridePick.provider === 'anthropic'\n        ? anthropicKey\n        : overridePick.provider === 'moonshot'\n          ? moonshotKey\n          : openaiKey;",
  'once',
];

const PREF_SINGLE_EDIT = [
  'moonshot provider pref (single-line)',
  "  if (pref === 'openai' && openaiKey) {\n    return { ok: true, provider: 'openai', model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey };\n  }",
  "  if (pref === 'openai' && openaiKey) {\n    return { ok: true, provider: 'openai', model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey };\n  }\n  if (pref === 'moonshot' && moonshotKey) {\n    return { ok: true, provider: 'moonshot', model: overrideModel || DEFAULT_MOONSHOT_TEXT_MODEL, key: moonshotKey };\n  }",
  'once',
];

const PREF_MULTI_EDIT = [
  'moonshot provider pref (multi-line)',
  "  if (pref === 'openai' && openaiKey) {\n    return {\n      ok: true,\n      provider: 'openai',\n      model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL,\n      key: openaiKey,\n    };\n  }",
  "  if (pref === 'openai' && openaiKey) {\n    return {\n      ok: true,\n      provider: 'openai',\n      model: overrideModel || DEFAULT_OPENAI_TEXT_MODEL,\n      key: openaiKey,\n    };\n  }\n  if (pref === 'moonshot' && moonshotKey) {\n    return {\n      ok: true,\n      provider: 'moonshot',\n      model: overrideModel || DEFAULT_MOONSHOT_TEXT_MODEL,\n      key: moonshotKey,\n    };\n  }",
  'once',
];

const FALLBACK_SINGLE_EDIT = [
  'moonshot fallback (single-line)',
  "  if (anthropicKey) {\n    return { ok: true, provider: 'anthropic', model: DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };\n  }\n  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };",
  "  if (anthropicKey) {\n    return { ok: true, provider: 'anthropic', model: DEFAULT_ANTHROPIC_TEXT_MODEL, key: anthropicKey };\n  }\n  if (moonshotKey) {\n    return { ok: true, provider: 'moonshot', model: DEFAULT_MOONSHOT_TEXT_MODEL, key: moonshotKey };\n  }\n  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };",
  'once',
];

const FALLBACK_MULTI_EDIT = [
  'moonshot fallback (multi-line)',
  "  if (anthropicKey) {\n    return {\n      ok: true,\n      provider: 'anthropic',\n      model: DEFAULT_ANTHROPIC_TEXT_MODEL,\n      key: anthropicKey,\n    };\n  }\n  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };",
  "  if (anthropicKey) {\n    return {\n      ok: true,\n      provider: 'anthropic',\n      model: DEFAULT_ANTHROPIC_TEXT_MODEL,\n      key: anthropicKey,\n    };\n  }\n  if (moonshotKey) {\n    return {\n      ok: true,\n      provider: 'moonshot',\n      model: DEFAULT_MOONSHOT_TEXT_MODEL,\n      key: moonshotKey,\n    };\n  }\n  return { ok: true, provider: 'openai', model: DEFAULT_OPENAI_TEXT_MODEL, key: openaiKey! };",
  'once',
];

const FETCH_BASE_EDIT = [
  'moonshot fetch base',
  '    } else {\n      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {',
  '    } else {\n      // Kimi (Moonshot) speaks the OpenAI-compatible chat API on its own base.\n      const base = cfg.provider === \'moonshot\' ? MOONSHOT_BASE : OPENAI_BASE;\n      const res = await fetch(`${base}/chat/completions`, {',
  'once',
];

// TextConfig files with single-line pref/fallback formatting.
const SINGLE_LINE_FILES = ['openai-email-insights.ts', 'openai-leadgen.ts'];
for (const f of SINGLE_LINE_FILES) {
  apply(f, [
    IMPORT_EDIT,
    BASE_EDIT,
    DEFAULT_MODEL_EDIT,
    SEQ_KEYS_EDIT,
    PICK_TERNARY_EDIT,
    PREF_SINGLE_EDIT,
    FALLBACK_SINGLE_EDIT,
    FETCH_BASE_EDIT,
  ]);
}

// TextConfig files with multi-line pref/fallback formatting.
const MULTI_LINE_FILES = ['openai-sales.ts', 'openai-optin.ts'];
for (const f of MULTI_LINE_FILES) {
  apply(f, [
    IMPORT_EDIT,
    BASE_EDIT,
    DEFAULT_MODEL_EDIT,
    SEQ_KEYS_EDIT,
    PICK_TERNARY_EDIT,
    PREF_MULTI_EDIT,
    FALLBACK_MULTI_EDIT,
    FETCH_BASE_EDIT,
  ]);
}

// highticket: single-line formatting, Promise.all key load on one line.
apply('openai-highticket.ts', [
  IMPORT_EDIT,
  BASE_EDIT,
  DEFAULT_MODEL_EDIT,
  [
    'Promise.all keys + guard',
    '  const [openaiKey, anthropicKey] = await Promise.all([getOpenAiKey(), getAnthropicKey()]);\n  if (!openaiKey && !anthropicKey) {',
    '  const [openaiKey, anthropicKey, moonshotKey] = await Promise.all([getOpenAiKey(), getAnthropicKey(), getMoonshotKey()]);\n  if (!openaiKey && !anthropicKey && !moonshotKey) {',
    'once',
  ],
  PICK_TERNARY_EDIT,
  PREF_SINGLE_EDIT,
  FALLBACK_SINGLE_EDIT,
  FETCH_BASE_EDIT,
]);

// community: single-line formatting, Promise.all key load across lines.
apply('openai-community.ts', [
  IMPORT_EDIT,
  BASE_EDIT,
  DEFAULT_MODEL_EDIT,
  [
    'Promise.all keys + guard',
    '  const [openaiKey, anthropicKey] = await Promise.all([\n    getOpenAiKey(),\n    getAnthropicKey(),\n  ]);\n  if (!openaiKey && !anthropicKey) {',
    '  const [openaiKey, anthropicKey, moonshotKey] = await Promise.all([\n    getOpenAiKey(),\n    getAnthropicKey(),\n    getMoonshotKey(),\n  ]);\n  if (!openaiKey && !anthropicKey && !moonshotKey) {',
    'once',
  ],
  PICK_TERNARY_EDIT,
  PREF_SINGLE_EDIT,
  FALLBACK_SINGLE_EDIT,
  FETCH_BASE_EDIT,
]);

// ---------------------------------------------------------------------------
// Resolver-style generators (reel, youtube, compliance, content)
// ---------------------------------------------------------------------------

const AVAILABLE_EDIT_REEL = [
  'availableTextProvider moonshot',
  "  const [oa, an] = await Promise.all([getOpenAiKey(), getAnthropicKey()]);\n  const pref = preferred?.toLowerCase();\n  if (pref === 'anthropic' && an) return 'anthropic';\n  if (pref === 'openai' && oa) return 'openai';\n  if (an) return 'anthropic';\n  return 'openai';",
  "  const [oa, an, mo] = await Promise.all([getOpenAiKey(), getAnthropicKey(), getMoonshotKey()]);\n  const pref = preferred?.toLowerCase();\n  if (pref === 'anthropic' && an) return 'anthropic';\n  if (pref === 'openai' && oa) return 'openai';\n  if (pref === 'moonshot' && mo) return 'moonshot';\n  if (an) return 'anthropic';\n  if (oa) return 'openai';\n  if (mo) return 'moonshot';\n  return 'openai';",
  'once',
];

const PICKED_AWAIT_EDIT = [
  'picked key ternary',
  "      picked.provider === 'anthropic'\n        ? await getAnthropicKey()\n        : await getOpenAiKey();",
  "      picked.provider === 'anthropic'\n        ? await getAnthropicKey()\n        : picked.provider === 'moonshot'\n          ? await getMoonshotKey()\n          : await getOpenAiKey();",
  'once',
];

const OVERRIDE_PICKED_AWAIT_EDIT = [
  'overridePick key ternary',
  "      overridePick.provider === 'anthropic'\n        ? await getAnthropicKey()\n        : await getOpenAiKey();",
  "      overridePick.provider === 'anthropic'\n        ? await getAnthropicKey()\n        : overridePick.provider === 'moonshot'\n          ? await getMoonshotKey()\n          : await getOpenAiKey();",
  'once',
];

function openAiJsonProviderEdit(keyExpr) {
  return [
    'openAiJson provider-aware',
    'async function openAiJson(\n  system: string,\n  user: string,\n  model: string,\n): Promise<AiResult<string>> {\n  const key = ' + keyExpr + ';\n',
    'async function openAiJson(\n  system: string,\n  user: string,\n  model: string,\n  provider: TextProvider = \'openai\',\n): Promise<AiResult<string>> {\n  const moonshot = provider === \'moonshot\';\n  const key = moonshot ? await getMoonshotKey() : ' + keyExpr + ';\n',
    'once',
  ];
}

const OPENAI_FETCH_EDIT = [
  'openAiJson moonshot base',
  '    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {',
  '    const res = await fetch(`${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, {',
  'once',
];

const OPENAI_NOKEY_SINGLE_EDIT = [
  'openAiJson missing-key message',
  "  if (!key) return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };",
  "  if (!key) return { ok: false, status: 501, error: moonshot ? 'MOONSHOT_API_KEY is not configured' : 'OPENAI_API_KEY is not configured' };",
  'once',
];

const OPENAI_NOKEY_MULTI_EDIT = [
  'openAiJson missing-key message',
  "  if (!key)\n    return { ok: false, status: 501, error: 'OPENAI_API_KEY is not configured' };",
  "  if (!key)\n    return { ok: false, status: 501, error: moonshot ? 'MOONSHOT_API_KEY is not configured' : 'OPENAI_API_KEY is not configured' };",
  'once',
];

// --- reel -------------------------------------------------------------------
apply('openai-reel.ts', [
  IMPORT_EDIT,
  BASE_EDIT,
  DEFAULT_MODEL_EDIT,
  AVAILABLE_EDIT_REEL,
  PICKED_AWAIT_EDIT,
  OVERRIDE_PICKED_AWAIT_EDIT,
  [
    'default model ternary',
    '  const model =\n    provider === \'anthropic\'\n      ? DEFAULT_ANTHROPIC_TEXT_MODEL\n      : DEFAULT_OPENAI_TEXT_MODEL;',
    '  const model =\n    provider === \'anthropic\'\n      ? DEFAULT_ANTHROPIC_TEXT_MODEL\n      : provider === \'moonshot\'\n        ? DEFAULT_MOONSHOT_TEXT_MODEL\n        : DEFAULT_OPENAI_TEXT_MODEL;',
    'once',
  ],
  [
    'callTextJson dispatch',
    '  return provider === \'anthropic\'\n    ? anthropicJson(system, user, model)\n    : openAiJson(system, user, model);',
    '  return provider === \'anthropic\'\n    ? anthropicJson(system, user, model)\n    : openAiJson(system, user, model, provider);',
    'once',
  ],
  openAiJsonProviderEdit('await getOpenAiKey()'),
  OPENAI_NOKEY_SINGLE_EDIT,
  OPENAI_FETCH_EDIT,
]);

// --- youtube + compliance ---------------------------------------------------
for (const f of ['openai-youtube.ts', 'openai-compliance.ts']) {
  apply(f, [
    IMPORT_EDIT,
    BASE_EDIT,
    [
      'DEFAULT_MOONSHOT const',
      "const DEFAULT_ANTHROPIC = 'claude-opus-4-8';\n",
      "const DEFAULT_ANTHROPIC = 'claude-opus-4-8';\nconst DEFAULT_MOONSHOT = 'kimi-k3';\n",
      'once',
    ],
    AVAILABLE_EDIT_REEL,
    PICKED_AWAIT_EDIT,
    OVERRIDE_PICKED_AWAIT_EDIT,
    [
      'default model ternary',
      "    model: provider === 'anthropic' ? DEFAULT_ANTHROPIC : DEFAULT_OPENAI,",
      "    model:\n      provider === 'anthropic'\n        ? DEFAULT_ANTHROPIC\n        : provider === 'moonshot'\n          ? DEFAULT_MOONSHOT\n          : DEFAULT_OPENAI,",
      'once',
    ],
    openAiJsonProviderEdit('await getOpenAiKey()'),
    OPENAI_NOKEY_MULTI_EDIT,
    OPENAI_FETCH_EDIT,
    [
      'dispatch passes provider',
      ': await openAiJson(system, user, model);',
      ': await openAiJson(system, user, model, provider);',
      'some',
    ],
  ]);
}

// --- content ----------------------------------------------------------------
apply('openai-content.ts', [
  IMPORT_EDIT,
  BASE_EDIT,
  DEFAULT_MODEL_EDIT,
  [
    'moonshotKey wrapper',
    '/** Anthropic key: an enabled in-app integration wins, else ANTHROPIC_API_KEY. */\nasync function anthropicKey(): Promise<string | null> {\n  return getAnthropicKey();\n}\n',
    '/** Anthropic key: an enabled in-app integration wins, else ANTHROPIC_API_KEY. */\nasync function anthropicKey(): Promise<string | null> {\n  return getAnthropicKey();\n}\n\n/** Moonshot key for the Kimi text models (env-configured). */\nasync function moonshotKey(): Promise<string | null> {\n  return getMoonshotKey();\n}\n',
    'once',
  ],
  [
    'availableTextProvider moonshot',
    "  const [oa, an] = await Promise.all([apiKey(), anthropicKey()]);\n  const pref = preferred?.toLowerCase();\n  if (pref === 'anthropic' && an) return 'anthropic';\n  if (pref === 'openai' && oa) return 'openai';\n  if (an) return 'anthropic';\n  return 'openai';",
    "  const [oa, an, mo] = await Promise.all([apiKey(), anthropicKey(), moonshotKey()]);\n  const pref = preferred?.toLowerCase();\n  if (pref === 'anthropic' && an) return 'anthropic';\n  if (pref === 'openai' && oa) return 'openai';\n  if (pref === 'moonshot' && mo) return 'moonshot';\n  if (an) return 'anthropic';\n  if (oa) return 'openai';\n  if (mo) return 'moonshot';\n  return 'openai';",
    'once',
  ],
  [
    'textConfig overridePick ternary',
    "    const key =\n      overridePick.provider === 'anthropic'\n        ? await anthropicKey()\n        : await apiKey();",
    "    const key =\n      overridePick.provider === 'anthropic'\n        ? await anthropicKey()\n        : overridePick.provider === 'moonshot'\n          ? await moonshotKey()\n          : await apiKey();",
    'once',
  ],
  [
    'textConfig default model ternary',
    '  const model =\n    provider === \'anthropic\'\n      ? DEFAULT_ANTHROPIC_TEXT_MODEL\n      : DEFAULT_OPENAI_TEXT_MODEL;',
    '  const model =\n    provider === \'anthropic\'\n      ? DEFAULT_ANTHROPIC_TEXT_MODEL\n      : provider === \'moonshot\'\n        ? DEFAULT_MOONSHOT_TEXT_MODEL\n        : DEFAULT_OPENAI_TEXT_MODEL;',
    'once',
  ],
  [
    'resolveTextModel picked ternary',
    "    const key =\n      picked.provider === 'anthropic' ? await anthropicKey() : await apiKey();",
    "    const key =\n      picked.provider === 'anthropic'\n        ? await anthropicKey()\n        : picked.provider === 'moonshot'\n          ? await moonshotKey()\n          : await apiKey();",
    'once',
  ],
  openAiJsonProviderEdit('await apiKey()'),
  [
    'openAiRewrite provider-aware',
    'async function openAiRewrite(\n\n  system: string,\n  user: string,\n  model: string,\n): Promise<AiResult<string>> {\n  const key = await apiKey();\n',
    'async function openAiRewrite(\n\n  system: string,\n  user: string,\n  model: string,\n  provider: TextProvider = \'openai\',\n): Promise<AiResult<string>> {\n  const moonshot = provider === \'moonshot\';\n  const key = moonshot ? await moonshotKey() : await apiKey();\n',
    'once',
  ],
  OPENAI_NOKEY_SINGLE_EDIT.concat().slice(0, 3).concat(['some']),
  [
    'openAiJson/openAiRewrite moonshot base',
    '    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {',
    '    const res = await fetch(`${moonshot ? MOONSHOT_BASE : OPENAI_BASE}/chat/completions`, {',
    'some',
  ],
  [
    'dispatch passes provider (json)',
    ': await openAiJson(system, user, model);',
    ': await openAiJson(system, user, model, provider);',
    'some',
  ],
  [
    'dispatch passes provider (rewrite)',
    '    : openAiRewrite(system, user, model);',
    '    : openAiRewrite(system, user, model, provider);',
    'once',
  ],
]);

console.log(failures === 0 ? '\nAll Moonshot provider edits applied.' : `\n${failures} edit(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
