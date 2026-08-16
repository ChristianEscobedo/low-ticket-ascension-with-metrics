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
      callout(
        'tip',
        'Two entrances, one click each',
        `<p>A fly-in's motion row has two entrances built for the modern look. <strong>Slide up + tilt</strong> flies the image in from the bottom fast, then settles into a slight tilt (the lower-right lifts) — set the size to full width for the big image entrance. <strong>Sweep ←</strong> slides an icon or image in from the right edge moving left — set the layer to <strong>under text</strong> and it runs under the captions. Both render frame-exact in the preview and the MP4, and a transparent PNG/WebP icon (a logo, a checkmark) works with no extra setup.</p>`,
      ),
      media('reel-studio-caption-effects-and-fly-ins', 'image', 'A Fill Sweep caption mid-sweep with an image flying in at the upper right.'),
    ].join('\n'),
    published: true,
    sortOrder: 20,
  },
  {
    slug: 'reel-studio-caption-looks-rows-and-cards',
    title: 'Caption looks, phrase rows, and per-card grids',
    category: 'Reel Studio',
    excerpt:
      'The clean Accent Pop look, rows shaped by natural speech phrases, a per-card word grid, saving your own themes — and the house default.',
    body: [
      introBox([
        ['What this is', 'The caption look system: presets, phrase rows, per-card grids, and saved themes'],
        ['Where it lives', 'Reel Studio (/admin/reel-studio) — the Captions tab gallery + Customize'],
        ['Who it is for', 'Anyone dialing in the caption look and rhythm'],
      ]),
      `<p>The gallery is the look. Every tile is a live sample in the preset's own font and colors — click one and the canvas restyles instantly. The house default is <strong>Kelly Neon</strong> (a red gradient highlight with a soft glow, words that build and hold, and a gentle float). Everything below renders identically in the preview and the exported MP4.</p>`,
      step(
        1,
        'The clean modern look: Accent Pop',
        `<p><strong>Accent Pop</strong> is the light, modern end — white bold sans, ONE word lit in a bright accent color, a thin dark outline, and a soft drop shadow. Not the heavy outline of the Hormozi looks. It is the clean single-accent-word style that is performing right now.</p>`,
      ),
      step(
        2,
        'Phrase rows: the organic rhythm',
        `<p>Open ${chip('Customize')} and flip <strong>Phrase rows</strong> (under the words/rows steppers). Now each row is a natural speech phrase — it breaks on punctuation or a pause — instead of a fixed word count. A punchy one-word beat sits as its own row next to a four-word phrase: the organic, kinda-random rhythm, not a metronome grid of two-words-two-rows.</p>`,
      ),
      step(
        3,
        'A per-card grid: more words on certain cards',
        `<p>A phrase card (the ${chip('layers')} stack button on a subtitle line) now carries its OWN grid. With a card made, a small stepper appears on it — set that card's words-per-row and rows (the <code>Nw</code> / <code>Nr</code> steppers), independent of the reel-wide settings. A punchy 1-word card next to a 3-word card, on the same reel.</p>`,
      ),
      step(
        4,
        'Save your own themes',
        `<p>Dial in a look — preset + position, size, spacing, shadow, glow — and hit ${chip('Save as theme')} to name it. Saved themes show under <strong>Custom themes</strong> with a live visual; click one to apply it to any reel. The spacing dials go tighter than before (letters can nearly touch), and the drop shadow and outer glow each have a reach slider — how far they feather out, not just how strong.</p>`,
      ),
      callout(
        'tip',
        'Tweaking never restarts the video',
        `<p>Changing a caption setting no longer snaps the preview back to the beginning — the playhead holds while the look updates. And the gallery's selected tile always matches what the preview is showing.</p>`,
      ),
      callout(
        'info',
        'Hidden cards stay hidden',
        `<p>Muting a caption line (the ${chip('eye')} on a subtitle row), a phrase-card assignment, or a free-placed word position now survives a refresh — they save with the reel.</p>`,
      ),
      media('reel-studio-caption-looks-rows-and-cards', 'image', 'The caption gallery with the Customize panel open, Phrase rows on.'),
    ].join('\n'),
    published: true,
    sortOrder: 15,
  },
  {
    slug: 'reel-studio-caption-behind-speaker',
    title: 'Caption behind the speaker, the right-click word menu, and the free-place fix',
    category: 'Reel Studio',
    excerpt:
      'Remove a scene\'s background into a real layer you can drag and delete, then right-click any caption word to send it behind the subject. Plus: right-click a word for its full style menu, and a free-placed word now stays exactly where you put it.',
    body: [
      '## Caption behind the speaker',
      '',
      'The Clipping Studio removes a scene\'s background and stacks the subject cutout ABOVE the captions — the speaker occludes the words you send behind (the "caption behind the speaker" look).',
      '',
      '1. Open a reel with captions in /admin/reel-studio.',
      '2. In the subtitle panel, hit the per-row **Behind** button (right of the phrase text). The background is removed for JUST that line\'s timing — the bria model caps at 60s, so the card\'s span, not the whole clip, is what gets processed.',
      '3. The result lands as a **Cutout layer on the violet overlay lane** — a duplicate of the scene with the background removed. You see it on the timeline: drag to re-time it, × to remove it.',
      '4. **Right-click a caption word on the canvas → Behind the subject** to send that word UNDER the cutout. Every other word stays in front. Right-click again → Bring in front of the subject to undo.',
      '5. Render — the speaker occludes the behind words in the MP4.',
      '',
      'The model picker defaults to **bria** (the cost-effective option, mp4 + auto-zoom — the subject fills the frame). Pixelcut is the webm/alpha alternative.',
      '',
      '## The right-click word menu',
      '',
      'Right-click ANY caption word on the canvas (in Preview) to open its menu: **Free-place this word** (pin it where it sits, then drag it), **Remove placement** (it flows back into the caption row), **Behind the subject**, and the full per-word style editor — entrance, scale, color, FX (incl. gradient), ambient, font, hide. In Edit mode the same menu opens from the word\'s drag box.',
      '',
      '## The free-place precision fix',
      '',
      'A word you free-placed used to change size and position the moment you toggled fp off — Edit mode laid the words out in one row while Preview used the theme\'s rows, and the placed word painted at a thinner weight. Edit now renders the SAME rows as Preview/render and a placed word paints the full theme weight in both, so the placement + size persist exactly as you edited them — in the preview AND the exported MP4.',
      '',
      '**Edit shows just the words on screen.** Edit mode no longer scatters the whole caption card — it shows the same page of words as Preview. Tap the **all** pill on the Edit/Preview toggle to expand to every word on the card when you want the full set. The image fly-in drag box appears only while the image is actually on screen — click it to grab, move, and scale, and the ⚙ editor seeks right to it.',
    ].join('\n'),
    published: true,
    sortOrder: 16,
  },
];
