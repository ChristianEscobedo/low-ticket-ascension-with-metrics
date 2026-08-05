/**
 * Prompt bank, round 4: the TikTok half of the video-first round. (The
 * roadmap's round 3 landed in two halves: the YouTube half shipped in
 * promptBankRound3.ts; this is the TikTok half.) Ten TikTok script
 * frameworks (ttshort-) and six TikTok ad script frameworks (ttad-),
 * merged into PROMPT_RECIPES in promptBank.ts.
 *
 * Same contract as the earlier rounds: whyItWorks, a beat-structured {Slot}
 * template (timecoded for scripts), MotherMode-adapted exemplar openers, and
 * craft with explicit pacing and retention orders. Voice rules hold:
 * calibration after bold claims, no NO-list words, no em dashes, soft CTA
 * (direct-but-warm on the ad frameworks, where the click is earned). Scripts
 * execute through the existing video/reel format guides; nothing here
 * changes generator internals.
 *
 * Cross-post note: frameworks that travel between YouTube Shorts and TikTok
 * already carry tiktok platformNotes on the ytshort- recipes (loop-answer,
 * three-things, pov-system, myth-flip-15, story-loop, comment-bait,
 * micro-method, watch-twice). The ttshort- set below is deliberately
 * TikTok-native (Stitch, comment replies, green screen, voiceover, photo
 * mode) so no recipe is a near-duplicate of a cross-posted Short.
 */
import type { PromptRecipe } from './promptBank';

const F = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'framework', builtin: true });

/* ---------------------------------------------------------------------- */
/* TikTok scripts, round 4. TikTok-native viral and value structures for   */
/* the For You page: Stitch answers, comment replies, green screen         */
/* receipts, calm voiceovers, counters, quiet methods, and photo mode.     */
/* Timecoded beats, sound-off legibility and retention orders in the       */
/* craft.                                                                  */
/* ---------------------------------------------------------------------- */

export const PROMPT_RECIPES_ROUND4: PromptRecipe[] = [
  F({
    id: 'ttshort-stitch-answer',
    label: 'TT short: Stitch the question',
    hint: 'Her question on screen, your method as the answer',
    goal: 'replies',
    whyItWorks: [
      'A Stitch opens with a question the audience already asked, so the hook is borrowed interest that costs zero seconds to earn.',
      'Answering a real question with a real method positions the account as the help desk for this conversation, which turns viewers into commenters.',
      'Every Stitch surfaces to the source video\'s audience first, which is reach the For You page never has to approve.',
    ],
    template: [
      '[0:00] The Stitch card: {HerQuestion: the source clip asking the thing, trimmed to its shortest honest form}.',
      '[0:04] The reframe: {OneLineTake: the answer nobody gave her, stated plainly}.',
      '[0:08] The method: {TwoBeats: the how, one breath each, steps on screen as text}.',
      '[0:18] The receipt: {ProofBeat: what it changed, one line}.',
      '[0:22] Hand back: {QuestionBack: what would you add, asked straight to camera}.',
    ].join('\n'),
    exampleHooks: [
      '"How do you keep track of everything without losing your mind?" You do not keep track. You keep it somewhere else.',
      'She asked what a Sunday reset actually looks like. Here is the 20-minute version, both steps, no fluff.',
    ],
    craft: [
      'Under 30 seconds. Trim the source question to its shortest honest form; a long setup loses the room before you speak.',
      'Answer with a method, not an opinion: two beats of how, text on screen for the muted scroller, then one receipt. Calibrate the receipt (what it cost, what still does not work) in one clause.',
      'End by handing the thread back with a real question, then sit in the comments for the first hour. The thread is the second video.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    inputs: [
      {
        id: 'question',
        label: 'The question you are stitching',
        placeholder: 'How do you keep track of everything without losing your mind?',
        hint: 'the borrowed hook. Quote it fairly, trim it short',
        required: true,
      },
      {
        id: 'answer',
        label: 'Your answer in one line (the reframe)',
        placeholder: 'You do not keep track. You keep it somewhere else.',
        hint: 'the plain-spoken answer the method then proves',
      },
    ],
  }),

  F({
    id: 'ttshort-comment-reply',
    label: 'TT short: Comment reply',
    hint: 'The comment is the hook, the answer is the video',
    goal: 'replies',
    whyItWorks: [
      'A video reply to a real comment starts with proof the account listens, which is the strongest follow trigger on the platform.',
      'The comment card is the hook: the audience reads it in the first second, and reading time is retention.',
      'Answering one comment publicly invites a hundred more, and the reply queue becomes a self-filling content calendar.',
    ],
    template: [
      '[0:00] The comment card on screen: {TheComment: the real question or pushback, verbatim}.',
      '[0:02] Read it aloud, then the straight answer: {TheAnswer: one line, no warmup}.',
      '[0:08] The why: {TwoBeats: the mechanism or the story, one breath each}.',
      '[0:18] The calibration: {HonestLine: where it breaks, who it is not for}.',
      '[0:22] The invite: {NextQuestion: drop yours, I read every one}.',
    ].join('\n'),
    exampleHooks: [
      '"But who has 20 minutes on a Sunday?" Fair. Here is the 6-minute version and what to skip.',
      '"This only works if your partner helps." Let me show you the page that works even when nobody helps.',
    ],
    craft: [
      'Under 30 seconds. The comment card is frame one and it must be readable muted: verbatim, trimmed, never edited into a strawman.',
      'Answer first, explain second. The why gets two beats maximum, then one honest calibration line (where it breaks, who it is not for).',
      'Close by inviting the next question and mean it. Reply to early comments fast; reply videos to the best ones become the series.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    inputs: [
      {
        id: 'comment',
        label: 'The comment you are answering (verbatim)',
        placeholder: 'But who has 20 minutes on a Sunday?',
        hint: 'the hook card. Quote it exactly, never strawman it',
        required: true,
      },
    ],
  }),

  F({
    id: 'ttshort-green-screen-receipt',
    label: 'TT short: Green screen receipt',
    hint: 'You, in front of the proof',
    goal: 'shares',
    whyItWorks: [
      'Green screen puts the receipt full-frame behind you: the count, the page, the comment. The proof is the visual, and proof is the most shared currency on the platform.',
      'The format reads as show-and-tell instead of telling, which disarms the skepticism that kills advice content.',
      'Pointing at the receipt while it fills the screen creates a documentary feel that produced explainers cannot match at this length.',
    ],
    template: [
      '[0:00] The claim, spoken: {TheClaim: the thing that sounds too good, one line}.',
      '[0:03] Green screen up: {TheReceipt: the tally, the count, the page, the comment thread, full-frame behind you}.',
      '[0:06] Walk it: {TwoBeats: point at the two details that prove it, one breath each}.',
      '[0:16] What it means: {TheSoWhat: the one-line reframe for her}.',
      '[0:20] The how: {HandoffLine: where the method lives, one line}.',
    ].join('\n'),
    exampleHooks: [
      'This is every invisible task I did last Tuesday. Twenty-three before 9 am. Let me show you the list.',
      'Four Sundays, four ticked pages. Here is the system that finally survived Wednesday.',
    ],
    craft: [
      'Under 25 seconds. The receipt goes full-frame by second 3; talking without the proof on screen is wasted time here.',
      'Point at exactly two details. The receipt must be real and readable (a count, a tally, a ticked page), never a mockup that overclaims.',
      'Land the so-what as a reframe (the system, not her character), then one line on where the method lives. No hard sell; the proof is the pitch.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    platformNotes: {
      instagram: 'As a Reel: screen-record the receipt as b-roll instead of green screen, same beat order.',
    },
  }),

  F({
    id: 'ttshort-voiceover-reset',
    label: 'TT short: Voiceover reset',
    hint: 'Calm monologue over a real task',
    goal: 'follows',
    whyItWorks: [
      'A calm voiceover over real footage (the reset, the download, the Sunday table) is the platform\'s trusted essay format: intimate, low-production, impossible to fake.',
      'The task footage holds the eye while the monologue holds the heart, which is retention and resonance in one structure.',
      'Speaking gently about something true in a feed of shouting is a pattern interrupt that earns the follow for the voice itself.',
    ],
    template: [
      '[0:00] Footage starts mid-task: {TheTask: the Sunday download, the fridge page, the 9pm kitchen}. First line lands over it: {TheLine: the thought that frames everything}.',
      '[0:06] The monologue: {ThreeBeats: what this task used to be, what it is now, what it taught you, one breath each}.',
      '[0:24] The turn: {TheReframe: the system line, said quietly}.',
      '[0:28] The close: {PermissionLine: the sentence she saves the video for}.',
    ].join('\n'),
    exampleHooks: [
      'I used to call this hour the Sunday scaries. Now it takes 20 minutes and I do it with coffee.',
      'Nobody tells you the mental load has a sound. In our house it was the refrigerator door.',
    ],
    craft: [
      '25 to 35 seconds. Start the footage already moving (mid-task, never an establishing shot). The first spoken line lands within one second.',
      'Write the monologue like a letter: three beats, each one breath, no performance. The calm is the hook.',
      'End on the permission line, not a CTA. The follow is earned by the voice; a sales beat here breaks the spell.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttshort-day-count',
    label: 'TT short: The running count',
    hint: 'A day in the life, tallied on screen',
    goal: 'shares',
    whyItWorks: [
      'A counter ticking up on screen turns an ordinary day into evidence, and evidence is what she sends to the group chat.',
      'The rising number creates built-in suspense (how high does it go?) that holds retention to the final total.',
      'Counting the invisible makes it visible without a single complaint, which is the brand\'s whole argument in one device.',
    ],
    template: [
      '[0:00] The premise: {PremiseLine: I counted every {InvisibleThing} in one day}. Counter at 0 on screen.',
      '[0:03] The day, in beats: {FiveBeats: the form, the sock, the question, the appointment, the reminder, counter ticking up each time}.',
      '[0:20] The final number, held on screen: {TheTotal}.',
      '[0:24] The reframe: {ReframeLine: that is not a memory test, it is a job}.',
      '[0:28] The out: {HandoffLine: the page that holds the count now}.',
    ].join('\n'),
    exampleHooks: [
      'I counted every invisible task I did today. The number is on the screen. Watch it climb.',
      'Every decision I made before 9 am, counted. The total is the part nobody believed.',
    ],
    craft: [
      'Under 35 seconds. The counter is on screen from frame one and it ticks in rhythm with the beats, never faster than the eye can read.',
      'Pick 5 to 7 beats, each a concrete micro-task, escalating absurdity allowed but never invented. The number must be the real count.',
      'Hold the final total for a full second, then the reframe: the count is a workload, not a personality trait. One line on where it lives now, no harder.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    inputs: [
      {
        id: 'count',
        label: 'What you counted and the real total',
        placeholder: 'Every invisible task on a Tuesday: 23 before 9 am, 41 by dinner.',
        hint: 'the tally. The beats and the final number must stay true to it',
        required: true,
      },
    ],
  }),

  F({
    id: 'ttshort-stopped-doing',
    label: 'TT short: What I stopped doing',
    hint: 'The quit list, and what it gave back',
    goal: 'saves',
    whyItWorks: [
      'Quit lists outperform advice lists with this audience because permission to do less is the rarest content on her feed.',
      'Each stopped item is a micro-confession, and confessions are what she saves and sends with "us, always".',
      'Naming what came back (the hour, the calm, the Sunday) proves the gain was structural, not motivational, which is exactly the offer\'s logic.',
    ],
    template: [
      '[0:00] The promise: {PromiseLine: {N} things I stopped doing and what each one gave back}.',
      '[0:03] Stopped 1: {StoppedItem: the popular thing, and the gain, one line}.',
      '[0:08] Stopped 2: {StoppedItem: the one that surprises}.',
      '[0:13] Stopped 3: {StoppedItem: the hardest one to quit}.',
      '[0:18] Stopped 4: {StoppedItem: the smallest one, framed as the start}.',
      '[0:23] The pattern: {PatternLine: what replaced all of them, one line}.',
    ].join('\n'),
    exampleHooks: [
      '4 things I stopped doing around the house and what each one gave back. Number 2 started a fight. I won.',
      'I quit the weekly reset, the color-coded calendar, and the basket system. Here is what came back.',
    ],
    craft: [
      'Under 30 seconds. Four stops maximum, one beat each: the thing, then the gain, in a single line. Text on screen mirrors each item for the muted scroller.',
      'Every stopped item is a popular move, never a strawman, and every gain is concrete (the hour back, the calmer Sunday), never a vibe.',
      'Close with the pattern: one visible page and one weekly download replaced all of it. Calibration mandatory: this worked because the list moved out of her head, not because she tried harder.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttshort-quiet-method',
    label: 'TT short: The quiet method',
    hint: 'No talking, text carries the steps',
    goal: 'saves',
    whyItWorks: [
      'A no-talking video (hands, quiet audio, text on screen) is mute-native by design, which means it never loses the 80 percent who scroll silent.',
      'Watching a method happen calmly is proof no claim can match, and calm footage is the brand register.',
      'Text-led process videos get saved as references, and saves are the strongest quality signal the For You page reads.',
    ],
    template: [
      '[0:00] The scene, already moving: {TheTask: the table, the page, the pen}. Text card 1: {ThePromise: the 20-minute download, in 3 steps}.',
      '[0:04] Step 1 on screen: {StepOne: verb first}. Hands do it in frame.',
      '[0:10] Step 2 on screen: {StepTwo: the one everyone skips}. Hands do it.',
      '[0:16] Step 3 on screen: {StepThree: the lock-in}. Hands finish it.',
      '[0:22] Final card: {TheResult: what the table looks like now, and the one line to save this}.',
    ].join('\n'),
    exampleHooks: [
      'No talking, just the 20-minute download in 3 steps. Step 2 is the one everyone skips. Save this for Sunday.',
      'Watch the whole weekly system happen in 25 seconds, no sound needed. The page is the last frame.',
    ],
    craft: [
      'Under 30 seconds, zero spoken words. Quiet real audio (pen sounds, page turns, the kettle) carries the mood.',
      'Each text card is under 8 words and stays up long enough to read twice. Hands do the step while the card is up; the footage proves the text.',
      'The final card is the result plus the save invite. No CTA beyond that; the method is the pitch.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    platformNotes: {
      instagram: 'Cross-posts clean as a Reel: same mute-native build, caption repeats the 3 steps verbatim.',
    },
  }),

  F({
    id: 'ttshort-ranked-list',
    label: 'TT short: The ranked list',
    hint: 'Worst to winner, the order is the argument',
    goal: 'saves',
    whyItWorks: [
      'Ranking turns a list into a verdict, and verdicts hold retention because the audience stays to check the order against their own.',
      'Comment sections argue with rankings on autopilot, and the argument feeds distribution without a single baited word.',
      'A ranked structure lets the winner land last with full force, which is where the save happens.',
    ],
    template: [
      '[0:00] The premise: {PremiseLine: I tried every {PopularThing}. Ranked, worst to the one that stayed}.',
      '[0:04] Number 4: {RankItem: the popular one, and why it quietly fails}.',
      '[0:10] Number 3: {RankItem: better, still broken, one line why}.',
      '[0:16] Number 2: {RankItem: the one everyone loves, with its one fatal flaw}.',
      '[0:22] Number 1: {TheWinner: the one that stayed, and the receipt, one line}.',
      '[0:27] The invite: {DebateLine: fight me in the comments, warmly}.',
    ].join('\n'),
    exampleHooks: [
      'I tried every reset routine the internet sells. Ranked, worst to the one that survived a real Wednesday.',
      'Every calendar system I have owned, ranked. Number 2 is the one everyone loves. It is also why nothing worked.',
    ],
    craft: [
      'Under 35 seconds, four ranks maximum. One line per rank: what it is, then its flaw or win, never both.',
      'The order must be defensible: number 2 is beloved and its flaw is structural (it lives in her head, nobody else can see it), never personal.',
      'The winner lands with one receipt and no sales beat. Invite the debate warmly; the ranking is the engagement engine.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttshort-watch-me',
    label: 'TT short: Watch me do it',
    hint: 'The method in real time, one take',
    goal: 'follows',
    whyItWorks: [
      'A real-time run of the method (watch me do the download, watch me reset the week) is proof of ease that no edited explainer can fake.',
      'One-take honesty builds the parasocial trust that converts a viewer into a follower: she watched you actually do it.',
      'Process footage with light narration answers every "but how really" objection before it forms.',
    ],
    template: [
      '[0:00] The stake: {StakeLine: watch me do the full {Method} start to finish, no cuts on the work}. Timer on screen.',
      '[0:03] The work, narrated lightly: {ThreeBeats: what you are doing and why, as it happens}.',
      '[0:24] The finish: {TheResult: the filled page, the clear table, the timer stopped}.',
      '[0:28] The honest line: {Calibration: what still does not do itself}.',
      '[0:31] The follow reason: {NextOne: tomorrow I do the {NextMethod}, same timer}.',
    ].join('\n'),
    exampleHooks: [
      'Watch me do the entire Sunday download, real time, no cuts on the work. Timer is on. Twenty minutes is a lie, it takes eighteen.',
      'One take: the full week placed on one page before this coffee cools. Here we go.',
    ],
    craft: [
      '30 to 45 seconds, sped footage allowed on the work but never on the claim: say the real elapsed time and keep the timer honest on screen.',
      'Narrate lightly: three beats of what-and-why as it happens, no script-reading energy. Fumbles stay in; they are the proof.',
      'Close with the calibration (what the method does not do) and a concrete follow reason (the next run, named). The follow is the only ask.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttshort-photo-carousel',
    label: 'TT short: Photo mode essay',
    hint: 'One beat per frame, text carries the lesson',
    goal: 'saves',
    whyItWorks: [
      'Photo mode is TikTok\'s quiet heavyweight: frame-by-frame storytelling earns dwell time that video has to fight for, and dwell time is distribution.',
      'One beat per frame forces the essay discipline (every frame earns its place), which is why photo essays get saved at video-beating rates.',
      'Text on frames plus real photos reads as a letter from a friend, the exact register this brand owns.',
    ],
    template: [
      'Frame 1 (cover): {CoverLine: the promise or the confession, over the calmest photo}.',
      'Frame 2: {TheScene: the before, one line of text}.',
      'Frames 3 to 5: {TheBeats: the method or the story, one beat per frame, one line each}.',
      'Frame 6: {TheReceipt: the ticked page, the count, the calm table, one line}.',
      'Frame 7 (last): {TheLesson: the reframe} + {SaveLine: save this for Sunday}.',
    ].join('\n'),
    exampleHooks: [
      'The 20-minute Sunday download, frame by frame. Frame 4 is the step everyone skips.',
      'I photographed every invisible task in one Tuesday. Seven frames. The last one is the point.',
    ],
    craft: [
      '6 to 8 frames, one beat per frame, never two ideas in one photo. The cover frame must work alone: calm photo, one line, readable at feed size.',
      'Text per frame is one line, under 10 words, placed clear of the caption zone. Photos are real and quiet (the table, the page, the light), never stock energy.',
      'The last frame carries the lesson and the save line. Caption expands in two lines maximum; the frames already said it.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['slideshow', 'video'],
  }),

  /* ------------------------------------------------------------------ */
  /* TikTok ads, round 4. Spark-style native structures: the ad must     */
  /* survive as an organic post first, because on TikTok anything that   */
  /* reads as an ad gets scrolled. Hook inside 2 seconds, text on        */
  /* screen for the muted scroller, price in the CTA, and a comment-     */
  /* section plan in every craft block.                                  */
  /* ------------------------------------------------------------------ */

  F({
    id: 'ttad-spark-proof',
    label: 'TT ad: Spark proof post',
    hint: 'The winning organic shape, boosted',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Spark ads boost a real post, so the creative must survive as organic content first: the structures that win the For You page are the only structures worth paying for.',
      'Leading with the proof (the count, the ticked page, the comment thread) earns the first 3 seconds, which is where TikTok ad economics are decided.',
      'An ad with real comments underneath converts at a fraction of polished creative, because the thread is social proof the brand cannot buy separately.',
    ],
    template: [
      '[0:00] The organic hook: {TheClaim: the proof-first line the organic post would open with, text on screen}.',
      '[0:03] The receipt: {TheProof: the count, the ticked page, shown, not described}.',
      '[0:08] The method in 2 beats: {TheHow: what produces the receipt, one breath each}.',
      '[0:18] Brand window: {BrandLine: the name and what it is, one line, held on screen}.',
      '[0:22] The honest line: {Calibration: what it does not do}.',
      '[0:25] CTA: {Direct, warm: what it is, price, tap the link}.',
    ].join('\n'),
    exampleHooks: [
      'This page runs our whole house. Eleven thousand mothers have it on their fridge. It is $7, and here is exactly what is on it.',
      'Four Sundays, four ticked pages, zero 3 am remembering. The system is one page, and the link is right there.',
    ],
    craft: [
      'Write the organic post first: if the first 20 seconds could not win the For You page unpaid, do not spend on it. The CTA bolts on at the end, never before the proof.',
      'Proof on screen by second 3 (the count, the ticked page), brand named by second 20 in one line. Sound-off legible: text carries claim, proof, and price.',
      'CTA in the final 3 seconds with the price spoken and on screen. Comment plan: pin the receipt comment, answer the first hour fast, and let real questions become the next Spark candidates. Keep every claim calibrated: one receipt, no hype to walk back.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    inputs: [
      {
        id: 'post',
        label: 'The winning organic post to adapt',
        placeholder: 'The 20-minute Sunday download video: hook, the 2 beats that held retention, and its receipt.',
        hint: 'the proven shape. Keep its hook and proof, bolt the CTA on last',
        required: true,
      },
    ],
  }),

  F({
    id: 'ttad-ugc-testimonial',
    label: 'TT ad: UGC testimonial',
    hint: 'Mother to mother, receipts on screen',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A mother talking to mothers from her own kitchen is the only ad the For You page does not scroll past, because it pattern-matches as a recommendation, not a pitch.',
      'Receipts on screen while she talks (the ticked page, the before-after) fuse story and proof into one beat, the highest-converting combination in short-form.',
      'UGC-style testimonial ads retarget beautifully: warm viewers who saw the brand once convert on the human second touch.',
    ],
    template: [
      '[0:00] The confession open: {HerOpen: I did not think a page could fix this, in her words, text on screen}.',
      '[0:04] The before: {TheBefore: her Tuesday, one specific scene, 2 beats}.',
      '[0:12] The change: {TheChange: what she does now, with the receipt on screen: the ticked page, the count}.',
      '[0:22] The money line: {TheLine: the sentence she would say to a friend at pickup}.',
      '[0:26] Brand card + CTA: {What it is, price, where to tap}.',
    ].join('\n'),
    exampleHooks: [
      'I rolled my eyes at a $7 page. Then Sunday stopped hurting. Here is the exact page on our fridge.',
      'Two weeks in, my partner asked what changed. The change was one checklist. I will show you the whole thing.',
    ],
    craft: [
      'Cast the read as mother to mother: kitchen light, phone framing, first name only. Overproducing it kills the trust the format is built on, and on TikTok polish reads as an ad from frame one.',
      'Receipts on screen while she talks: the ticked page, the count, the before-after. The quote and the proof must land in the same beat. Every claim calibrated to the real receipt.',
      'Brand card and CTA in the final 4 seconds, price spoken and on screen. Comment plan: pin the receipt, seed no fake questions, and answer the skeptics warmly in the first hour.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
    inputs: [
      {
        id: 'testimonial',
        label: 'The testimonial (her words, 2-3 lines)',
        placeholder: 'Sunday stopped hurting in week one. The page lives on our fridge.',
        hint: 'the spoken spine, kept true to her words',
        required: true,
      },
      {
        id: 'receipts',
        label: 'The receipts to show on screen',
        placeholder: 'The ticked weekly page, 4 Sundays in a row.',
        hint: 'the proof beats during the change section',
      },
    ],
  }),

  F({
    id: 'ttad-native-problem',
    label: 'TT ad: Native problem-first',
    hint: 'Reads like the For You page, converts like an ad',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'On TikTok the ad filter is instant: anything that opens like an ad dies. Opening with her 11pm problem, in her words, buys the next 15 seconds.',
      'Problem-first ordering (problem, cost, fix) mirrors the platform\'s native storytelling, so the persuasion happens before the viewer registers sponsorship.',
      'A fix that is one page and one price converts without pressure: the ad can stay as calm as the organic content around it.',
    ],
    template: [
      '[0:00] The problem, in her words: {TheProblem: the 3 am remembering, the form in the trash, text on screen}.',
      '[0:03] The cost in 2 beats: {TheCost: what carrying it does to the week, one breath each}.',
      '[0:10] The fix, shown: {TheFix: the page, the download, the fridge, shown working}.',
      '[0:20] Brand window: {BrandLine: name and what it is, one line}.',
      '[0:24] The receipt: {ProofLine: one calibrated line}.',
      '[0:27] CTA: {Direct, warm: what it is, price, tap the link}.',
    ].join('\n'),
    exampleHooks: [
      'If your brain keeps a second calendar nobody can see, this is the page that finally holds it. $7, link is right there.',
      'The 3 am remembering is not a you problem. It is a systems problem, and the fix fits on one page.',
    ],
    craft: [
      'The first 2 seconds must name the problem in her exact words with text on screen. If the open could be an ad for anything, it fails.',
      'Agitate with specifics (the 3 am list, the forgotten form), never with fear or shame. Show the fix working, never described in adjectives. Brand named by second 20.',
      'CTA in the final 3 seconds, price included, direct and warm. Comment plan: pin the most-asked question with its answer, and let the thread pre-handle objections for the next viewer.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttad-demo-realtime',
    label: 'TT ad: The real-time demo',
    hint: 'Watch the system work, no cuts',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A demo answers "what is it exactly" better than any copy, and that question is the top objection for a $7 digital product.',
      'Watching the page get filled in real time creates ownership desire: she can picture her own Tuesday inside it.',
      'Process is proof: 30 honest seconds of the system working out-converts any amount of claims about it.',
    ],
    template: [
      '[0:00] The artifact, working: {ShowThePage: the system mid-use, one line on what we are watching, timer on screen}.',
      '[0:04] Step one: {StepOne: the download, narrated plainly, real time}.',
      '[0:12] Step two: {StepTwo: the sort, the moment it clicks}.',
      '[0:20] Step three: {StepThree: the placed week, the calm table}.',
      '[0:26] The receipt: {ProofLine, one line}.',
      '[0:28] CTA: {What it is, price, where to tap}.',
    ].join('\n'),
    exampleHooks: [
      'Watch one page replace forty open tabs in 30 seconds. Timer is on. No cuts on the work.',
      'This is the 20-minute Sunday download, the whole thing, honest timer. Stay for the calm table at the end.',
    ],
    craft: [
      'Open on the artifact working, never on a face introducing it. The first 3 seconds are the demo itself; on TikTok the product in action is the only hook an ad is allowed.',
      'Narrate in plain steps, one idea per beat, and keep the timer honest (sped footage is fine, a lying timer is not). Sound-off legible: step labels on screen.',
      'CTA in the final 3 seconds with price and link on screen. Comment plan: pin the what-is-it answer with the price, because the demo makes that the top question.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttad-comment-offer',
    label: 'TT ad: The genuine question',
    hint: 'The comments sell it, the CTA pins it',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A genuine question ad (would you use this? what is your version of this?) pulls real comments, and a busy comment section is the strongest conversion surface on TikTok.',
      'The thread does the selling: every answered question is an objection handled in public, which pre-converts the next scroller.',
      'Question ads read as community posts, not creative, so they earn organic-quality watch time at ad prices.',
    ],
    template: [
      '[0:00] The question, straight to camera: {TheQuestion: the genuine either-or or would-you, text on screen}.',
      '[0:04] Your answer first: {MyAnswer: honest, slightly exposing, 2 beats}.',
      '[0:14] The thing that prompted it: {TheContext: the page on the fridge, shown plainly, one line}.',
      '[0:22] The handoff: {HandoffLine: tell me yours in the comments}.',
      '[0:26] CTA: {Soft-direct: it is $7, link is there if Sunday needs it}.',
    ].join('\n'),
    exampleHooks: [
      'Honest question: what is the one invisible task in your house that would stop the week if you quit doing it? I will show you mine. It is the reason this page exists.',
      'Would you trust one page to run your whole week? I did not either. Here is what changed my answer.',
    ],
    craft: [
      'The question must be genuine and specific (the forms, the 3 am list), never engagement bait, and you answer it first, slightly exposed. The product appears as context, not as the point.',
      'Sound-off legible: the question is on screen from frame one. Keep the whole ad under 30 seconds and let the handoff breathe; the comments are the second act.',
      'CTA stays soft-direct with the price in it, final 3 seconds. Comment plan is the strategy: answer every question in the first hour, pin the receipt, and harvest the best comments as the next creative.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),

  F({
    id: 'ttad-offer-stack',
    label: 'TT ad: The $7 stack',
    hint: 'Everything she gets, item by item',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Listing everything she gets, item by item, against one tiny price reframes the purchase as arithmetic, and arithmetic survives the skepticism that kills adjectives.',
      'The stack format is native list content on TikTok: one deliverable per beat, text on screen, the pile growing. It holds watch time because each beat adds value.',
      'Warm audiences who already know the brand convert on the stack because the only question left is value, and the stack is the value, shown.',
    ],
    template: [
      '[0:00] The anchor: {AnchorLine: everything in {TheOffer}, for less than the coffee that went cold, text on screen}.',
      '[0:04] Item 1: {Deliverable: named, concrete, shown}.',
      '[0:09] Item 2: {Deliverable}.',
      '[0:14] Item 3: {Deliverable}.',
      '[0:19] The bonus: {TheBonus: the unexpected extra}.',
      '[0:24] The math: {TheMath: all of it for $7, one line}.',
      '[0:27] CTA: {Direct, warm: tap the link, it is on your fridge by Sunday}.',
    ].join('\n'),
    exampleHooks: [
      'Everything in the Sunday system, item by item, for $7. The page, the download guide, the fridge version, and the thing nobody expects.',
      'This is the whole stack. One page, three guides, the setup, and the bonus checklist. $7 total. The link is right there.',
    ],
    craft: [
      'One deliverable per beat, named and concrete, shown on screen or held in frame. Never "and more". The bonus lands last in the stack, right before the price.',
      'Anchor before the price ever appears: the stack builds value first so the $7 lands as arithmetic, not as a claim. Sound-off legible throughout.',
      'CTA direct and warm with the price spoken and on screen, final 3 seconds. Comment plan: pin the what-do-you-get recap, and answer the is-it-physical question first, it always comes.',
    ].join(' '),
    platforms: ['tiktok'],
    formats: ['video', 'reel'],
  }),
];
