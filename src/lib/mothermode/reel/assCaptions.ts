/**
 * ASS (Advanced SubStation Alpha) caption generation from Whisper words.
 *
 * WHY ASS AND NOT SRT
 * -------------------
 * SRT is plain text with timings — no styling, no per-word color. ASS gives
 * us karaoke tags (\k) so the current word sweeps with a highlight as it's
 * spoken (the Submagic look), plus force_style for the full font/size/color/
 * outline/background/position surface — the free ffmpeg equivalent of the
 * Basic VEED presets at $0.
 */
import type { ReelWord } from './types';

/** Style knobs for the burned captions (maps to ASS force_style fields). */
export interface AssCaptionStyle {
  /** ASS font name (must exist on the worker's fontconfig — Inter ships with ffmpeg-static). */
  fontName?: string;
  /** Font size in px at the video's resolution. */
  fontSize?: number;
  /** The base text color as #rrggbb (idle words). */
  color?: string;
  /** The karaoke sweep color as #rrggbb (the ACTIVE word). */
  sweepColor?: string;
  /** Outline color as #rrggbb. */
  outlineColor?: string;
  /** Outline width in px. */
  outline?: number;
  /** 1 = outline only, 3 = opaque box behind the text. */
  borderStyle?: 1 | 3;
  /** Where the captions sit: 2 = bottom-center, 5 = middle-center, 8 = top-center. */
  alignment?: 2 | 5 | 8;
  /** Uppercase everything (karaoke look). */
  upper?: boolean;
}

const DEFAULT_STYLE: Required<Omit<AssCaptionStyle, 'alignment' | 'borderStyle'>> & {
  alignment: number;
  borderStyle: number;
} = {
  fontName: 'Inter',
  fontSize: 18,
  color: '#ffffff',
  sweepColor: '#b88d57',
  outlineColor: '#000000',
  outline: 2,
  borderStyle: 3,
  alignment: 2,
  upper: true,
};

/** Escape ASS control characters in a word. */
function assEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '，').replace(/\{/g, '（').replace(/\}/g, '）');
}

/** Format seconds as ASS time h:mm:ss.cc. */
function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  const sec_ = Math.floor(s - h * 3600 - m * 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec_).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** A #rrggbb hex → ASS &HAABBGGRR (alpha first, then BGR). */
function assColor(hex: string, alphaHex = '00'): string {
  const h = hex.replace('#', '');
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H${alphaHex.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

/** Group Whisper words into caption lines (max ~5 words or ~2.5s per line). */
export function groupWordsIntoLines(words: ReelWord[], maxWords = 5, maxDurSec = 2.5): ReelWord[][] {
  const lines: ReelWord[][] = [];
  let cur: ReelWord[] = [];
  for (const w of words) {
    const dur = cur.length > 0 ? w.end - cur[0].start : 0;
    if (cur.length > 0 && (cur.length >= maxWords || dur > maxDurSec)) {
      lines.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/**
 * Build one ASS Dialogue line with karaoke \k tags: every word gets its own
 * \k(duration in centiseconds) so the active word sweeps with the sweep color
 * as it's spoken. The base text is the idle color; the \k tag moves the sweep.
 */
function dialogueLine(words: ReelWord[], upper: boolean): string {
  const start = words[0].start;
  const end = words[words.length - 1].end;
  const text = words
    .map((w) => {
      const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
      const word = upper ? w.word.toUpperCase() : w.word;
      return `{\\k${durCs}}${assEscape(word)}`;
    })
    .join(' ');
  return `Dialogue: 0,${assTime(start)},${assTime(end)},Karaoke,,0,0,0,,${text}`;
}

/**
 * Generate a full ASS subtitle file from Whisper words with karaoke sweep.
 *
 * The styles section declares the base look (idle words in `color`, outline,
 * box, position). The karaoke \k tags drive the sweep: the ACTIVE word shows
 * in `sweepColor` (SecondaryColour in ASS terms), everything else in `color`.
 */
export function buildAssCaptions(words: ReelWord[], style: AssCaptionStyle = {}): string {
  const s = { ...DEFAULT_STYLE, ...style };
  if (words.length === 0) return '';
  const lines = groupWordsIntoLines(words);
  const header = [
    '[Script Info]',
    'Title: MotherMode karaoke captions',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'PlayResX: 1080',
    'PlayResY: 1920',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // PrimaryColour = the ACTIVE (sweep) word; SecondaryColour = idle words.
    // ASS karaoke \k fills Primary over Secondary as time advances.
    `Style: Karaoke,${s.fontName},${s.fontSize},${assColor(s.sweepColor)},${assColor(s.color)},${assColor(s.outlineColor)},${assColor('#000000', '80')},-1,0,0,0,100,100,0,0,${s.borderStyle},${s.outline},0,${s.alignment},20,20,40,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...lines.map((line) => dialogueLine(line, s.upper)),
  ];
  return header.join('\n') + '\n';
}

/**
 * The force_style string for the ffmpeg `subtitles` filter — renders the
 * SAME look as the ASS file's Style line (so the burn matches the preview).
 * Kept as a convenience for callers that burn SRT instead of ASS.
 */
export function buildForceStyle(style: AssCaptionStyle = {}): string {
  const s = { ...DEFAULT_STYLE, ...style };
  return [
    `FontName=${s.fontName}`,
    `FontSize=${s.fontSize}`,
    `PrimaryColour=${assColor(s.color)}`,
    `OutlineColour=${assColor(s.outlineColor)}`,
    `BorderStyle=${s.borderStyle}`,
    `Outline=${s.outline}`,
    `Alignment=${s.alignment}`,
  ].join(',');
}
