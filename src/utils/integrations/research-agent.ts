/**
 * Research Lab agent model layer: one provider-agnostic tool-calling contract
 * over Anthropic (native tool_use), OpenAI, and Moonshot (OpenAI-compatible
 * function calling). Same raw-fetch pattern as openai-content.ts — no SDK.
 *
 * The contract is deliberately small:
 *   callAgentModel({ system, messages, tools }) -> { text, toolCalls }
 *
 * `messages` is the internal transcript (user / assistant / tool). Prior turns
 * are sent as plain user+assistant text; the tool transcript lives only inside
 * the current turn, which keeps the history rebuild trivial and identical for
 * every provider.
 *
 * Also home to the web_search tool implementation: a one-shot provider call
 * with that provider's native search (Claude web_search tool / OpenAI
 * web_search_options), so the agent gets real citations without a third key.
 */
import {
  getOpenAiKey,
  getAnthropicKey,
  getMoonshotKey,
  getTextModelOverride,
  getTextProviderOverride,
} from './runtime-config';
import {
  getTextModel,
  type TextProvider,
} from '@/lib/mothermode/content/models';

const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MOONSHOT_BASE = 'https://api.moonshot.cn/v1';
const ANTHROPIC_VERSION = '2023-06-01';

const PROVIDER_DEFAULTS: Record<TextProvider, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-5.5',
  moonshot: 'kimi-k3',
};

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface AgentToolDef {
  name: string;
  description: string;
  /** JSON Schema object ({ type: 'object', properties: ... }). */
  inputSchema: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  /** Parsed arguments ({} on parse failure — the tool validates anyway). */
  input: Record<string, unknown>;
}

export type AgentMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AgentToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface AgentModelResult {
  text: string;
  toolCalls: AgentToolCall[];
  model: string;
  provider: TextProvider;
}

export type AgentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

async function keyFor(provider: TextProvider): Promise<string | null> {
  if (provider === 'anthropic') return getAnthropicKey();
  if (provider === 'openai') return getOpenAiKey();
  return getMoonshotKey();
}

const ALL_PROVIDERS: TextProvider[] = ['anthropic', 'openai', 'moonshot'];

/**
 * Provider candidates in preference order: the configured text_provider
 * override first (when valid), then anthropic → openai → moonshot. The list
 * is deduped; resolution picks the FIRST CANDIDATE THAT HAS A KEY, so a
 * provider override pointing at an unkeyed provider falls through instead of
 * killing the turn (the "auto routing doesn't work" bug).
 */
async function providerCandidates(): Promise<TextProvider[]> {
  const override = (await getTextProviderOverride()) as
    | TextProvider
    | undefined;
  const out: TextProvider[] = [];
  if (override === 'anthropic' || override === 'openai' || override === 'moonshot') {
    out.push(override);
  }
  for (const p of ALL_PROVIDERS) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Resolve the model to run: an explicit picker id wins (when keyed), then the
 * first keyed provider, using the configured model override when it belongs
 * to that provider, else the provider default. Null when nothing is keyed.
 */
export async function resolveAgentModel(model?: string): Promise<{
  provider: TextProvider;
  model: string;
  key: string;
} | null> {
  const explicit = getTextModel(model);
  if (explicit) {
    const key = await keyFor(explicit.provider);
    if (key) return { provider: explicit.provider, model: explicit.id, key };
    // An explicit pick with no key degrades to Auto rather than failing.
  }

  const overrideModel = await getTextModelOverride();
  const overrideOption = getTextModel(overrideModel);
  for (const provider of await providerCandidates()) {
    const key = await keyFor(provider);
    if (!key) continue;
    return {
      provider,
      model:
        overrideOption && overrideOption.provider === provider
          ? overrideOption.id
          : PROVIDER_DEFAULTS[provider],
      key,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Anthropic branch (tool_use)
// ---------------------------------------------------------------------------

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

function toAnthropicMessages(messages: AgentMessage[]): Array<{
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}> {
  const out: Array<{
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
  }> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
    } else {
      // Anthropic carries tool results as user-role tool_result blocks. Merge
      // consecutive results into one user turn, as the API requires.
      const block: AnthropicContentBlock = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: m.content,
      };
      const prev = out[out.length - 1];
      if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
        (prev.content as AnthropicContentBlock[]).push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }
  return out;
}

async function callAnthropic(opts: {
  key: string;
  model: string;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolDef[];
  maxTokens: number;
}): Promise<Response> {
  // An EMPTY tools array must be omitted entirely: Anthropic 400s on
  // `"tools": []` (the suggest/find intake engines call with no tools).
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: toAnthropicMessages(opts.messages),
  };
  if (opts.tools.length > 0) {
    body.tools = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
  const post = () =>
    fetch(`${ANTHROPIC_BASE}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': opts.key,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  let res = await post();
  // Anthropic's 529 "Overloaded" is transient capacity, not a real failure —
  // one delayed retry turns most of them into the answer the turn needed.
  if (res.status === 529) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    res = await post();
  }
  return res;
}

function parseAnthropic(json: any, model: string): AgentModelResult {
  const textParts: string[] = [];
  const toolCalls: AgentToolCall[] = [];
  for (const block of json?.content ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);
    } else if (block?.type === 'tool_use' && block.name) {
      toolCalls.push({
        id: typeof block.id === 'string' ? block.id : `call_${toolCalls.length}`,
        name: block.name,
        input:
          block.input && typeof block.input === 'object'
            ? (block.input as Record<string, unknown>)
            : {},
      });
    }
  }
  return {
    text: textParts.join('\n').trim(),
    toolCalls,
    model,
    provider: 'anthropic',
  };
}

// ---------------------------------------------------------------------------
// OpenAI / Moonshot branch (function calling)
// ---------------------------------------------------------------------------

function toOpenAiMessages(messages: AgentMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }));
      }
      out.push(msg);
    } else {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    }
  }
  return out;
}

async function callOpenAiCompatible(opts: {
  base: string;
  key: string;
  model: string;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolDef[];
  maxTokens: number;
}): Promise<Response> {
  const payload = (tokenField: 'max_tokens' | 'max_completion_tokens') => ({
    model: opts.model,
    [tokenField]: opts.maxTokens,
    messages: [
      { role: 'system', content: opts.system },
      ...toOpenAiMessages(opts.messages),
    ],
    // Empty tools list omitted: some OpenAI-compatible backends 400 on
    // `"tools": []` / a tool_choice with nothing to choose.
    ...(opts.tools.length > 0
      ? {
          tools: opts.tools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            },
          })),
          tool_choice: 'auto',
        }
      : {}),
  });
  const post = (body: unknown) =>
    fetch(`${opts.base}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  let res = await post(payload('max_tokens'));
  // GPT-5.x reasoning models reject `max_tokens`; retry once with the newer
  // field name. Cheap insurance against a provider-side rename.
  if (res.status === 400) {
    const text = await res.text().catch(() => '');
    if (/max_tokens|max_completion_tokens/i.test(text)) {
      res = await post(payload('max_completion_tokens'));
    } else {
      return new Response(text, { status: res.status, headers: res.headers });
    }
  }
  return res;
}

function parseOpenAi(json: any, model: string, provider: TextProvider): AgentModelResult {
  const message = json?.choices?.[0]?.message ?? {};
  const toolCalls: AgentToolCall[] = [];
  for (const tc of message.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(tc?.function?.arguments || '{}');
      if (parsed && typeof parsed === 'object') input = parsed;
    } catch {
      /* malformed args -> the tool's own validation reports the problem */
    }
    toolCalls.push({
      id: typeof tc?.id === 'string' ? tc.id : `call_${toolCalls.length}`,
      name: typeof tc?.function?.name === 'string' ? tc.function.name : '',
      input,
    });
  }
  return {
    text: typeof message.content === 'string' ? message.content.trim() : '',
    toolCalls: toolCalls.filter((tc) => tc.name),
    model,
    provider,
  };
}

// ---------------------------------------------------------------------------
// Token streaming (roadmap 0.2)
//
// When callAgentModel receives onTextDelta, the request streams: text
// deltas fire as they land, and the resolved result is identical to the
// non-streamed contract. A streamed response that fails on the network
// falls back to a normal request — streaming is an enhancement, never a
// new failure mode.
// ---------------------------------------------------------------------------

/** Read one SSE body, calling onEvent per parsed `data:` payload. */
async function readSse(
  res: Response,
  onEvent: (payload: any) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        onEvent(JSON.parse(data));
      } catch {
        /* a malformed frame is skipped, not fatal */
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    flush(decoder.decode(value, { stream: true }));
  }
}

/** Anthropic streamed call: text deltas out, full result assembled. */
async function callAnthropicStreamed(opts: {
  key: string;
  model: string;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolDef[];
  maxTokens: number;
  onTextDelta: (delta: string) => void;
}): Promise<AgentModelResult | null> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: toAnthropicMessages(opts.messages),
    stream: true,
  };
  if (opts.tools.length > 0) {
    body.tools = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': opts.key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const textParts: string[] = [];
  const toolUses = new Map<number, { id: string; name: string; json: string }>();
  await readSse(res, (event) => {
    if (event?.type === 'content_block_start') {
      const block = event.content_block;
      if (block?.type === 'tool_use') {
        toolUses.set(event.index, {
          id: typeof block.id === 'string' ? block.id : `call_${event.index}`,
          name: typeof block.name === 'string' ? block.name : '',
          json: '',
        });
      }
    } else if (event?.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        opts.onTextDelta(delta.text);
        textParts.push(delta.text);
      } else if (
        delta?.type === 'input_json_delta' &&
        typeof delta.partial_json === 'string'
      ) {
        const use = toolUses.get(event.index);
        if (use) use.json += delta.partial_json;
      }
    }
  });

  const toolCalls: AgentToolCall[] = [];
  const uses = Array.from(toolUses.entries()).sort((a, b) => a[0] - b[0]);
  for (const [, use] of uses) {
    let input: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(use.json || '{}');
      if (parsed && typeof parsed === 'object') input = parsed;
    } catch {
      /* malformed args -> the tool's own validation reports it */
    }
    toolCalls.push({ id: use.id, name: use.name, input });
  }
  return {
    text: textParts.join('').trim(),
    toolCalls: toolCalls.filter((tc) => tc.name),
    model: opts.model,
    provider: 'anthropic',
  };
}

/** OpenAI/Moonshot streamed call: content deltas out, full result assembled. */
async function callOpenAiStreamed(opts: {
  base: string;
  key: string;
  model: string;
  provider: TextProvider;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolDef[];
  maxTokens: number;
  onTextDelta: (delta: string) => void;
}): Promise<AgentModelResult | null> {
  const res = await fetch(`${opts.base}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: opts.system },
        ...toOpenAiMessages(opts.messages),
      ],
      ...(opts.tools.length > 0
        ? {
            tools: opts.tools.map((t) => ({
              type: 'function',
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              },
            })),
            tool_choice: 'auto',
          }
        : {}),
    }),
  });
  if (!res.ok) return null;

  const textParts: string[] = [];
  const chunks = new Map<number, { id: string; name: string; args: string }>();
  await readSse(res, (event) => {
    const delta = event?.choices?.[0]?.delta;
    if (typeof delta?.content === 'string' && delta.content) {
      opts.onTextDelta(delta.content);
      textParts.push(delta.content);
    }
    for (const tc of delta?.tool_calls ?? []) {
      const index = typeof tc?.index === 'number' ? tc.index : 0;
      const cur = chunks.get(index) ?? { id: '', name: '', args: '' };
      if (typeof tc?.id === 'string') cur.id = tc.id;
      if (typeof tc?.function?.name === 'string') cur.name = tc.function.name;
      if (typeof tc?.function?.arguments === 'string') {
        cur.args += tc.function.arguments;
      }
      chunks.set(index, cur);
    }
  });

  const toolCalls: AgentToolCall[] = [];
  const parts = Array.from(chunks.entries()).sort((a, b) => a[0] - b[0]);
  for (const [index, cur] of parts) {
    let input: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(cur.args || '{}');
      if (parsed && typeof parsed === 'object') input = parsed;
    } catch {
      /* malformed args -> the tool's own validation reports it */
    }
    toolCalls.push({
      id: cur.id || `call_${index}`,
      name: cur.name,
      input,
    });
  }
  return {
    text: textParts.join('').trim(),
    toolCalls: toolCalls.filter((tc) => tc.name),
    model: opts.model,
    provider: opts.provider,
  };
}

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

export async function callAgentModel(opts: {
  model?: string;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolDef[];
  maxTokens?: number;
  /** When set, the request streams and text deltas fire as they land (0.2). */
  onTextDelta?: (delta: string) => void;
}): Promise<AgentResult<AgentModelResult>> {
  const resolved = await resolveAgentModel(opts.model);
  if (!resolved) {
    return {
      ok: false,
      error:
        'No text model configured. Set an Anthropic or OpenAI key in /admin/integrations.',
      status: 503,
    };
  }
  const maxTokens = Math.max(
    1024,
    Math.min(16000, Math.round(opts.maxTokens ?? 8000)),
  );

  // Token streaming (0.2): when the caller wants deltas, try the streamed
  // lane first. A streamed failure falls back to the normal request —
  // streaming is an enhancement, never a new failure mode.
  if (opts.onTextDelta) {
    try {
      const base =
        resolved.provider === 'moonshot' ? MOONSHOT_BASE : OPENAI_BASE;
      const streamed =
        resolved.provider === 'anthropic'
          ? await callAnthropicStreamed({
              key: resolved.key,
              model: resolved.model,
              system: opts.system,
              messages: opts.messages,
              tools: opts.tools,
              maxTokens,
              onTextDelta: opts.onTextDelta,
            })
          : await callOpenAiStreamed({
              base,
              key: resolved.key,
              model: resolved.model,
              provider: resolved.provider,
              system: opts.system,
              messages: opts.messages,
              tools: opts.tools,
              maxTokens,
              onTextDelta: opts.onTextDelta,
            });
      if (streamed) return { ok: true, data: streamed };
    } catch {
      /* fall through to the normal lane */
    }
  }

  try {
    if (resolved.provider === 'anthropic') {
      const res = await callAnthropic({
        key: resolved.key,
        model: resolved.model,
        system: opts.system,
        messages: opts.messages,
        tools: opts.tools,
        maxTokens,
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          error:
            json?.error?.message ||
            `Anthropic request failed (${res.status})`,
          status: res.status,
        };
      }
      return { ok: true, data: parseAnthropic(json, resolved.model) };
    }

    const base =
      resolved.provider === 'moonshot' ? MOONSHOT_BASE : OPENAI_BASE;
    const res = await callOpenAiCompatible({
      base,
      key: resolved.key,
      model: resolved.model,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      maxTokens,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          json?.error?.message ||
          `${resolved.provider === 'moonshot' ? 'Moonshot' : 'OpenAI'} request failed (${res.status})`,
        status: res.status,
      };
    }
    return {
      ok: true,
      data: parseOpenAi(json, resolved.model, resolved.provider),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Agent request failed',
      status: 502,
    };
  }
}

// ---------------------------------------------------------------------------
// web_search — one-shot native search, whichever provider can answer
// ---------------------------------------------------------------------------

/**
 * Run a real web search and return a cited, compact answer. Prefers the
 * Anthropic native web_search tool; falls back to OpenAI's web_search_options
 * on the chat completions API. Returns a plain error string result when no
 * search-capable provider is configured — the agent treats it as "search
 * unavailable" and says so rather than hallucinating sources.
 */
export async function runWebSearch(query: string): Promise<AgentResult<string>> {
  const q = query.trim().slice(0, 400);
  if (!q) return { ok: false, error: 'query is required', status: 400 };

  // The configured model override applies only to the provider it belongs
  // to; each branch otherwise takes its own default.
  const overrideOption = getTextModel(await getTextModelOverride());
  const modelFor = (provider: TextProvider) =>
    overrideOption && overrideOption.provider === provider
      ? overrideOption.id
      : PROVIDER_DEFAULTS[provider];

  const anthropicKey = await getAnthropicKey();
  if (anthropicKey) {
    try {
      const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelFor('anthropic'),
          max_tokens: 2048,
          system:
            'You are a research assistant. Answer the query using web search. ' +
            'Be compact: key findings first, then sources as a short list of domains. ' +
            'No preamble, no filler.',
          messages: [{ role: 'user', content: q }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        const parts: string[] = [];
        for (const block of json?.content ?? []) {
          if (block?.type === 'text' && typeof block.text === 'string') {
            parts.push(block.text);
          }
        }
        const text = parts.join('\n').trim();
        if (text) return { ok: true, data: text };
      }
      // Fall through to OpenAI on provider errors — a failed search call must
      // not fail the turn.
    } catch {
      /* fall through */
    }
  }

  const openaiKey = await getOpenAiKey();
  if (openaiKey) {
    try {
      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${openaiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelFor('openai'),
          max_tokens: 2048,
          messages: [
            {
              role: 'system',
              content:
                'You are a research assistant. Answer using web search. Key ' +
                'findings first, then a short source-domain list. No filler.',
            },
            { role: 'user', content: q },
          ],
          web_search_options: { search_context_size: 'medium' },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = json?.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text.trim()) {
          return { ok: true, data: text.trim() };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return {
    ok: false,
    error:
      'Web search is unavailable: no Anthropic or OpenAI key is configured.',
    status: 503,
  };
}
