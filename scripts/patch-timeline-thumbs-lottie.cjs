// Timeline thumbnails/names (RVE-style) + the MediaPanel lottie library.
const fs = require('fs');

function applyRules(file, rules) {
  let src = fs.readFileSync(file, 'utf8');
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  let failed = false;
  for (const [name, searchRaw, replaceRaw] of rules) {
    const search = nl === '\r\n' ? searchRaw.replace(/\n/g, '\r\n') : searchRaw;
    const replace = nl === '\r\n' ? replaceRaw.replace(/\n/g, '\r\n') : replaceRaw;
    const first = src.indexOf(search);
    const last = src.lastIndexOf(search);
    if (first < 0) {
      console.log('MISS  [' + file.split('/').pop() + '] ' + name);
      failed = true;
      continue;
    }
    if (first !== last) {
      console.log('DUP   [' + file.split('/').pop() + '] ' + name);
      failed = true;
      continue;
    }
    src = src.slice(0, first) + replace + src.slice(first + search.length);
    console.log('ok    [' + file.split('/').pop() + '] ' + name);
  }
  if (!failed) fs.writeFileSync(file, src);
  return !failed;
}

let ok = true;

// ================= TimelineBoard.tsx =================
ok =
  applyRules('src/app/(fullscreen)/admin/reel-studio/TimelineBoard.tsx', [
    [
      'mediaBlocks carry url + name',
      `      const kind = cue.lottie ? 'lottie' : cue.animated ? 'sticker' : 'image';
      return { id: cue.id, from, wordTo, hold, kind, label: w.word };`,
      `      const kind = cue.lottie ? 'lottie' : cue.animated ? 'sticker' : 'image';
      // The block shows the media's own thumbnail + filename (RVE-style) —
      // the trigger word moves to the tooltip.
      const name = cue.url.split('/').pop()?.split('?')[0]?.slice(0, 40) || kind;
      return { id: cue.id, from, wordTo, hold, kind, label: w.word, url: cue.url, name };`,
    ],
    [
      'media block thumb + name',
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-fuchsia-100">
                <Icon className="h-2.5 w-2.5 shrink-0 text-fuchsia-200" />
                {b.label}`,
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-fuchsia-100">
                {b.kind === 'lottie' ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-fuchsia-400/30">
                    <Icon className="h-2.5 w-2.5 text-fuchsia-200" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                )}
                <span className="truncate">{b.name}</span>`,
    ],
    [
      'media block tooltip carries the word',
      `              title={\`\${b.kind} fly-in on "\${b.label}" — click to seek · right edge = hold\`}`,
      `              title={\`\${b.name} — \${b.kind} fly-in on "\${b.label}" — click to seek · right edge = hold\`}`,
    ],
    [
      'captionBlocks carry a text preview',
      `      return { id: c.id, name: c.name, from: start + first, to: start + last, count: words.length };`,
      `      // RVE shows the caption's TEXT on the block — the first words.
      const preview = words
        .slice(0, 5)
        .map((x) => x.word)
        .join(' ');
      return { id: c.id, name: c.name, from: start + first, to: start + last, count: words.length, preview };`,
    ],
    [
      'caption block shows the preview',
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-sky-100">
                <MessageSquareText className="h-2.5 w-2.5 shrink-0 text-sky-200" />
                {b.count}w
              </span>`,
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-sky-100">
                <MessageSquareText className="h-2.5 w-2.5 shrink-0 text-sky-200" />
                <span className="truncate">{b.preview}</span>
                <span className="shrink-0 text-sky-200/60">{b.count}w</span>
              </span>`,
    ],
    [
      'overlay block thumb + name',
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-violet-100">
                <Layers className="h-2.5 w-2.5 shrink-0 text-violet-200" />
                {o.name}`,
      `              <span className="flex items-center gap-1 text-[8px] font-medium text-violet-100">
                {/\\.(jpe?g|png|webp|gif)(\\?|$)/i.test(o.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded">
                    <StripFrame url={o.url} t={0.5} className="h-full w-full object-cover" />
                  </span>
                )}
                <span className="truncate">{o.name}</span>`,
    ],
  ]) && ok;

// ================= MediaPanel.tsx =================
ok =
  applyRules('src/app/(fullscreen)/admin/reel-studio/MediaPanel.tsx', [
    [
      'import the lottie result type',
      `import type { PexelsClip } from '@/utils/integrations/pexels';`,
      `import type { PexelsClip } from '@/utils/integrations/pexels';
import type { LottieFileResult } from '@/utils/integrations/lottiefiles';`,
    ],
    [
      'lottie state',
      `  const lottieInput = useRef<HTMLInputElement>(null);`,
      `  const lottieInput = useRef<HTMLInputElement>(null);
  const [lottieQuery, setLottieQuery] = useState('');
  const [lottieResults, setLottieResults] = useState<LottieFileResult[] | null>(null);
  const [lottieBusy, setLottieBusy] = useState(false);
  const [myLotties, setMyLotties] = useState<{ url: string; name: string }[] | null>(null);`,
    ],
    [
      'uploadFile takes a kind',
      `  async function uploadFile(file: File): Promise<string | null> {`,
      `  async function uploadFile(file: File, kind: 'image' | 'lottie' = 'image'): Promise<string | null> {`,
    ],
    [
      'mint body carries the kind',
      `        body: JSON.stringify({ ext, contentType: file.type || undefined, kind: 'image' }),`,
      `        body: JSON.stringify({ ext, contentType: file.type || undefined, kind }),`,
    ],
    [
      'ingest body carries the kind',
      `            kind: 'image',
            source: 'upload',`,
      `            kind,
            source: 'upload',`,
    ],
    [
      'lottie uploads land as the lottie kind',
      `  async function uploadLottie(file: File) {
    setUpBusy(true);
    try {
      const url = await uploadFile(file);`,
      `  async function uploadLottie(file: File) {
    setUpBusy(true);
    try {
      const url = await uploadFile(file, 'lottie');`,
    ],
    [
      'lottie library functions',
      `  function attachLottieUrl() {
    const url = lottieUrl.trim();
    if (!/^https?:\\/\\//i.test(url)) return;
    onAttach(url, { lottie: true });
    setLottieUrl('');
  }`,
      `  function attachLottieUrl() {
    const url = lottieUrl.trim();
    if (!/^https?:\\/\\//i.test(url)) return;
    onAttach(url, { lottie: true });
    setLottieUrl('');
  }

  /** My lotties — the Media Library's lottie kind (+ legacy .json uploads). */
  async function loadLotties() {
    if (myLotties !== null) return;
    try {
      const res = await fetch('/api/admin/media-library', { cache: 'no-store' });
      const json = await res.json();
      const rows = (json.assets ?? json.records ?? []) as {
        url?: string;
        name?: string;
        kind?: string;
      }[];
      setMyLotties(
        rows
          .filter(
            (a) =>
              a.url && /^https?:\\/\\//i.test(a.url) && (a.kind === 'lottie' || /\\.json(\\?|$)/i.test(a.url)),
          )
          .map((a) => ({ url: a.url as string, name: a.name ?? '' })),
      );
    } catch {
      setMyLotties([]);
    }
  }

  async function searchLottie() {
    const q = lottieQuery.trim();
    if (!q || lottieBusy) return;
    setLottieBusy(true);
    try {
      const res = await fetch(\`/api/admin/reel-lottie?q=\${encodeURIComponent(q)}\`);
      const j = (await res.json()) as {
        success?: boolean;
        results?: LottieFileResult[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        onError(j.error || 'Lottie search failed.');
        setLottieResults([]);
        return;
      }
      setLottieResults(j.results ?? []);
    } catch {
      setLottieResults([]);
    } finally {
      setLottieBusy(false);
    }
  }

  /** A searched lottie attaches AND lands in My lotties (the library keeps it). */
  async function attachSearchedLottie(l: LottieFileResult) {
    onAttach(l.jsonUrl, { lottie: true });
    try {
      await fetch('/api/admin/media-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest',
          name: l.name.slice(0, 80),
          url: l.jsonUrl,
          kind: 'lottie',
          source: 'lottiefiles',
          tags: ['cue'],
        }),
      });
    } catch {
      /* convenience */
    }
    setMyLotties((prev) =>
      prev ? [{ url: l.jsonUrl, name: l.name }, ...prev.filter((a) => a.url !== l.jsonUrl)] : prev,
    );
  }`,
    ],
    [
      'lottie section: search + my lotties UI',
      `        <p className="text-[8px] leading-3 text-bone/30">
          A lottie plays its vector animation in the preview and burns into the MP4.
        </p>
      </Section>`,
      `        <p className="text-[8px] leading-3 text-bone/30">
          A lottie plays its vector animation in the preview and burns into the MP4.
        </p>
        {/* the lottie LIBRARY: search LottieFiles, or re-use your own */}
        <div className="flex items-center gap-1">
          <input
            value={lottieQuery}
            onChange={(e) => setLottieQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void searchLottie();
            }}
            placeholder="search the LottieFiles library (check, confetti…)"
            className="min-w-0 flex-1 rounded border border-fuchsia-400/25 bg-ink px-1.5 py-1 text-[9px] text-bone/80 outline-none placeholder:text-bone/25"
          />
          <button
            onClick={() => void searchLottie()}
            disabled={lottieBusy || !lottieQuery.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-fuchsia-400/40 px-1.5 py-1 text-[9px] font-semibold text-fuchsia-200/90 hover:bg-fuchsia-500/15 disabled:opacity-40"
          >
            {lottieBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            search
          </button>
        </div>
        {lottieResults && lottieResults.length > 0 && (
          <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto">
            {lottieResults.slice(0, 24).map((l) => (
              <button
                key={l.id}
                onClick={() => void attachSearchedLottie(l)}
                title={\`\${l.name} — lottie fly-in at the playhead (saved to My lotties)\`}
                className="overflow-hidden rounded border border-fuchsia-400/20 bg-[repeating-conic-gradient(#1c1c1c_0%_25%,#262626_0%_50%)] bg-[length:12px_12px] hover:border-fuchsia-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.imageUrl} alt={l.name} className="h-12 w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {myLotties === null ? (
          <button
            onClick={() => void loadLotties()}
            className="text-[10px] text-bone/40 hover:underline"
          >
            My lotties…
          </button>
        ) : myLotties.length > 0 ? (
          <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto">
            {myLotties.slice(0, 16).map((a) => (
              <button
                key={a.url}
                onClick={() => onAttach(a.url, { lottie: true })}
                title={\`\${a.name || a.url} — lottie fly-in at the playhead\`}
                className="flex h-12 items-center justify-center gap-0.5 rounded border border-fuchsia-400/20 bg-fuchsia-500/10 px-1 text-[8px] font-semibold text-fuchsia-200/80 hover:border-fuchsia-400"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.name || 'lottie'}</span>
              </button>
            ))}
          </div>
        ) : null}
      </Section>`,
    ],
  ]) && ok;

fs.writeFileSync('tmp-thumbs-result.txt', ok ? 'written' : 'NOT WRITTEN', 'utf8');
console.log(ok ? 'ALL WRITTEN' : 'SOME RULES FAILED');
