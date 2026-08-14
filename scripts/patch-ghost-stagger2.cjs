#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

console.log('has ghostUnitOpacity', s.includes('ghostUnitOpacity'));
console.log('has __ghost', s.includes('__ghost'));
console.log('has word stagger', s.includes("staggerMode === 'word'"));
console.log('has letter stagger', s.includes("staggerMode === 'letter'"));
console.log('Array.from(text)', (s.match(/Array\.from\(text\)/g) || []).length);

// Fix gradient mark case if still missing display/filter
if (!s.includes("style.display = 'inline-block';\n      // text-shadow on transparent")) {
  const oldG = `case 'gradient': {
      style.backgroundImage = \`linear-gradient(92deg, \${fxColor}, \${mark.fxColor2 ?? '#ffffff'} 130%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`;
  const newG = `case 'gradient': {
      style.backgroundImage = \`linear-gradient(92deg, \${fxColor}, \${mark.fxColor2 ?? '#ffffff'} 130%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      style.display = 'inline-block';
      if (style.textShadow) {
        style.filter = \`drop-shadow(\${String(style.textShadow).split(',')[0].trim()})\`;
        delete style.textShadow;
      }
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`;
  if (s.includes(oldG)) {
    s = s.replace(oldG, newG);
    console.log('fixed gradient mark case');
  } else {
    console.log('gradient mark case already patched or different');
  }
}

// Inject letter stagger on bare {text} after marker span if missing
if (!s.includes("ghostMeta.staggerMode === 'letter'")) {
  // Find the default return's {text} that follows marker fx
  const re = /(\{mark\?\.fx === 'marker'[\s\S]*?\}\) : null\}\r?\n\s*)\{text\}(\r?\n\s*\{mark\?\.fx === 'underline')/;
  const m = s.match(re);
  if (!m) {
    console.log('marker-text-underline pattern not found, trying simpler');
    // try all bare {text} near emoji
    const re2 = /(\}\) : null\}\r?\n\s*)\{text\}(\r?\n\s*\{mark\?\.fx === 'underline')/;
    const m2 = s.match(re2);
    console.log('alt match', !!m2);
    if (m2) {
      const letterBranch = `ghostMeta && ghostMeta.staggerMode === 'letter'
                  ? Array.from(text).map((ch, li) => {
                      const unitIdx =
                        words
                          .slice(ghostMeta.pageFrom, idx)
                          .reduce((n, ww) => n + Array.from(ww.text).length, 0) + li;
                      const gOp = ghostUnitOpacity(
                        frame,
                        ghostMeta.pageStartFrame,
                        ghostMeta.pageEndFrame,
                        unitIdx,
                        ghostMeta.inF,
                        ghostMeta.outF,
                        ghostMeta.staggerFrames,
                      );
                      return (
                        <span key={li} style={{ display: 'inline-block', opacity: gOp }}>
                          {ch}
                        </span>
                      );
                    })
                  : text`;
      s = s.replace(re2, `$1${letterBranch}$2`);
      console.log('injected letter via alt');
    }
  } else {
    const letterBranch = `ghostMeta && ghostMeta.staggerMode === 'letter'
                  ? Array.from(text).map((ch, li) => {
                      const unitIdx =
                        words
                          .slice(ghostMeta.pageFrom, idx)
                          .reduce((n, ww) => n + Array.from(ww.text).length, 0) + li;
                      const gOp = ghostUnitOpacity(
                        frame,
                        ghostMeta.pageStartFrame,
                        ghostMeta.pageEndFrame,
                        unitIdx,
                        ghostMeta.inF,
                        ghostMeta.outF,
                        ghostMeta.staggerFrames,
                      );
                      return (
                        <span key={li} style={{ display: 'inline-block', opacity: gOp }}>
                          {ch}
                        </span>
                      );
                    })
                  : text`;
    s = s.replace(re, `$1${letterBranch}$2`);
    console.log('injected letter stagger');
  }
} else {
  console.log('letter stagger already in file');
}

// Also apply letter opacity path for karaoke fill / cascade is fine as-is.

fs.writeFileSync(p, s);
console.log('done');
