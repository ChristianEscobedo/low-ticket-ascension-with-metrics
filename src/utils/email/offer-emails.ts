/**
 * Per-offer purchase emails. One long-form, value-forward welcome email per
 * MotherMode product, keyed by Stripe product id. Rendered through the shared
 * Editorial Warm layout so each one matches the app. The sender falls back to
 * these when no DB override exists; if a product has no entry here, the themed
 * default receipt (./defaults) is used instead.
 *
 * Copy honours the brand voice: no em dashes, no NO-list words. Body strings
 * keep {{name}} / {{amount}} / {{ref}} tokens for the render pipeline.
 */
import { getURL } from '@/utils/helpers';
import { renderEmail, type EmailDoc, type EmailSection } from './layout';

/** Where buyers go to use what they bought. */
const ACCESS_URL = getURL('account');

export interface OfferEmailConfig {
  productId: string;
  name: string;
  eyebrow: string;
  subject: string;
  preheader: string;
  intro: string[];
  /** "What you just unlocked" list. */
  whatYouGet: string[];
  /** "Start here tonight" first step. */
  tonight: string[];
  /** Soft, honest bridge to the next step in the redesign. */
  nextStep?: string[];
  cta: { label: string; url: string };
  outro?: string[];
}

function buildOfferDoc(cfg: OfferEmailConfig): EmailDoc {
  const sections: EmailSection[] = [
    { heading: 'What you just unlocked', bullets: cfg.whatYouGet },
    { heading: 'Start here tonight', paragraphs: cfg.tonight },
  ];
  if (cfg.nextStep && cfg.nextStep.length) {
    sections.push({ heading: 'Where this goes next', paragraphs: cfg.nextStep });
  }
  return {
    preheader: cfg.preheader,
    eyebrow: cfg.eyebrow,
    title: cfg.name,
    intro: cfg.intro,
    sections,
    cta: cfg.cta,
    receipt: [
      { label: 'Amount', value: '{{amount}}' },
      { label: 'Reference', value: '{{ref}}' },
    ],
    outro: cfg.outro,
  };
}

// Registry filled below. Keyed by Stripe product id.
const CONFIGS: Record<string, OfferEmailConfig> = {};

function register(cfg: OfferEmailConfig) {
  CONFIGS[cfg.productId] = cfg;
}

/** Receipt-template shape, or null when the product has no dedicated email. */
export function getOfferEmailTemplate(
  productId?: string | null,
): { id: string; subject: string; body_html: string; body_text: string } | null {
  if (!productId) return null;
  const cfg = CONFIGS[productId];
  if (!cfg) return null;
  const { html, text } = renderEmail(buildOfferDoc(cfg));
  return {
    id: `offer:${productId}`,
    subject: cfg.subject,
    body_html: html,
    body_text: text,
  };
}

/** True when a dedicated per-offer email exists. Used by tests + admin UI. */
export function hasOfferEmail(productId?: string | null): boolean {
  return !!productId && !!CONFIGS[productId];
}

// ---------------------------------------------------------------------------
// Front-end offers
// ---------------------------------------------------------------------------

register({
  productId: 'mm_brain_dump_system',
  name: 'Welcome to The Brain Dump System',
  eyebrow: 'The Mental Load Series',
  subject: 'Your head is about to get quieter, {{name}}',
  preheader: 'The Brain Dump System is ready. Here is how to start tonight.',
  intro: [
    'Hi {{name}}, you just did the thing most mothers never get to. You took the list out of your head and handed it to a system built to hold it.',
    'For years you have been the only backup copy of your whole house. That ends now. Let me show you exactly how to start.',
  ],
  whatYouGet: [
    'The guided brain dump that pulls every open tab out of your head in one sitting.',
    'Your personalized system, built by the AI from your answers in minutes.',
    'The sorting pass that turns one long list into Drop, Automate, Delegate, and Keep.',
    'The handoff scripts that move work to the people around you, so it actually stays gone.',
  ],
  tonight: [
    'Open MotherMode and run the brain dump once, tonight, before bed. Do not organize as you go. Just empty your head onto the page and let the system catch all of it.',
    'Tomorrow morning, look at what you wrote. The list that used to wake you at 11pm is now sitting somewhere safe, outside of you. That is the whole point.',
  ],
  nextStep: [
    'The Brain Dump gets the list out of your head once. The MotherMode OS is what keeps it out, week after week, so the list never refills to the same level. When you are ready, it is waiting inside your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
  outro: [
    'You do not have to use all of it tonight. Run the brain dump, sleep, and let it carry the rest.',
  ],
});

register({
  productId: 'mm_five_pm_reset',
  name: 'Welcome to The 5pm Reset',
  eyebrow: 'The Daily Rhythm Series',
  subject: 'Tonight gets easier, {{name}}',
  preheader: 'The 5pm Reset is ready. Use it before dinner tonight.',
  intro: [
    'Hi {{name}}, the hardest two hours of your day just got a plan. You no longer have to improvise dinner, baths, and bed while everyone needs you at once.',
    'You are patient all day and then 6pm arrives and you meet a version of yourself you do not like. That was never a character flaw. No one had designed those two hours. Now someone has.',
  ],
  whatYouGet: [
    'Your evening sequence, built by the AI around your kids and your actual schedule.',
    'A fixed order of operations for the witching hour, so you stop deciding everything on empty.',
    'The dinner-to-bed flow that holds even on the nights you have nothing left.',
    'Small resets you can run when it starts to come apart, before it becomes a meltdown.',
  ],
  tonight: [
    'Open MotherMode and read your sequence once before dinner. Do not memorize it. Just follow it tonight, step by step, instead of deciding in the moment.',
    'Notice what happens around 6pm. The scramble has a shape now, and the shape is doing the deciding so you do not have to.',
  ],
  nextStep: [
    'The 5pm Reset fixes the evening. The MotherMode OS holds the whole day around it, so one calm evening becomes a calm rhythm. It is in your account when you want it.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_morning_without_yelling',
  name: 'Welcome to The Morning Without Yelling',
  eyebrow: 'The Daily Rhythm Series',
  subject: 'Out the door without becoming someone you do not want to be',
  preheader: 'The Morning Without Yelling is ready. Set it up tonight, run it tomorrow.',
  intro: [
    'Hi {{name}}, tomorrow morning has a plan now. Out the door on time, without the countdown, the repeating, and the voice you do not want your kids to remember.',
    'The morning was never about you not trying hard enough. It was about being the alarm, the timer, and the only person holding the sequence. We just moved that off you.',
  ],
  whatYouGet: [
    'Your morning map, built by the AI for your real leave-time and your kids ages.',
    'The night-before setup that does half the morning while everyone sleeps.',
    'A visual sequence your kids can follow, so you stop being the human alarm clock.',
    'The calm scripts for the moments it wobbles, so you do not lose the morning to one shoe.',
  ],
  tonight: [
    'Open MotherMode tonight and do the five-minute night-before setup. That one step is most of the win. Then put the morning map where your kids can see it.',
    'Tomorrow, run it instead of managing it. The first morning a child starts the steps without you saying a word is the morning this pays for itself.',
  ],
  nextStep: [
    'A calm morning and a calm evening are two anchors. The MotherMode OS connects them into a day that runs without you holding every piece. It is waiting in your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_offload_map',
  name: 'Welcome to The Offload Map',
  eyebrow: 'The Mental Load Series',
  subject: 'Time to carry less, {{name}}',
  preheader: 'The Offload Map is ready. Sort your list tonight and start handing it off.',
  intro: [
    'Hi {{name}}, you are about to do something different from every productivity tool you have tried. Instead of organizing more, you are going to carry less.',
    'Every task you hold goes into one of four piles: Drop, Automate, Delegate, or Keep. Most of what wakes you at night belongs in the first three. Let us prove it.',
  ],
  whatYouGet: [
    'The four-way grid that sorts any task into Drop, Automate, Delegate, or Keep.',
    'The delegate scripts that make an ask clear enough that the work stays gone.',
    'Automation prompts for the recurring jobs that should never touch your hands again.',
    'A shorter Keep pile, so what is left is only what truly needs you.',
  ],
  tonight: [
    'Open MotherMode and run your current list through the grid once. Go fast. The first pass usually drops more than you expect, and that relief is the point.',
    'Pick one thing from your Delegate pile and hand it off this week using the script. Watch it stay handed off, because the ask was finally clear.',
  ],
  nextStep: [
    'The Offload Map clears the pile once. The MotherMode OS keeps it from refilling, sorting new work as it arrives so you never carry it by default again. Find it in your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_first_90_days',
  name: 'Welcome to The First 90 Days',
  eyebrow: 'The Seasons Series',
  subject: 'Systems for the fog, {{name}}',
  preheader: 'The First 90 Days is ready. Your recovery is not one more thing to carry.',
  intro: [
    'Hi {{name}}, congratulations, and welcome. The newborn season is its own kind of hard, and you just gave yourself something most mothers in it never get: a system, so survival is not the only plan.',
    'You do not need to read this all at once. You will not remember it if you do. It is built for the fog, in small pieces you can reach for one-handed at 3am.',
  ],
  whatYouGet: [
    'The daily rhythm for the newborn weeks, built around feeds, sleep, and your recovery.',
    'The handoff lists that let other people actually help, instead of asking what you need.',
    'A gentle plan for your own recovery, treated as part of the system and not an afterthought.',
    'Scripts for visitors and offers of help, so support arrives as support.',
  ],
  tonight: [
    'Open MotherMode and read only the first section. That is enough for today. The rest will be there when you surface.',
    'Hand one list to the person nearest you. Letting help in is the whole skill of this season, and the lists make it possible.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_invisible_labor_inventory',
  name: 'Welcome to The Invisible Labor Inventory',
  eyebrow: 'The Mental Load Series',
  subject: 'Time to make the unseen work visible',
  preheader: 'The Invisible Labor Inventory is ready. For you, and for the conversation.',
  intro: [
    'Hi {{name}}, the work you do that no one sees is about to have a name and a number. Not so you can feel more tired, but so you can finally point at it.',
    'You cannot share a load that stays invisible. The first step to handing it off is making it impossible to miss. That is what you just bought.',
  ],
  whatYouGet: [
    'The full inventory that surfaces the planning, tracking, and remembering you carry by default.',
    'A clear picture of how much of the household actually runs through you.',
    'The conversation guide that turns the inventory into a calm, specific ask.',
    'A starting point for redistributing the load, instead of absorbing it.',
  ],
  tonight: [
    'Open MotherMode and complete the inventory honestly. Do not soften it. Seeing the real total on one page is the shift.',
    'When you are ready, use the conversation guide. The goal is not blame. The goal is that the load becomes a thing you both can see and share.',
  ],
  nextStep: [
    'The Inventory shows the load. The MotherMode OS helps you move it, holding the handed-off work so it does not quietly drift back to you. It is in your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_weekly_reset',
  name: 'Welcome to The Weekly Reset',
  eyebrow: 'The Daily Rhythm Series',
  subject: 'So the list never refills to the same level',
  preheader: 'The Weekly Reset is ready. One page, one rhythm, every week.',
  intro: [
    'Hi {{name}}, you just gave yourself a way to start every week ahead of the list instead of buried under it.',
    'A brain dump empties the head once. A weekly reset is what keeps it empty, so Sunday night stops being the moment the next week lands on you all at once.',
  ],
  whatYouGet: [
    'Your one-page weekly operating rhythm, built around your real week.',
    'The short reset ritual that clears, sorts, and resets the list in one sitting.',
    'A repeatable rhythm so the load never refills to the same level it used to.',
    'Prompts that catch what is coming, before it becomes a 11pm scramble.',
  ],
  tonight: [
    'Open MotherMode and run the reset once for the coming week. Block fifteen minutes. That fifteen minutes is what buys back the rest.',
    'Set a standing time to run it again next week. The power is in the rhythm, not the first pass.',
  ],
  nextStep: [
    'The Weekly Reset is the habit. The MotherMode OS is what runs underneath it all week, so the reset gets easier every time. Find it in your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

register({
  productId: 'mm_mental_load_audit',
  name: 'Welcome to The Mental Load Audit',
  eyebrow: 'The Mental Load Series',
  subject: 'Now you know what to fix first, {{name}}',
  preheader: 'The Mental Load Audit is ready. A short diagnostic with a clear next move.',
  intro: [
    'Hi {{name}}, instead of trying to fix everything at once, you are about to find the one place the load is heaviest, and start there.',
    'Most mothers carry too much to know where to begin. The audit answers that for you, so your energy goes to the thing that will actually move.',
  ],
  whatYouGet: [
    'The short diagnostic that scores where your mental load is heaviest right now.',
    'A clear read on which area to fix first, so you stop spreading yourself thin.',
    'A focused next step matched to your result, not a generic to-do list.',
    'A baseline you can re-run later to see what has actually changed.',
  ],
  tonight: [
    'Open MotherMode and take the audit. It is short on purpose. Answer fast and trust your first instinct.',
    'Read your result and do only the one next step it points you to. One real fix beats ten half-starts.',
  ],
  nextStep: [
    'The Audit tells you where to start. The full MotherMode toolkit is how you fix each area as you get to it, in the order that matters for your family. It is in your account.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});

// ---------------------------------------------------------------------------
// Ascension offers (upsells)
// ---------------------------------------------------------------------------

register({
  productId: 'mothermode_os',
  name: 'Welcome to the MotherMode OS',
  eyebrow: 'Founding Member',
  subject: 'You are in, {{name}}. Welcome to the OS',
  preheader: 'Your MotherMode OS membership is active. Here is your first move.',
  intro: [
    'Hi {{name}}, this is the one that changes the day-to-day. The packs solve one problem each. The OS runs the whole house with you, in plain words, every single day.',
    'You locked your founding rate, which means this is the lowest the OS will ever cost you, held for as long as you stay. Thank you for being one of the first.',
  ],
  whatYouGet: [
    'A chat-first operating system you run by talking, no new app to keep up with.',
    'Meal planning, grocery lists, and routines that adjust around your real week.',
    'A system that holds the mental load with you, so it stops living only in your head.',
    'Every new pack and improvement, added to your account as it ships.',
  ],
  tonight: [
    'Open MotherMode and ask it one real thing from this week. Plan three dinners, sort tomorrow morning, or build a grocery list. Watch it answer like it already knows your house.',
    'Do not try to set up everything at once. Use it for one thing today. Let it earn the next thing tomorrow.',
  ],
  nextStep: [
    'Most founding members move to the annual rate once the OS proves itself, because it locks the savings in for good. If that offer is still open in your account, it is worth the two minutes.',
  ],
  cta: { label: 'Open the OS', url: ACCESS_URL },
});

register({
  productId: 'mothermode_redesign_vault',
  name: 'Welcome to the Redesign Vault',
  eyebrow: 'Lifetime Access',
  subject: 'Every pack, for good. Welcome to the Vault',
  preheader: 'The Redesign Vault is unlocked. Every pack you have, and every one to come.',
  intro: [
    'Hi {{name}}, you just made the simplest decision in the whole redesign. Instead of buying packs one at a time, you own the entire library, for good.',
    'Every pack we have built and every pack we ship next is now yours, sitting in your account, ready the moment a new season of motherhood asks for it.',
  ],
  whatYouGet: [
    'The complete MotherMode library, every current pack unlocked at once.',
    'Every future pack added to your Vault automatically, at no extra cost.',
    'The right system ready before you need it, not after the hard week starts.',
    'One place that grows with your family instead of one purchase at a time.',
  ],
  tonight: [
    'Open MotherMode and browse the Vault. Start with the pack that matches the season you are in right now, then leave the rest for when you need them.',
    'You do not have to use all of it. That is the point of owning all of it. The right tool is simply there when the moment comes.',
  ],
  cta: { label: 'Open the Vault', url: ACCESS_URL },
});

register({
  productId: 'mothermode_coaching',
  name: 'Welcome to the Founding Coaching Year',
  eyebrow: 'Founding Coaching',
  subject: 'Your coaching year starts now, {{name}}',
  preheader: 'Your founding coaching seat is confirmed. Here is what happens next.',
  intro: [
    'Hi {{name}}, this is the closest thing to having someone in the room with you. For the next year, you are not redesigning motherhood alone.',
    'You took a real seat in a small founding room. Twice a month, live, you bring the week that is not working and leave with the next move. In between, you are surrounded by mothers carrying the same load.',
  ],
  whatYouGet: [
    'Two live group coaching calls a month, all year, built around real weeks.',
    'Help shaped around your kids, your schools, and the season you are actually in.',
    'A private circle of founding mothers, so a question at 11pm gets a real answer.',
    'Everything in the OS underneath it, so the coaching has a system to land on.',
  ],
  tonight: [
    'Watch your inbox for the welcome details and the calendar holds for this month two calls. Add them now, while it is in front of you.',
    'Before the first call, write down the one part of the week that keeps breaking. That sentence is where we will start.',
  ],
  outro: [
    'A seat like this is meant to be used. Come to the first call even if the week was a mess. Especially if the week was a mess.',
  ],
  cta: { label: 'Open MotherMode', url: ACCESS_URL },
});
