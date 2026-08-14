#!/usr/bin/env node
/**
 * Place/Style must not change look until the user actually moves or styles.
 *
 * Bugs:
 * 1) startDrag writes pointer x/y on pointerdown → word jumps off the line
 * 2) Hit boxes use guessed captionLineLayout coords, not painted glyphs
 * 3) Click/select should never invent xPct/yPct
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function write(file, content, crlf) {
  fs.writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
}

// ── 1) captionLayer: tag painted words so the drag layer can measure them ─
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Tag the inline karaoke word span. Look for the common key={`w-${idx}`}
  if (!s.includes('data-caption-word=')) {
    // Inline path: the span/div that paints each karaoke word
    const oldKey = 'key={`w-${idx}`}';
    const neuKey = 'key={`w-${idx}`} data-caption-word={idx}';
    if (s.includes(oldKey)) {
      s = s.replace(oldKey, neuKey);
      console.log('tagged inline karaoke word');
    } else {
      // try double quotes
      const old2 = 'key={"w-" + idx}';
      if (s.includes('key={`cw-${idx}`}')) {
        s = s.replace('key={`cw-${idx}`}', 'key={`cw-${idx}`} data-caption-word={idx}');
        console.log('tagged cw- key');
      } else {
        // dump nearby word map
        const i = s.indexOf('words.map');
        console.log('words.map snippet', JSON.stringify(s.slice(i, i + 400)));
      }
    }

    // Abs overlay path — already has x/y; still tag so handles hug it
    if (s.includes('const x = mark!.xPct') && !s.includes('data-caption-word={idx}')) {
      // find the abs word element
      const abs = s.indexOf('const x = mark!.xPct');
      const tag = s.indexOf('key=', abs);
      console.log('abs key', JSON.stringify(s.slice(tag, tag + 80)));
    }
  }

  // Broader: any span that renders w.text in the karaoke row
  if (!s.includes('data-caption-word')) {
    // Try the typical Remotion word wrapper
    const hits = [];
    let idx = 0;
    while ((idx = s.indexOf('key={`', idx)) >= 0 && hits.length < 8) {
      hits.push(s.slice(idx, idx + 60));
      idx++;
    }
    console.log('keys', hits);
  }

  write(p, s, crlf);
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
}

// ── 2) WordDragLayer: no jump on click; measure real glyphs ───────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Replace startDrag so pointerdown only selects; move/commit only after 5px
  const oldDrag = `  const startDrag = (index: number, e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    onSelect(index);
    setDragging(true);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const { x, y } = clientToPct(e.clientX, e.clientY);
    lastRef.current = { index, x, y };
    (() => { const _s = snapPct(x, y); onMove(index, _s.x, _s.y); })();

    const onMoveEv = (ev: PointerEvent) => {
      const p = clientToPct(ev.clientX, ev.clientY);
      lastRef.current = { index, x: p.x, y: p.y };
      onMove(index, p.x, p.y);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setDragging(false);
      const last = lastRef.current;
      if (last && last.index === index) {
        onCommit(index, last.x, last.y);
      }
      lastRef.current = null;
    };
    el.addEventListener('pointermove', onMoveEv);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };`;

  const neuDrag = `  const startDrag = (index: number, e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    onSelect(index);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const originX = e.clientX;
    const originY = e.clientY;
    let armed = false;
    lastRef.current = null;

    const onMoveEv = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      if (!armed) {
        if (dx * dx + dy * dy < 25) return; // 5px — click ≠ move
        armed = true;
        setDragging(true);
      }
      const p = clientToPct(ev.clientX, ev.clientY);
      lastRef.current = { index, x: p.x, y: p.y };
      const snapped = snapPct(p.x, p.y);
      onMove(index, snapped.x, snapped.y);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setDragging(false);
      const last = lastRef.current;
      // Only commit if the user actually dragged. A click must not invent x/y.
      if (armed && last && last.index === index) {
        const snapped = snapPct(last.x, last.y);
        onCommit(index, snapped.x, snapped.y);
      }
      lastRef.current = null;
    };
    el.addEventListener('pointermove', onMoveEv);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };`;

  if (s.includes(oldDrag)) {
    s = s.replace(oldDrag, neuDrag);
    console.log('startDrag no longer jumps on click');
  } else if (s.includes('click ≠ move') || s.includes('click != move')) {
    console.log('startDrag already gated');
  } else {
    console.warn('startDrag block not exact');
    const i = s.indexOf('const startDrag');
    console.log(JSON.stringify(s.slice(i, i + 280)));
  }

  // Measure painted glyphs and overlay hit boxes on them
  if (!s.includes('data-glyph-hit')) {
    // Add a measured-rects state + effect after lastRef
    if (!s.includes('glyphBox')) {
      const hookAnchor = 'const [dragging, setDragging] = useState(false);';
      if (s.includes(hookAnchor)) {
        s = s.replace(
          hookAnchor,
          `const [dragging, setDragging] = useState(false);
  const [glyphBox, setGlyphBox] = useState<
    Record<number, { left: number; top: number; width: number; height: number }>
  >({});`,
        );
        console.log('glyphBox state');
      }
    }

    // Insert measure effect before return
    if (!s.includes('measureGlyphs') && s.includes('/* arrow-nudge */')) {
      s = s.replace(
        '  /* arrow-nudge */',
        `  /* hug painted glyphs — never guess a box from captionLineLayout */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const root = frame.parentElement;
    if (!root) return;
    const next: Record<number, { left: number; top: number; width: number; height: number }> = {};
    const fr = frame.getBoundingClientRect();
    for (const w of words) {
      const el = root.querySelector(
        \`[data-caption-word="\${w.index}"]\`,
      ) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[w.index] = {
        left: ((r.left - fr.left) / Math.max(1, fr.width)) * 100,
        top: ((r.top - fr.top) / Math.max(1, fr.height)) * 100,
        width: (r.width / Math.max(1, fr.width)) * 100,
        height: (r.height / Math.max(1, fr.height)) * 100,
      };
    }
    setGlyphBox(next);
  }, [words, selectedIndex]);

  /* arrow-nudge */`,
      );
      console.log('measureGlyphs effect');
    }

    // Use glyph box for hit target when present
    const oldBox = `        const baseW = Math.max(72, Math.min(220, 28 + w.label.length * 14));
        const baseH = 52;
        const boxW = baseW * sc;
        const boxH = baseH * sc;

        return (
          <div
            key={w.index}
            className="pointer-events-auto absolute"
            style={{
              left: \`\${w.xPct}%\`,
              bottom: \`\${w.yPct}%\`,
              width: boxW,
              height: boxH,
              transform: 'translate(-50%, 50%)',
              cursor: dragging && isSel ? 'grabbing' : 'grab',
              opacity: w.hidden ? 0.35 : 1,
            }}`;

    const neuBox = `        const g = glyphBox[w.index];
        const boxStyle: React.CSSProperties = g
          ? {
              left: \`\${g.left}%\`,
              top: \`\${g.top}%\`,
              width: \`\${Math.max(g.width, 4)}%\`,
              height: \`\${Math.max(g.height, 3)}%\`,
              transform: 'none',
            }
          : {
              left: \`\${w.xPct}%\`,
              bottom: \`\${w.yPct}%\`,
              width: Math.max(72, Math.min(220, 28 + w.label.length * 14)) * sc,
              height: 52 * sc,
              transform: 'translate(-50%, 50%)',
            };

        return (
          <div
            key={w.index}
            data-glyph-hit={g ? '1' : '0'}
            className="pointer-events-auto absolute"
            style={{
              ...boxStyle,
              cursor: dragging && isSel ? 'grabbing' : 'grab',
              opacity: w.hidden ? 0.35 : 1,
            }}`;

    if (s.includes(oldBox)) {
      s = s.replace(oldBox, neuBox);
      console.log('hit boxes hug glyphs');
    } else {
      console.warn('hit box block not exact');
    }
  }

  write(p, s, crlf);
}

// ── 3) captionLayer: tag BOTH paint paths ─────────────────────────────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Find word render keys more aggressively
  if (!s.includes('data-caption-word')) {
    // Common patterns in this file
    const patterns = [
      ['key={`w-${idx}`}', 'key={`w-${idx}`} data-caption-word={idx}'],
      ['key={`word-${idx}`}', 'key={`word-${idx}`} data-caption-word={idx}'],
      ['key={idx}', 'key={idx} data-caption-word={idx}'],
    ];
    let n = 0;
    for (const [a, b] of patterns) {
      if (s.includes(a)) {
        s = s.split(a).join(b);
        n++;
      }
    }
    console.log('tag replacements', n);
    if (!n) {
      // last resort: the span that contains {w.text}
      const i = s.indexOf('{w.text}');
      console.log('w.text context', JSON.stringify(s.slice(i - 200, i + 40)));
    }
  }

  write(p, s, crlf);
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
}

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        /WordDrag|captionLayer|glyphBox|data-caption-word|startDrag/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 12)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');
