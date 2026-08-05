import type { SeedArticle } from './helpers';
import { callout, chip, introBox, media, step } from './helpers';

/**
 * Reel Studio (the Clipping Studio) admin guides.
 *
 * Lives as its own seed module (like researchLab.ts) so video-editor docs don't
 * bloat the Content Hub group. Register it in index.ts.
 */
export const reelStudio: SeedArticle[] = [
  {
    slug: 'reel-studio-caption-transform-box',
    title: 'Move and resize captions with the transform box',
    category: 'Reel Studio',
    excerpt:
      'Drag the caption box to move it, pull a corner to resize the text — on either preview. The box hugs the caption text at any size, and what you drag is what renders into the MP4.',
    body: [
      introBox([
        ['What this is', 'The caption transform box: drag to move the captions, corner handles to resize them'],
        ['Where it lives', 'Reel Studio (/admin/reel-studio) — the stage, on both the Remotion and Edit previews'],
        ['Who it is for', 'Anyone placing and sizing burned-in captions'],
      ]),
      `<p>Once a scene has captions (hit ${chip('CC')} to transcribe it), a dashed box sits over the caption text on the stage. That box is the single way to place and size captions — it works identically on the true Remotion preview and on the Edit canvas, so you never lose it by switching views.</p>`,
      step(
        1,
        'Move the captions',
        `<p>Drag anywhere inside the box. It travels WITH your pointer (grab it off-centre and it stays off-centre — no jump), snaps to the centre and to the quarter marks when you land near them, and saves once when you let go. Arrow keys nudge by 1% (hold Shift for 5%) for pixel-perfect placement.</p>`,
      ),
      step(
        2,
        'Resize the text',
        `<p>Hover the box and four corner handles appear. Pull any corner away from the centre to grow the text, toward the centre to shrink it. The size readout shows the live value while you drag, and it saves once when you release. This writes the same <code>sizePx</code> the size slider writes — the two controls are one setting, not two.</p>`,
      ),
      step(
        3,
        'Trust what you see',
        `<p>The box is sized from the caption block itself — it widens and grows taller with the text, and it gets taller on multi-row presets. So the outline you position IS the outline the text occupies, and because placement and size are saved with the reel, the Remotion render burns the captions exactly where you left them.</p>`,
      ),
      callout(
        'tip',
        'Place for the platform',
        `<p>Keep captions clear of the platform chrome (the like/comment rail and the handle strip). Turn the platform lens on from the right setup rail to see exactly where the rail sits while you drag.</p>`,
      ),
      callout(
        'info',
        'The subtitle editor has room again',
        `<p>In the Captions tab, the subtitle word list keeps a comfortable minimum height and takes the largest share of the panel — the style gallery below it scrolls inside its own cap. Click a timecode to seek, click a word to edit it.</p>`,
      ),
      media('reel-studio-caption-transform-box', 'image', 'The caption transform box mid-resize on the stage.'),
    ].join('\n'),
    published: true,
    sortOrder: 10,
  },
  {
    slug: 'reel-studio-caption-effects-and-fly-ins',
    title: 'Caption effects, per-word styling, and image fly-ins',
    category: 'Reel Studio',
    excerpt:
      'Ghost page fades, the karaoke fill sweep, floating captions, one-off styling on a single word, and images that fly in when you say a word.',
    body: [
      introBox([
        ['What this is', 'The modern caption effects tier + word-triggered image fly-ins'],
        ['Where it lives', 'Reel Studio (/admin/reel-studio) — the Captions tab and the style gallery'],
        ['Who it is for', 'Anyone making Submagic/Opus-style captioned reels'],
      ]),
      `<p>Every effect in this guide renders identically in the preview and the exported MP4 — the stage and the render worker draw the same caption layer, so what you see really is what exports.</p>`,
      step(
        1,
        'Pick a modern look from the gallery',
        `<p>Five new presets: <strong>Ghost</strong> (each page of captions dissolves in and out smoothly), <strong>Floater</strong> (the caption block bobs gently), <strong>Fill Sweep</strong> (the spoken word fills with color left to right across its own timing — the Hormozi sweep), <strong>Sign On</strong> (neon sign flicker), and <strong>Cascade</strong> (letters type in one at a time). Pick them like any preset — position and size still come from the transform box.</p>`,
      ),
      step(
        2,
        'Style ONE word differently',
        `<p>A word can carry its own mark: its own animation, its own color (it keeps the color even when it is not the spoken word), a bigger scale for the shout beat, or its own per-letter cascade. The rest of the line keeps the preset. Marks save with the reel and survive the render untouched.</p>`,
      ),
      step(
        3,
        'Fly an image in when you say a word',
        `<p>In the Captions tab, hit ${chip('cue word')}. Words in the subtitle list turn violet — click one, then pick an image from the Media Library. That image flies in the moment the word is spoken and holds for a beat. Cued words keep a violet underline. Hit ${chip('auto')} to match your strong words against library image names and tags in one click.</p>`,
      ),
      callout(
        'tip',
        'Cues re-time themselves',
        `<p>Fly-ins are keyed to the word, not the clock. Trim or split the scene and the fly-in still lands on the word — if the word gets cut entirely, its cue goes with it, never stranded mid-frame.</p>`,
      ),
      callout(
        'info',
        'Keep fly-ins clear of the captions',
        `<p>Fly-ins enter at the upper right by design, so they read as b-roll, not as a second caption. If you moved captions to the top with the transform box, expect them to overlap — keep captions low when you use fly-ins heavily.</p>`,
      ),
      media('reel-studio-caption-effects-and-fly-ins', 'image', 'A Fill Sweep caption mid-sweep with an image flying in at the upper right.'),
    ].join('\n'),
    published: true,
    sortOrder: 20,
  },
];
