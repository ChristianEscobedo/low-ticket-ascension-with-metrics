// One-shot: port docs for the timeline resize + player-transport wave.
const fs = require('fs');

// 1. New port doc for this wave.
fs.writeFileSync(
  'docs/TIMELINE_RESIZE_AND_PLAYER_TRANSPORT_PORT.md',
  `# Timeline Resize + Player-Transport Playback — Port Doc

**Date:** 2026-08-21
**Scope:** Reel Studio timeline/preview — four fixes that together make the
RVE-style TimelineBoard feel native: the timeline play button is as smooth as
the Player's own, lottie cues play their FULL animation, lane hold-drags
persist, and the timeline/preview split is user-resizable.
**Commits:** 1363e35 (transport + lottie fit + hold persist) · the resize
splitter lands in the same wave.
**Tests:** tsc clean; no new runtime state to guard (all four are UI-side).

## 1. Remotion-mode play models the Player's own transport

**Problem.** Pressing play from the TIMELINE toolbar stuttered badly while the
Player's own play button was smooth. The page ran its rAF playback clock
(\`startClock\` → \`clockTick\` → setState + \`syncVideoToClock\` every frame)
ON TOP of the Remotion Player, which was already playing itself via the
\`playing\` prop — two clocks fighting.

**Fix.** In \`page.tsx\`, \`startClock\` and \`togglePlay\` short-circuit in
remotion preview mode (\`previewMode === 'remotion' && !stageIsBlob\`): they
just flip \`setPlaying\` and return. The Player owns playback; the playhead
still tracks via \`onPlayerFrame\` (already gated on \`p.isPlaying()\` for the
#185 fix). Pressing play at the end seeks to 0 first (replay-from-the-top).
\`RemotionPreview\` gained an \`onEnded\` prop — its frameupdate listener fires
it at \`plan.durationInFrames - 1\` so the transport stops at the end.

## 2. SafeLottie fits the animation into the cue window

**Problem.** A lottie cue played only the first beat of the animation: the cue
window (holdSec) was shorter than the lottie's own duration and nothing
re-timed it.

**Fix.** \`SafeLottie\` (in BOTH \`remotion-project/ReelComposition.tsx\` and
\`render-worker/remotion-project/ReelComposition.tsx\` — keep them mirrored)
takes a \`windowSec\` prop. After the JSON validates it reads \`ip\`/\`op\`/\`fr\`,
computes the lottie's own seconds, and sets \`playbackRate = lottieSec /
windowSec\` (rounded to 2dp) so the full animation lands inside the cue's
on-screen window. Usage:
\`<SafeLottie src={cue.src} style={mediaStyle} windowSec={cue.durationInFrames / fps} />\`.

## 3. Lane hold-drag persists (stale closure)

**Problem.** Dragging a media cue's right edge on its TimelineBoard lane
snapped back on pointerup — the new hold never saved.

**Fix.** Classic stale closure: the pointerup handler was bound at pointerdown
render time and saw \`liveHold === null\`. \`TimelineBoard.tsx\` now mirrors
\`liveHold\` into \`liveHoldRef\` on every render and the lane's \`onDragEnd\`
reads the ref, then calls \`onCueHold(id, held.hold)\` → \`patchCue\` →
\`saveMediaCues\` POST. Rule of thumb: ANY value a window-level pointerup
handler needs must come from a ref.

## 4. Timeline ⇄ preview resize splitter

**Ask.** "Reduce the size of the timeline / expand the preview."

**Fix.** The stage column is already
\`grid-rows-[auto_minmax(0,1fr)_auto]\` — the stage row is \`1fr\`, so it
absorbs whatever the timeline row gives up. The patch adds:

- \`const [timelineH, setTimelineH] = useState(0)\` (0 = auto, the layout
  default) and \`timelineBoxRef\` next to \`stageRef\` in \`page.tsx\`.
- A 6px \`cursor-row-resize\` splitter bar directly above the timeline box.
  Pointerdown captures \`startY\` + the box's \`offsetHeight\`, window-level
  pointermove sets
  \`timelineH = clamp(140, startH + (startY - clientY), 70vh)\`, pointerup
  removes the listeners. Double-click resets to auto.
- The timeline box becomes
  \`className={clsx('shrink-0 px-4 pb-4', timelineH > 0 && 'overflow-y-auto')}\`
  with \`style={timelineH > 0 ? { height: timelineH } : undefined}\`.

Drag UP for a taller timeline (smaller preview), DOWN for a bigger preview.
No persistence — it's a per-session comfort control.

## Carry-over checklist

1. \`page.tsx\`: the two transport short-circuits, the \`onEnded\` mount, the
   splitter + \`timelineH\`/\`timelineBoxRef\`.
2. \`RemotionPreview.tsx\`: \`onEnded\` prop + the last-frame fire.
3. \`TimelineBoard.tsx\`: \`liveHoldRef\` mirror + ref-read in \`onDragEnd\`.
4. Both \`ReelComposition.tsx\` copies: \`SafeLottie\` \`windowSec\` +
   \`playbackRate\`. Re-sync the vendored worker copy and rebuild the image.
`,
  'utf8',
);
console.log('ok    new port doc');

// 2. System port: prepend a latest-note blockquote under the title.
{
  const F = 'docs/REEL_STUDIO_SYSTEM_PORT.md';
  let s = fs.readFileSync(F, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const anchor = 'Reel Studio — System Port' + nl;
  const note =
    nl +
    '> **2026-08-21 (latest) — player-transport play + lottie fit + hold-drag' + nl +
    '> persist + a resizable timeline:** the timeline play button now just flips' + nl +
    '> the Player\'s `playing` prop in remotion mode (no more rAF clock fighting' + nl +
    '> the Player — the "timeline play is slow" fix); `SafeLottie` re-times itself' + nl +
    '> with `playbackRate` so the full animation fits the cue window; the lane' + nl +
    '> hold-drag reads a ref on pointerup so it actually saves; and a drag' + nl +
    '> splitter above the timeline trades height with the 1fr stage row (drag' + nl +
    '> down = bigger preview, double-click resets). Detail:' + nl +
    '> `docs/TIMELINE_RESIZE_AND_PLAYER_TRANSPORT_PORT.md`.' + nl;
  if (!s.includes(anchor)) throw new Error('system port anchor missing');
  if (s.includes('player-transport play + lottie fit')) {
    console.log('skip  system port (already noted)');
  } else {
    s = s.replace(anchor, anchor + note);
    fs.writeFileSync(F, s);
    console.log('ok    system port');
  }
}

// 3. Timeline UX port: append a section.
{
  const F = 'docs/REEL_STUDIO_TIMELINE_UX_PORT.md';
  let s = fs.readFileSync(F, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  if (s.includes('Player-transport playback + the resize splitter')) {
    console.log('skip  timeline ux port (already noted)');
  } else {
    s =
      s.replace(/\s+$/, '') +
      nl +
      nl +
      '## 2026-08-21 — Player-transport playback + the resize splitter' +
      nl +
      nl +
      '- **Timeline play = the Player\'s own play.** In remotion mode' +
      nl +
      '  `startClock`/`togglePlay` flip `playing` and return — the rAF clock no' +
      nl +
      '  longer runs on top of the Player (the stutter). `RemotionPreview` fires' +
      nl +
      '  `onEnded` at the last frame.' +
      nl +
      '- **Hold-drag persists.** `TimelineBoard` mirrors `liveHold` into a ref;' +
      nl +
      '  the window pointerup handler was reading a stale `null` closure.' +
      nl +
      '- **Resizable split.** A `cursor-row-resize` bar above the timeline sets' +
      nl +
      '  an explicit px height (`timelineH`, 0 = auto); the stage row is grid' +
      nl +
      '  `1fr` so the preview grows when the timeline shrinks. Double-click' +
      nl +
      '  resets. Clamped 140px…70vh.' +
      nl +
      nl +
      'Full write-up: `docs/TIMELINE_RESIZE_AND_PLAYER_TRANSPORT_PORT.md`.' +
      nl;
    fs.writeFileSync(F, s);
    console.log('ok    timeline ux port');
  }
}

// 4. RVE handoff: status line at the top.
{
  const F = 'docs/RVE_TIMELINE_REDESIGN_HANDOFF.md';
  let s = fs.readFileSync(F, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const anchor = '# RVE-style timeline redesign — handoff' + nl;
  if (s.includes('2026-08-21')) {
    console.log('skip  rve handoff (already noted)');
  } else {
    if (!s.includes(anchor)) throw new Error('rve anchor missing');
    s = s.replace(
      anchor,
      anchor +
        nl +
        '> **2026-08-21 status:** the board is live and at parity — per-type' +
        nl +
        '> lanes, drag/trim/hold, snapping, zoom, Media/Audio rails. This wave' +
        nl +
        '> fixed the last three papercuts: timeline play now drives the Player\'s' +
        nl +
        '> own transport (smooth), lottie cues play fully (`playbackRate` fit),' +
        nl +
        '> hold-drags persist (ref fix), and the timeline/preview split drags.' +
        nl +
        '> See `docs/TIMELINE_RESIZE_AND_PLAYER_TRANSPORT_PORT.md`.' +
        nl,
    );
    fs.writeFileSync(F, s);
    console.log('ok    rve handoff');
  }
}

// 5. Lottie port: append the playbackRate note.
{
  const F = 'docs/LOTTIE_MEDIA_CUES_PORT.md';
  let s = fs.readFileSync(F, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  if (s.includes('playbackRate')) {
    console.log('skip  lottie port (already noted)');
  } else {
    s =
      s.replace(/\s+$/, '') +
      nl +
      nl +
      '## 2026-08-21 — the full animation plays' +
      nl +
      nl +
      '`SafeLottie` now takes `windowSec` (the cue\'s on-screen window) and sets' +
      nl +
      '`playbackRate = lottieDuration / windowSec` from the JSON\'s `ip`/`op`/`fr`,' +
      nl +
      'so a 4s animation in a 1.5s cue plays through instead of cutting off.' +
      nl +
      'Both composition copies carry it — re-sync the vendored worker.' +
      nl;
    fs.writeFileSync(F, s);
    console.log('ok    lottie port');
  }
}

fs.writeFileSync('tmp-portdocs-result.txt', 'done', 'utf8');
