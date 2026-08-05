/**
 * Prompt bank, round 3: the YouTube round. Eight Shorts script frameworks
 * (ytshort-), eight long-form script frameworks (ytlong-), and six YouTube
 * ad script frameworks (ytad-), merged into PROMPT_RECIPES in promptBank.ts.
 *
 * Same contract as the earlier rounds: whyItWorks, a beat-structured {Slot}
 * template (timecoded for scripts), MotherMode-adapted exemplar openers, and
 * craft with explicit pacing and retention orders. Voice rules hold:
 * calibration after bold claims, no NO-list words, no em dashes, soft CTA
 * (direct-but-warm on the ad frameworks, where the click is earned). Scripts
 * execute through the existing reel/long format guides and the videoScript
 * action; nothing here changes generator internals.
 */
import type { PromptRecipe } from './promptBank';

const F = (
  r: Omit<PromptRecipe, 'group' | 'builtin'>,
): PromptRecipe => ({ ...r, group: 'framework', builtin: true });

/* ---------------------------------------------------------------------- */
/* YouTube Shorts, round 3. Viral and value script structures for the      */
/* vertical feed: loops, rapid lists, POV, genuine questions, and dense    */
/* micro-value. Timecoded beats, retention orders in the craft.            */
/* ---------------------------------------------------------------------- */

export const PROMPT_RECIPES_ROUND3: PromptRecipe[] = [
  F({
    id: 'ytshort-loop-answer',
    label: 'YT Short: Loop answer',
    hint: 'Question cold-open, answer in the final seconds',
    goal: 'shares',
    whyItWorks: [
      'A question as the first frame stops the scroll because the brain refuses to leave a question open, and the answer arriving in the final seconds pays the wait off.',
      'Ending exactly where the loop restarts doubles watch time: the opening question replays as the answer lands, and the second pass confirms it.',
      'Looped Shorts get distributed as if two people watched, which is the cheapest reach multiplier on the platform.',
    ],
    template: [
      '[0:00] Cold open on the question, spoken verbatim: {HerQuestion: the exact thing she asks herself at 11pm}?',
      '[0:03] The stakes in one line: {WhyTheAnswerMatters: what it costs her to not know}.',
      '[0:06] Build: {TwoBeats: the wrong answers she has tried, one breath each}.',
      '[0:12] The turn: {SetupLine: the sentence that aims at the answer}.',
      '[0:15 to 0:18] The answer, plainly: {TheAnswer: one line, no warmup}.',
      '[Loop point] Cut back to frame one so the question replays as the end card.',
    ].join('\n'),
    exampleHooks: [
      'Where does the mental load actually go when you write it down? Stay for the last three seconds.',
      'Why does the week fall apart by Wednesday, every single week?',
    ],
    craft: [
      'Total runtime 15 to 20 seconds. The question is the first frame and the last beat, so the loop reads as one continuous thought.',
      'Two build beats maximum, one breath each. Cut any sentence that does not raise the value of the answer.',
      'The answer must be complete and honest on its own: never "follow for part 2". Retention order: if the answer does not land before the loop restarts, the script fails.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Cross-posts clean: keep the question as the first-frame text and let the loop restart carry the rewatch.',
      instagram: 'As a Reel: same loop, and the caption repeats the question for the muted scroller.',
    },
  }),

  F({
    id: 'ytshort-three-things',
    label: 'YT Short: Three things',
    hint: 'Rapid 3-item list, one beat per item',
    goal: 'saves',
    whyItWorks: [
      'A numbered promise in the first second sets a contract the viewer finishes: three is short enough to stay and specific enough to save.',
      'One beat per item keeps the pace relentless, which holds retention past the 80 percent mark where Shorts distribution is decided.',
      'Lists of three get saved as checklists, and saves are the strongest quality signal a Short can send.',
    ],
    template: [
      '[0:00] The promise: {PromiseLine: 3 things that {Outcome}, said in one breath}.',
      '[0:02] Thing 1: {Item: name it, then one line on running it}.',
      '[0:07] Thing 2: {Item: the one she has not heard}.',
      '[0:12] Thing 3: {Item: the smallest one, framed as the start}.',
      '[0:17] Close: {OneLineClose: which one to do tonight}.',
    ].join('\n'),
    exampleHooks: [
      '3 things on our fridge that ended the 3 am remembering. Number 2 is the one nobody believes.',
      'Three rules that run our whole week. Each takes under 20 minutes. Total.',
    ],
    craft: [
      'Under 25 seconds. Promise in the first breath, then three beats of 4 to 5 seconds each, one idea per beat.',
      'Item 2 is the surprise; item 3 is the smallest and the most doable tonight. Never pad an item to hit three.',
      'Close with the single action for tonight, not a summary. The overlay carries the numerals on screen; the script never says "number one".',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Native shape on TikTok: hold one beat per item and let on-screen numerals carry the count.',
      instagram: 'As a Reel: caption lists the three items in one line each so the save works muted.',
    },
  }),

  F({
    id: 'ytshort-pov-system',
    label: 'YT Short: POV, the system',
    hint: 'Punch at systems, never people',
    goal: 'shares',
    whyItWorks: [
      'POV framing drops the viewer inside the scene in one second, which is the fastest immersion a Short can buy.',
      'Personifying the system (the calendar, the group chat, the school portal) makes the invisible load visible and instantly shareable as "this is exactly it".',
      'Punching at structures instead of people keeps the comment section nodding instead of fighting, which keeps distribution clean.',
    ],
    template: [
      '[0:00] POV card: POV: {TheSystem} watching you {TheMoment: at 9:47pm on a Sunday}.',
      '[0:02] The system acts: {SystemBeat: what the calendar / portal / group chat does, deadpan}.',
      '[0:08] Escalation: {SecondBeat: the demand gets one notch more absurd}.',
      '[0:13] The turn: {HerLineOrLook: the calm response that names the absurdity}.',
      '[0:17] Button: {FinalLine: the sentence the comments will repeat}.',
    ].join('\n'),
    exampleHooks: [
      'POV: the school portal at 9:47pm, announcing the form was due at 5.',
      'POV: your calendar watching you add one more thing to tomorrow, knowing everything.',
    ],
    craft: [
      'Under 20 seconds, three beats after the POV card. Deadpan delivery: the absurdity is in the facts, not the performance.',
      'The villain is always a structure (the portal, the default settings, the form), never a partner, a kid, or a mother.',
      'End on the line the comments will repeat. Retention order: the POV card must read in under a second muted, so keep it under 8 words.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'POV is native TikTok grammar: keep the card under 8 words and the system as the only villain.',
    },
  }),

  F({
    id: 'ytshort-comment-bait',
    label: 'YT Short: The genuine question',
    hint: 'A real question she cannot not answer',
    goal: 'replies',
    whyItWorks: [
      'A genuine question with no wrong answer pulls replies from lurkers, and replies are the heaviest engagement signal a Short can earn.',
      'Asking something she has privately wondered but never said out loud makes commenting feel like relief, not labor.',
      'The creator answering comments in the first hour doubles the thread, and the thread feeds the next wave of distribution.',
    ],
    template: [
      '[0:00] The setup in one line: {ContextLine: the tiny true scene that frames the question}.',
      '[0:04] The question, asked straight to camera: {TheQuestion: specific, concrete, no wrong answers}?',
      '[0:08] Your answer first: {MyAnswer: honest, one line, slightly exposing}.',
      '[0:12] Hand it over: {HandoffLine: I need to know if it is just me}.',
    ].join('\n'),
    exampleHooks: [
      'Genuine question: does anyone else keep a second calendar in their head that nobody else can see?',
      'What is the one invisible task in your house that would stop the week if you quit doing it? Mine is the forms.',
    ],
    craft: [
      'Under 15 seconds. The question is specific and concrete (the forms, the 3 am list), never "what do you think".',
      'Answer your own question first, honestly and slightly exposed. Asking without sharing is engagement bait, and the comments can tell.',
      'End with the handoff, then sit in the comments for the first hour. No other CTA of any kind.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Native TikTok shape: the question works as a comment-reply video, and the thread is the second post.',
    },
  }),

  F({
    id: 'ytshort-micro-method',
    label: 'YT Short: Micro method',
    hint: 'One usable method in 30 seconds',
    goal: 'saves',
    whyItWorks: [
      'One complete method in 30 seconds is the highest save-per-second content there is, because it is a tool, not a take.',
      'Verb-first steps make the method runnable tonight, and runnable content gets saved, screenshot, and returned to.',
      'Teaching one thing fully builds the authority that ten tips never do, which converts a view into a subscription.',
    ],
    template: [
      '[0:00] The outcome promise: {OutcomeLine: what this method does, with the timeframe}.',
      '[0:03] Step 1: {VerbStep: do this first, exactly how}.',
      '[0:10] Step 2: {VerbStep: the step everyone skips}.',
      '[0:17] Step 3: {VerbStep: the lock-in move}.',
      '[0:24] What it feels like when it works: {TheProofBeat, one line}.',
    ].join('\n'),
    exampleHooks: [
      'The 20-minute Sunday download, in 3 steps. Step 2 is the one everyone skips, and the whole thing fails without it.',
      'One method that ends the 3 am remembering: dump, sort, place. Here is exactly how.',
    ],
    craft: [
      'One method, taught completely, 25 to 30 seconds. Three verb-first steps, each with its exact how, no theory between steps.',
      'Call out the step everyone skips as its own beat. That beat is why the save happens.',
      'End on what it feels like when it works (the calm Sunday, the empty head), one line. No pitch: the method is the pitch.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Cross-posts clean: on-screen text carries each step number so the method works muted.',
      instagram: 'As a Reel: caption carries the three steps verbatim so the save works without sound.',
    },
  }),

  F({
    id: 'ytshort-myth-flip-15',
    label: 'YT Short: 15-second myth flip',
    hint: 'Kill the advice, name the mechanism',
    goal: 'shares',
    whyItWorks: [
      'Fifteen seconds is exactly long enough to kill one piece of bad advice, and short enough that everyone finishes it.',
      'Naming the mechanism (why the advice cannot work, structurally) is what separates a flip from an opinion, and mechanism is what gets shared.',
      'Flipping advice she already half-doubted validates her experience, and validated viewers send it to the group chat.',
    ],
    template: [
      '[0:00] The myth, stated fairly: Myth: {PopularAdvice she has tried}.',
      '[0:03] The flip: {FlipLine: the blunt correction, one sentence}.',
      '[0:06] The mechanism: {WhyItFails: the structural reason, one line}.',
      '[0:10] What works instead: {TheCorrection: the method, in one breath}.',
    ].join('\n'),
    exampleHooks: [
      'Myth: you need a better morning routine. You need fewer things to remember before it starts. Routines fail on memory, not discipline.',
      'Myth: split the chores 50/50. You cannot split what only one person can see. Make the list visible first, then split it.',
    ],
    craft: [
      '12 to 15 seconds, four beats, no b-roll needed. The flip lands by second 6 or the script is too slow.',
      'The mechanism is structural, never moral: the advice fails because of how memory and visibility work, not because she failed it.',
      'The correction fits in one breath and stands alone. Retention order: cut every word between the myth and the flip.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Cross-posts as-is: the myth card as first-frame text, the flip before second 6.',
      instagram: 'As a Reel: caption carries the myth and the correction in two lines for the muted save.',
    },
  }),

  F({
    id: 'ytshort-story-loop',
    label: 'YT Short: Micro storytime loop',
    hint: 'A tiny true story, lesson at the loop point',
    goal: 'follows',
    whyItWorks: [
      'A micro-storytime (one scene, one turn) earns the follow because people subscribe to storytellers, not tip accounts.',
      'Placing the lesson in the final seconds makes it the loop point: the rewatch re-reads the opening scene with the lesson attached, which doubles the meaning and the watch time.',
      'Specific, true scenes outperform generic advice because the viewer can feel the moment instead of evaluating the claim.',
    ],
    template: [
      '[0:00] The scene, mid-moment: {SceneBeat: time, place, one object}.',
      '[0:04] What happened: {TheTurn: 2 beats that raise the stakes}.',
      '[0:12] What I did: {TheMove: the small action, plainly}.',
      '[0:18] The lesson, one line: {TheLesson: what it taught me, stated once}.',
      '[Loop point] Cut back to the opening frame so the scene replays with the lesson attached.',
    ].join('\n'),
    exampleHooks: [
      'Found the field trip form in the trash on a Tuesday. Signed. The lesson is at the end.',
      '3 am, standing in the kitchen, adding "buy stamps" to a list only I could see.',
    ],
    craft: [
      'Under 25 seconds. Open mid-moment with a time, a place, and one object. Never open with the word "storytime".',
      'The lesson is one line and it is the loop point: the final seconds must flow back into the first frame without a seam.',
      'Keep the story small and true. Calibrate after the lesson: what it cost, what still does not work. The follow is earned by honesty, not the arc.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Storytime is native grammar here: same loop, and pin the lesson as the top comment.',
    },
    inputs: [
      {
        id: 'story',
        label: 'Your micro-story in 2-3 sentences',
        placeholder: 'Found the signed field trip form in the trash Tuesday morning.',
        hint: 'the narrative spine: scene, turn, and move',
        required: true,
      },
      {
        id: 'lesson',
        label: 'The lesson it taught you (one line)',
        placeholder: 'If it only lives in my head, it does not exist.',
        hint: 'the loop-point line at the end',
      },
    ],
  }),

  F({
    id: 'ytshort-watch-twice',
    label: 'YT Short: Watch it twice',
    hint: 'Dense value bomb built for the rewatch',
    goal: 'saves',
    whyItWorks: [
      'A deliberately dense Short (more value than one pass can absorb) earns the rewatch, and rewatch rate is the loudest quality signal in the Shorts feed.',
      'Fast beats with zero filler respect the viewer, which is why dense value bombs out-save slow lists ten to one.',
      'Being told to watch twice is a challenge the viewer accepts, and the second pass is when the save happens.',
    ],
    template: [
      '[0:00] The contract: {ContractLine: this takes two watches, here is why}.',
      '[0:03] Rapid beats, one idea per second: {Beats: 5 to 7 compressed points, each a complete thought}.',
      '[0:15] The one to keep: {TheKeystone: the single beat to run first}.',
      '[0:18] The instruction: Watch it again. {WhatToCatch: what lands on the second pass}.',
    ].join('\n'),
    exampleHooks: [
      'This takes two watches. Seven moves that run our house, one second each. Keep number 4.',
      'Watch this twice. The whole Sunday system in 20 seconds. First pass for the map, second for the moves.',
    ],
    craft: [
      '18 to 22 seconds, 5 to 7 beats, each a complete thought in roughly one second. Cut connective tissue entirely.',
      'Name the keystone beat (the one to run first) so the density has a landing spot.',
      'The close is the instruction to rewatch plus what lands on the second pass. Earn it: if the beats are not dense enough to need a rewatch, do not ask.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['reel'],
    platformNotes: {
      tiktok: 'Cross-posts as-is: density is native here. Caption names the keystone beat for the save.',
    },
  }),

  /* ------------------------------------------------------------------ */
  /* YouTube long-form, round 3. Retention-first essays, searchable      */
  /* guides, teardowns, experiments, documentaries, and the viral        */
  /* challenge/confession/versus structures.                             */
  /* ------------------------------------------------------------------ */

  F({
    id: 'ytlong-retention-essay',
    label: 'YT long-form: Retention essay',
    hint: 'Open-loop chapters, the flagship arc',
    goal: 'saves',
    whyItWorks: [
      'An open loop planted in the first minute and paid in the last is the strongest retention arc long-form has: viewers stay because leaving means never knowing.',
      'Chaptered essay structure (question, tension, mechanism, resolution) turns a take into a journey, and journeys get watched to the end.',
      'Making the final chapter the most valuable reverses the normal drop-off curve, which trains the algorithm to keep recommending the video.',
    ],
    template: [
      '[Cold open, 0:00 to 0:45] {ThePromise: the question this video answers, stated as a stake, plus the one-line reason to trust the answer}.',
      '[Loop plant, 0:45] {TheOpenLoop: the specific thing you will reveal at the end, named plainly}.',
      'Chapter 1: The problem as it is sold to us - {ReframeBeat: what everyone gets wrong}.',
      'Chapter 2: The tension - {EvidenceBeats: 2 to 3 scenes or receipts that raise the stakes}.',
      'Chapter 3: The mechanism - {TheTeaching: the system, taught fully, mid-video}.',
      'Chapter 4: The resolution - {LoopPayoff: answer the planted loop, then the transferable rule}.',
      '[Close] {CalibratedClose: what it cost, what is still unsolved, one soft next step}.',
    ].join('\n'),
    exampleHooks: [
      'There is a reason the week breaks by Wednesday, and by the end of this video you will be able to see it in your own house.',
      'Six months ago I stopped trying to manage my time and started managing something else. The difference is the last chapter.',
    ],
    craft: [
      'Plant the open loop in the first 60 seconds, by name, and do not pay it until the final chapter. Every chapter must raise the value of that payoff.',
      'Teach the mechanism fully in the middle. Retention order: re-hook at the top of every chapter (one line on why the next part matters), and never let 90 seconds pass without a new beat.',
      'Close calibrated: what it cost, what is still unsolved, one soft next step. The essay is the value; the subscribe is earned by the honesty.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'ytlong-ultimate-guide',
    label: 'YT long-form: The ultimate guide',
    hint: 'Searchable, chaptered, complete',
    goal: 'saves',
    whyItWorks: [
      'The definitive video on a searched topic compounds: it ranks in search and suggested for years and becomes the link everyone sends.',
      'Chapter markers make a long guide skimmable, and skimmable long videos get watched more, not less, because viewers trust what they can navigate.',
      'Completeness is the authority signal: covering the fundamentals, the method, and the pitfalls is worth more than any production budget.',
    ],
    template: [
      '[0:00 to 0:30] {ThePromise: what this guide covers completely, for whom, in what order}.',
      'Chapter 1: The fundamentals - {WhatEveryoneGetsWrong first, corrected}.',
      'Chapter 2: The method - {TheCoreSystem: taught step by step, each step with its how}.',
      'Chapter 3: The pitfalls - {The4-6 ways this fails, and the fix for each}.',
      'Chapter 4: The advanced moves - {WhatToAdd once the basics hold}.',
      'Chapter 5: FAQ - {The4-6 questions everyone asks, answered in one breath each}.',
      '[Close] {TheOneThing: what to do this week} + {SoftCTA: the system that holds all of this}.',
    ].join('\n'),
    exampleHooks: [
      'The complete guide to the mental load: what it is, why it lands on one person, and the system that actually moves it.',
      'Everything about the Sunday reset in one video: the 20-minute version that survives Wednesday.',
    ],
    craft: [
      'Answer the core question in the first 30 seconds, completely, before any throat-clearing. The intro is written to be quoted.',
      'Every chapter marker is a searchable phrase, not a joke title. Teach the full method in Chapter 2; the pitfalls chapter is where authority lives.',
      'Close with one action for this week and the soft CTA. The guide must be worth saving with zero clicks out.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'ytlong-teardown-audit',
    label: 'YT long-form: The teardown',
    hint: 'Audit a system, fairly, with receipts',
    goal: 'saves',
    whyItWorks: [
      'A teardown is proof of expertise: taking a real system apart piece by piece demonstrates judgment that tips never can.',
      'Audit structure (what it claims, what it does, what it costs, what to keep) gives the viewer a reusable lens, which is why teardowns get saved as references.',
      'Fair, specific criticism of a system (never a person) attracts the exact audience that is tired of the system and ready for a better one.',
    ],
    template: [
      '[0:00 to 0:30] {TheSubject: what we are tearing down and why now, one line} + {TheStakes: what rides on this working}.',
      'Part 1: What it promises - {TheClaims: stated fairly, steelmanned}.',
      'Part 2: What it actually does - {TheReality: 3 to 5 observed behaviors, receipts on screen}.',
      'Part 3: Where it breaks - {TheFailureModes: the structural reasons, never moral ones}.',
      'Part 4: What to keep - {TheKeeps: the 1 to 2 parts that genuinely work}.',
      'Part 5: The rebuild - {TheBetterSystem: the corrected approach, taught plainly}.',
      '[Close] {CalibratedClose: what the teardown cannot tell us} + {SoftCTA}.',
    ].join('\n'),
    exampleHooks: [
      'I audited the 5 am morning routine for a month. Here is what it promises, what it does, and the 2 parts worth keeping.',
      'A fair teardown of the family command center: the claims, the receipts, and where it quietly breaks.',
    ],
    craft: [
      'Steelman the subject first: state its promises so fairly a fan would nod. The credibility of the teardown is built in Part 1.',
      'Receipts or it did not happen: every observed behavior gets evidence on screen (a page, a log, a count). Punch at systems, never at people.',
      'Always name what to keep, then teach the rebuild fully. Calibrate the close: what this audit cannot prove. Retention order: one receipt every 90 seconds minimum.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    inputs: [
      {
        id: 'subject',
        label: 'The system you are tearing down',
        placeholder: 'The 5 am club morning routine, as sold to mothers.',
        hint: 'the audit subject, named plainly',
        required: true,
      },
      {
        id: 'receipts',
        label: 'Your receipts (observations, counts, quotes)',
        placeholder: 'Tracked 14 mornings: 11 failed by day 4 when a kid woke early.',
        hint: 'the evidence beats for Part 2',
      },
    ],
  }),

  F({
    id: 'ytlong-experiment-vlog',
    label: 'YT long-form: The 30-day experiment',
    hint: 'Rules, receipts, verdict',
    goal: 'follows',
    whyItWorks: [
      'Experiment videos carry a built-in arc (rules, struggle, data, verdict) that holds retention without any tricks.',
      'Stated rules make the viewer a referee: she watches to check the work, which is a deeper engagement than watching to be entertained.',
      'An honest verdict (including what failed) is the strongest subscribe trigger in the genre, because it proves the channel reports results, not just attempts.',
    ],
    template: [
      '[0:00 to 0:45] {TheExperiment: what I am doing for 30 days and why, plus the rule set on screen}.',
      'The rules: {RuleSet: 3 to 5 specific, checkable rules}.',
      'Week 1: {TheNovelty: what worked immediately, what surprised}.',
      'Week 2: {TheWall: where it broke, on camera, honestly}.',
      'Week 3: {TheAdjustment: the one change that saved it}.',
      'Week 4: {TheData: the counts, the receipts, the before-after}.',
      'The verdict: {TheVerdict: keep, modify, or quit, and exactly who should try it}.',
      '[Close] {WhatIAmTestingNext} + {SoftCTA}.',
    ].join('\n'),
    exampleHooks: [
      'I did the full Sunday reset every week for 30 days. Rules on screen, receipts inside, and the verdict is not what I expected.',
      'Thirty days of the one-page house: what broke in week 2, the adjustment that saved it, and the final count.',
    ],
    craft: [
      'State 3 to 5 checkable rules in the first 45 seconds and put them on screen. The rules are the contract; breaking one on camera is content, hiding it is fraud.',
      'Week 2 is the retention core: show the wall honestly. The adjustment in week 3 is the value; the receipts in week 4 are the proof.',
      'The verdict names keep, modify, or quit and exactly who should try it. Calibrate what the experiment cannot tell anyone. Tease the next test to earn the subscribe.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    inputs: [
      {
        id: 'experiment',
        label: 'The experiment (what you did, for how long)',
        placeholder: 'The full Sunday reset, every week for 30 days.',
        hint: 'the arc spine: subject and window',
        required: true,
      },
      {
        id: 'rules',
        label: 'The rules you set (3-5)',
        placeholder: '20 minutes max, one page only, phone in another room.',
        hint: 'the on-screen rule set',
      },
      {
        id: 'result',
        label: 'The receipts and verdict so far',
        placeholder: 'Week 2 broke on a sick day; week 3 added the 5-minute version.',
        hint: 'the data and verdict beats',
      },
    ],
  }),

  F({
    id: 'ytlong-documentary-case',
    label: 'YT long-form: Documentary case study',
    hint: 'One mother, one system, the full arc',
    goal: 'follows',
    whyItWorks: [
      'A single subject followed through a complete arc is the most trusted video format there is: it shows instead of claims.',
      'Documentary restraint (observation, artifacts, quiet moments) reads as truth in a feed of performance, which is exactly the brand register.',
      'One specific real story generalizes better than a hundred generic tips, because the viewer maps her own life onto it.',
    ],
    template: [
      '[Cold open] {TheQuietScene: the subject mid-morning, one telling detail, no introduction}.',
      '[0:30] The setup: {WhoSheIs: one line, and what the week demanded of her}.',
      'Act 1: The before - {TheBefore: the invisible load, documented: the lists, the 3 am, the count}.',
      'Act 2: The intervention - {TheSystem: what changed, in order, with the artifacts on screen}.',
      'Act 3: The friction - {WhatResistedChange: the honest middle where it almost failed}.',
      'Act 4: The after - {TheAfter: same scenes, reshot: what the week looks like now, with the numbers}.',
      '[Close] {HerLine: the subject in her own words, one line} + {TheTransfer: what any viewer takes from this} + {SoftCTA}.',
    ].join('\n'),
    exampleHooks: [
      'She was running a house of five on 4 hours of margin. We filmed what happened when the list left her head.',
      'One mother, one system, six weeks: the before, the break, and the Tuesday that finally felt different.',
    ],
    craft: [
      'Open on a quiet observed scene, never an introduction. Let the artifacts (the lists, the calendar, the count) carry the evidence.',
      'Act 3 is mandatory: show where it almost failed. A case study without friction is an ad, and viewers can tell the difference.',
      'Close on her own words, one line, then the transferable rule for any viewer. Calibrate what the after still does not fix. Soft CTA last.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'ytlong-challenge-arc',
    label: 'YT long-form: The challenge arc',
    hint: 'Day-by-day escalation to a reset',
    goal: 'follows',
    whyItWorks: [
      'A challenge with escalating days is appointment viewing: each day is an episode, and episodes build subscribers faster than any single video.',
      'Escalation (day 1 easy, day 5 real) creates a natural tension curve that holds retention across a long runtime.',
      'Challenges invite the audience to play along, and playing along converts a viewer into a participant who comes back for the finale.',
    ],
    template: [
      '[0:00 to 0:45] {TheChallenge: what I am doing, for how long, and the one rule that scares me}.',
      'Day 1: {TheStart: the easy win, the setup, the first receipt}.',
      'Day 2 to 3: {TheEscalation: the stakes rise, one beat per day}.',
      'Day 4: {TheCrisis: the day it almost ended, on camera}.',
      'Day 5: {TheFinal: the hardest version, full commitment}.',
      'The aftermath: {TheCount: receipts, numbers, the before-after}.',
      '[Close] {WhatStays: which part becomes permanent} + {JoinLine: how to run the same 5 days} + {SoftCTA}.',
    ].join('\n'),
    exampleHooks: [
      'Five days of the full system, no skipping: day 4 nearly ended it, and day 5 changed the house.',
      'I reset one room a day for a week and filmed everything. The count at the end is the part nobody believed.',
    ],
    craft: [
      'One rule stated up front that scares you a little. The fear is the hook and the honesty in one move.',
      'Escalate every day: each day gets one beat, bigger than the last. Day 4 is the crisis day; show it, do not summarize it.',
      'The aftermath is receipts and numbers, then what stays permanent. Close with how she can run the same 5 days. Retention order: re-state the day count at the top of every chapter.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  F({
    id: 'ytlong-confession-hour',
    label: 'YT long-form: The confession',
    hint: 'Long sit-down: vulnerable, then competent',
    goal: 'shares',
    whyItWorks: [
      'A long, calm confession is the rarest thing in the feed, and rarity is reach: people send it with "watch this when you have a minute".',
      'Vulnerability plus competence is the strongest trust formula on camera: the confession earns the heart, the rebuild earns the respect.',
      'Sitting with one topic for a full arc (no b-roll cutaways, no list) signals confidence, and confidence holds a long runtime.',
    ],
    template: [
      '[0:00] The confession, first line: {TheConfession: the thing I have not said out loud, plainly}.',
      'Part 1: How it started - {TheOrigin: the moment or season, one specific scene}.',
      'Part 2: What it cost - {TheCost: the honest ledger: time, patience, the version of me}.',
      'Part 3: The turn - {TheTurn: what finally made it visible, no epiphany theater}.',
      'Part 4: What I do now - {TheRebuild: the system or practice, taught calmly, competence in full}.',
      '[Close] {ThePermission: what I would tell her at the start} + {SoftCTA: the thing that holds it now}.',
    ].join('\n'),
    exampleHooks: [
      'I kept a second calendar nobody was allowed to see, and for two years I thought that was normal.',
      'A confession: I resented the school forms. Not the school. The forms. Here is what that finally taught me.',
    ],
    craft: [
      'The confession is the first line, plainly, no cold open. Vulnerability without a warmup is the whole hook.',
      'The cost section is the honest ledger: name what it cost in time and temper, never in blame. No epiphany theater in the turn; a slow realization reads truer.',
      'Part 4 is where competence arrives: teach the rebuild calmly and completely. Close with the permission she would have needed at the start. Calibrate: this is one story, not a prescription.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
    inputs: [
      {
        id: 'confession',
        label: 'The confession (the honest thing, 1-2 lines)',
        placeholder: 'I kept a second calendar in my head and it ran me.',
        hint: 'the first line and the spine of Part 1',
        required: true,
      },
      {
        id: 'rebuild',
        label: 'What you do now (the practice or system)',
        placeholder: 'The weekly download, one page, visible to everyone.',
        hint: 'the Part 4 teaching material',
      },
    ],
  }),

  F({
    id: 'ytlong-vs-week',
    label: 'YT long-form: X vs Y week',
    hint: 'Two methods, one week, a verdict',
    goal: 'shares',
    whyItWorks: [
      'A fair head-to-head is the most clickable comparison format: two methods, one real week, and a verdict she can use.',
      'The structure guarantees a payoff (someone wins), and guaranteed payoffs hold retention to the final chapter.',
      'Verdicts get shared as settling-the-debate content, which carries the video into the group chats where the debate already lives.',
    ],
    template: [
      '[0:00 to 0:45] {TheMatchup: method X vs method Y, and the stake: which one runs a real week}.',
      'The rules: {TheRules: same week, same family, same demands, scored on 3 named criteria}.',
      'Half 1: Method X - {XWeek: how it felt, where it shone, where it broke, receipts}.',
      'Half 2: Method Y - {YWeek: same scenes, same criteria, receipts}.',
      'The scorecard: {TheScorecard: criterion by criterion, on screen, honest}.',
      'The verdict: {TheVerdict: the winner, and exactly who should pick the loser instead}.',
      '[Close] {WhatIKept: the hybrid that survived} + {SoftCTA}.',
    ].join('\n'),
    exampleHooks: [
      'Paper planner vs the one-page system: one week each, same house, same chaos. The scorecard is not close.',
      'I ran the 5 am routine against the 20-minute Sunday download. Same week demands. One clear winner.',
    ],
    craft: [
      'Define 3 scoring criteria in the first 45 seconds and hold both methods to them exactly. The fairness is the credibility.',
      'Run the same scenes against both (the sick day, the form, the 5 pm hour) so the comparison is honest. Receipts in both halves.',
      'The verdict names a winner and who should pick the loser anyway. Close with the hybrid you kept. Retention order: tease the scorecard, never the winner, before the final chapter.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long'],
  }),

  /* ------------------------------------------------------------------ */
  /* YouTube ads, round 3. Pre-roll and in-feed script structures built  */
  /* around skip economics: hook before 5 seconds, brand by 8, CTA by    */
  /* 25. Pairing notes point at the existing ytthumb- recipes.           */
  /* ------------------------------------------------------------------ */

  F({
    id: 'ytad-preroll-pas',
    label: 'YT ad: PAS pre-roll',
    hint: 'Problem, agitate, solve, before the skip',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Pre-roll lives or dies in the 5 seconds before the skip button wakes up, and a problem she recognizes is the only hook that beats it.',
      'PAS (problem, agitate, solve) compresses a full sales argument into 30 seconds because agitation does the persuading that adjectives never could.',
      'Branding by second 8 means even the skippers carry the name out, which turns skipped impressions into assisted conversions.',
    ],
    template: [
      '[0:00 to 0:05] Hook before the skip: {TheProblem: her 11pm problem, stated in her words, on screen and spoken}.',
      '[0:05 to 0:12] Agitate: {TheCost: 2 quick beats on what carrying it costs: the 3 am list, the forgotten form}.',
      '[0:08] Brand window: {BrandLine: name and what it is, one line, logo card}.',
      '[0:12 to 0:22] Solve: {TheMechanism: how the system removes the problem, shown working}.',
      '[0:22] Proof: {TheReceipt, one line}.',
      '[0:25] CTA: {Direct, warm: what it is, price, where to click}.',
    ].join('\n'),
    exampleHooks: [
      'If your brain keeps a second calendar nobody can see, this is the page that finally holds it. Eight seconds to explain.',
      'The 3 am remembering is not a you problem. It is a systems problem, and the fix costs $7.',
    ],
    craft: [
      'The first 5 seconds must name the problem in her exact words with the product or page visible. Assume she skips at 5:01 and make those seconds count anyway.',
      'Brand by second 8, logo and one-line what-it-is, so skippers still get the name. The CTA lands at second 25 with the price in it.',
      'Pair the visual with the ytthumb-curiosity-scene or ytthumb-minimal-object framing. Keep claims calibrated: one receipt, no hype to walk back.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
    platformNotes: {
      youtube: 'Skippable in-stream: hook frame readable muted, CTA end card holds the full final 3 seconds.',
    },
  }),

  F({
    id: 'ytad-preroll-proof',
    label: 'YT ad: Proof-first pre-roll',
    hint: 'The receipt lands before the skip',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'Leading with the receipt (the count, the quote, the before-after) flips the usual ad order, and the flip is what beats the skip: proof first, pitch second.',
      'A specific result in 5 seconds reads as content, not creative, which buys the next 20 seconds of attention.',
      'Proof-first ordering filters for buyers: viewers who stay for evidence are the ones who click for price.',
    ],
    template: [
      '[0:00 to 0:05] The receipt, first: {TheProof: the number, quote, or before-after, on screen and spoken}.',
      '[0:05 to 0:10] What made it true: {TheMechanism: the one-line how}.',
      '[0:08] Brand window: {BrandLine: name + what it is}.',
      '[0:10 to 0:22] The system working: {TheDemo: 2 to 3 quick beats of it running}.',
      '[0:22] Second receipt: {TheEcho: a different shape of proof}.',
      '[0:25] CTA: {Direct, warm: what it is, price, click}.',
    ].join('\n'),
    exampleHooks: [
      'Eleven thousand mothers run their week on this one page. Here is the page, and here is the 20 minutes it takes.',
      'She stopped waking up at 3 am in the first week. The system is one checklist, and it costs $7.',
    ],
    craft: [
      'The receipt is frame one: number, quote, or before-after, specific and defensible. If the first 5 seconds could be an ad for anything, they fail.',
      'Brand by second 8 even in the proof flow. Two different-shaped receipts (a number and a quote) beat two of the same shape.',
      'Pair the visual with the ytthumb-offer-stack or ytthumb-simple-chart framing. CTA at :25, price included, direct and warm.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
  }),

  F({
    id: 'ytad-preroll-founder',
    label: 'YT ad: Founder pre-roll',
    hint: 'Calm, direct, one offer',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A founder looking at the lens and talking like a person is the strongest pattern interrupt in a pre-roll pod of produced ads.',
      'Calibrated honesty (what it is, what it costs, who it is not for) disarms the ad filter faster than any hook trick.',
      'One offer, one price, one calm ask converts because it respects the viewer, and respect is the brand.',
    ],
    template: [
      '[0:00 to 0:05] Direct address: {FounderOpen: hi, I made this because {TheReason, one honest line}}.',
      '[0:05 to 0:10] What it is: {TheOffer: the one-line description + the artifact on screen}.',
      '[0:08] Brand window: name on screen, lower third, holds to the end.',
      '[0:10 to 0:22] What it does: {TheOutcome: the one result, with the week-1 reality attached}.',
      '[0:22] The honest line: {WhoItIsNotFor: the disqualifier, one line}.',
      '[0:25] CTA: {TheAsk: direct, warm, price included}.',
    ].join('\n'),
    exampleHooks: [
      'Hi. I made this the year I kept waking up at 3 am remembering permission slips. It is one page, it is $7, and it is not for everyone.',
      'Thirty seconds, one offer, no funnel tricks: this is the system that runs our house, and here is what it costs.',
    ],
    craft: [
      'One take energy: founder to lens, natural light, the artifact in hand by second 5. Produced polish works against this ad.',
      'Brand lower-third by second 8 and hold it. Include the honest disqualifier: who should not buy. It doubles the credibility of the ask.',
      'CTA at :25 with the price spoken. Pair the visual with ytthumb-face-closeup only when the founder is the approved face; otherwise the ytthumb-minimal-object framing.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
  }),

  F({
    id: 'ytad-infeed-answer',
    label: 'YT ad: In-feed answer',
    hint: 'The video that answers the search verbatim',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'In-feed ads win by matching the search she just typed, so the script and title answer the query verbatim and the click is the natural next step.',
      'An ad that reads as the best organic result earns the click without any ad pressure, which is the cheapest conversion on YouTube.',
      'Search intent is pre-qualified: she is already looking for the fix, so the script can skip persuasion and go straight to the method.',
    ],
    template: [
      'Title brief: {TheQuery, exactly as she searches it} + {TheQualifier: in 20 minutes / one page / this year}.',
      '[0:00 to 0:05] The answer, first line: {TheDirectAnswer: complete, citable, no preamble}.',
      '[0:05 to 0:20] The method: {TheHow: the 3 core steps, each with its how, shown on screen}.',
      '[0:20 to 0:28] The shortcut: {TheOffer: the done-for-you version, what it is, price}.',
      '[0:28] CTA: {Direct: get the page, link on screen}.',
    ].join('\n'),
    exampleHooks: [
      'How to do a brain dump that actually works: dump, sort, place. The full method in 30 seconds, and the page that holds it is below.',
      'What is the mental load? One answer, one system, and the $7 page that moves it. All in this video.',
    ],
    craft: [
      'Write the title as the verbatim query plus one qualifier, and answer the query completely in the first line. The ad is the best answer in the results or it is nothing.',
      'Teach the 3 core steps for real. The offer is the shortcut through the method, never a replacement for the answer.',
      'Pair the visual with the ytthumb-checklist-hero or ytthumb-curiosity-scene framing; the thumbnail echoes the query, not the brand. CTA direct, link on screen.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
    platformNotes: {
      youtube: 'In-feed placement: the title brief ships to the YouTube Studio kit so the generated title matches the script verbatim.',
    },
  }),

  F({
    id: 'ytad-demo-walkthrough',
    label: 'YT ad: 60-second demo',
    hint: 'Watch the system work in real time',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A real-time demo answers "what is it exactly" better than any copy, and that question is the top objection for a $7 digital product.',
      'Watching the artifact work (the page filled, the week placed) creates ownership desire: she can picture her own Tuesday inside it.',
      'Sixty seconds of honest process out-converts thirty seconds of claims, because process is proof.',
    ],
    template: [
      '[0:00 to 0:05] The artifact, working: {ShowThePage: the system mid-use, one line on what we are watching}.',
      '[0:05 to 0:20] Step one: {StepOne: the download, narrated plainly, real time}.',
      '[0:20 to 0:35] Step two: {StepTwo: the sort, the moment it clicks}.',
      '[0:35 to 0:48] Step three: {StepThree: the placed week, the calm table}.',
      '[0:48 to 0:55] The receipt: {TheProof, one line}.',
      '[0:55] CTA: {What it is, price, where to get it}.',
    ].join('\n'),
    exampleHooks: [
      'Watch one page replace forty open tabs in 60 seconds. Real time, no cuts.',
      'This is the 20-minute Sunday download, sped up to a minute. Stay for the calm table at the end.',
    ],
    craft: [
      'Open on the artifact working, never on a face introducing it. The first 5 seconds are the demo, and the skip button is the editor: if a second does not show progress, cut it.',
      'Narrate in plain steps: what you are seeing and why it matters, one idea per beat. Real-time beats, no jump-cut montage.',
      'CTA in the final 5 seconds with price and link on screen. Pair the visual with the ytthumb-day-in-life or ytthumb-checklist-hero framing.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
  }),

  F({
    id: 'ytad-testimonial-ugc',
    label: 'YT ad: UGC testimonial',
    hint: 'Mother to mother, receipts on screen',
    goal: 'clicks',
    kind: 'ad',
    whyItWorks: [
      'A mother talking to mothers in her own kitchen reads as a recommendation, not an ad, and recommendations are the only ads that survive the skip.',
      'Receipts on screen while she talks (the ticked page, the count) fuse story and proof into one beat, which is the highest-converting combination there is.',
      'UGC-style testimonial ads retarget beautifully: warm audiences who saw the brand once convert on the second, human touch.',
    ],
    template: [
      '[0:00 to 0:05] The confession-style open: {HerOpen: I did not think a page could fix this, in her words}.',
      '[0:05 to 0:15] The before: {TheBefore: her Tuesday, one specific scene}.',
      '[0:15 to 0:30] The change: {TheChange: what she did, with the receipt on screen: the ticked page, the count}.',
      '[0:30] The line: {TheMoneyLine: the sentence she would say to a friend}.',
      '[0:35] Brand card + CTA: {What it is, price, where to click}.',
    ].join('\n'),
    exampleHooks: [
      'I rolled my eyes at a $7 page. Then Sunday stopped hurting. Here is the exact page on my fridge.',
      'Two weeks in, my husband asked what changed. The change was one checklist, and I will show you the whole thing.',
    ],
    craft: [
      'Cast the read as mother to mother: kitchen light, phone framing, first name only. Overproducing it kills the trust the format is built on.',
      'Receipts on screen while she talks: the ticked page, the count, the before-after. The quote and the proof must land in the same beat.',
      'Brand card and CTA at :35 with price and link. Pair the visual with the ytthumb-confessional-light or ytthumb-face-closeup framing (approved faces only). Keep every claim calibrated to the real receipt.',
    ].join(' '),
    platforms: ['youtube'],
    formats: ['long', 'reel'],
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
];
