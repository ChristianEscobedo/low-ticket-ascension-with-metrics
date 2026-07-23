/**
 * Campaign catalog. Each EmailCampaignSpec is a sequence blueprint: the ordered
 * arc of email roles, the default send-offsets, an optional per-role framework
 * default, the context kinds the campaign is usually built around, and a short
 * strategy note the generator injects into the outline prompt.
 *
 * Kept as data so a campaign's shape can be tuned without touching generation
 * logic. The generator reads emailRoles to know how many emails to write and
 * what each one is for; the editor reads label/goal to drive the picker.
 */
import type {
  EmailCampaignSpec,
  EmailCampaignType,
  EmailTimingStyle,
} from '../types';
import { EMAIL_CAMPAIGN_TYPES } from '../types';

export const EMAIL_CAMPAIGN_SPECS: Record<EmailCampaignType, EmailCampaignSpec> = {
  'leadmag-to-lowticket': {
    label: 'Lead magnet to low-ticket',
    goal: 'Turn a fresh lead-magnet subscriber into a low-ticket buyer.',
    expectsContext: ['lead-gen-kit', 'offer'],
    emailRoles: ['deliver', 'teach', 'story', 'proof', 'offer', 'objection', 'last-call'],
    defaultTiming: ['+0h', '+1d', '+2d', '+3d', '+4d', '+5d', '+6d'],
    frameworkByRole: {
      deliver: 'founder-note',
      teach: 'value-longform',
      story: 'story-lesson',
      proof: 'case-study',
      offer: 'pas',
      objection: 'objection-crusher',
      'last-call': 'pas',
    },
    strategyNote:
      'Deliver the promised lead magnet first and build trust with value before ' +
      'the first offer. Escalate from teaching to proof to a clear, low-friction ' +
      'purchase, then handle the top objection and close with a genuine last call.',
  },
  'nurture-to-offer': {
    label: 'Nurture to offer',
    goal: 'Warm a list with value, then bridge to a single clear offer.',
    expectsContext: ['offer', 'lead-gen-kit', 'high-ticket-kit'],
    emailRoles: ['nurture', 'teach', 'story', 'bridge', 'offer', 'objection', 'urgency'],
    defaultTiming: ['+0d', '+2d', '+4d', '+6d', '+7d', '+8d', '+9d'],
    frameworkByRole: {
      nurture: 'story-lesson',
      teach: 'value-longform',
      story: 'soap-opera',
      bridge: 'story-lesson',
      offer: 'pas',
      objection: 'objection-crusher',
      urgency: 'pas',
    },
    strategyNote:
      'Lead with value the reader can use immediately. Use the bridge email to ' +
      'connect the nurture theme to the offer so the pitch feels like the natural ' +
      'next step, not a pivot.',
  },
  'cart-abandonment': {
    label: 'Cart abandonment',
    goal: 'Recover a checkout the reader started but did not finish.',
    expectsContext: ['offer'],
    emailRoles: ['reminder', 'objection', 'proof', 'urgency', 'last-call'],
    defaultTiming: ['+1h', '+1d', '+2d', '+3d', '+4d'],
    frameworkByRole: {
      reminder: 'founder-note',
      objection: 'objection-crusher',
      proof: 'case-study',
      urgency: 'pas',
      'last-call': 'pas',
    },
    strategyNote:
      'Assume good intent: the reader got interrupted, not that they are avoiding ' +
      'you. Remind, remove the specific friction that stops checkout, prove it ' +
      'works, then close with an honest deadline.',
  },
  'pre-post-purchase': {
    label: 'Pre / post purchase',
    goal: 'Reduce refunds and drive activation right after a purchase.',
    expectsContext: ['offer', 'lead-gen-kit'],
    emailRoles: ['welcome', 'onboard', 'teach', 'proof', 'bridge'],
    defaultTiming: ['+0h', '+1d', '+3d', '+5d', '+7d'],
    frameworkByRole: {
      welcome: 'founder-note',
      onboard: 'quick-win',
      teach: 'value-longform',
      proof: 'case-study',
      bridge: 'story-lesson',
    },
    strategyNote:
      'Confirm the buyer made a great decision, get them to a first win fast, and ' +
      'set up the natural next step (an upsell or the ascension offer) without ' +
      'pressure. Activation prevents refunds.',
  },
  'webinar-event': {
    label: 'Webinar / event',
    goal: 'Register, remind, and follow up for a live or recorded event.',
    expectsContext: ['offer', 'high-ticket-kit'],
    emailRoles: ['invite', 'teach', 'reminder', 'reminder', 'replay', 'offer'],
    defaultTiming: ['-5d', '-3d', '-1d', '+0h', '+1d', '+2d'],
    frameworkByRole: {
      invite: 'pas',
      teach: 'value-longform',
      reminder: 'quick-win',
      replay: 'founder-note',
      offer: 'pas',
    },
    strategyNote:
      'Sell the transformation the event delivers, not the event logistics. Drive ' +
      'registrations, keep the date top of mind, and convert attendees and ' +
      'replay-watchers into buyers with a clear post-event offer.',
  },
  'community-onboarding': {
    label: 'Community onboarding',
    goal: 'Welcome and activate a new community or membership member.',
    expectsContext: ['community-kit', 'offer'],
    emailRoles: ['welcome', 'onboard', 'teach', 'story', 'invite'],
    defaultTiming: ['+0h', '+1d', '+3d', '+5d', '+7d'],
    frameworkByRole: {
      welcome: 'founder-note',
      onboard: 'quick-win',
      teach: 'value-longform',
      story: 'story-lesson',
      invite: 'founder-note',
    },
    strategyNote:
      'Make the new member feel they belong immediately. Give them one clear first ' +
      'action, show what good participation looks like, and invite them deeper into ' +
      'the community rhythm.',
  },
  'event-nurture': {
    label: 'Event nurture',
    goal: 'Keep a long runway warm before a launch or event date.',
    expectsContext: ['offer', 'high-ticket-kit', 'lead-gen-kit'],
    emailRoles: ['nurture', 'teach', 'story', 'proof', 'bridge', 'invite'],
    defaultTiming: ['-14d', '-11d', '-8d', '-5d', '-3d', '-1d'],
    frameworkByRole: {
      nurture: 'story-lesson',
      teach: 'value-longform',
      story: 'soap-opera',
      proof: 'case-study',
      bridge: 'story-lesson',
      invite: 'pas',
    },
    strategyNote:
      'Spread value across the runway so anticipation builds naturally. Each email ' +
      'seeds the theme of the event, so by invite day the reader already wants in.',
  },
  reengagement: {
    label: 'Re-engagement / win-back',
    goal: 'Wake up a cold segment and win back lapsed subscribers.',
    expectsContext: ['offer', 'lead-gen-kit'],
    emailRoles: ['reengage', 'story', 'teach', 'offer', 'last-call'],
    defaultTiming: ['+0d', '+2d', '+4d', '+6d', '+8d'],
    frameworkByRole: {
      reengage: 'founder-note',
      story: 'story-lesson',
      teach: 'quick-win',
      offer: 'pas',
      'last-call': 'founder-note',
    },

    strategyNote:
      'Acknowledge the silence honestly and give a reason to re-open the ' +
      'relationship. Lead with a quick win, not a pitch, and let the final email ' +
      'give a graceful opt-down rather than only a hard close.',
  },
};

/** Resolve one campaign spec, defaulting to nurture-to-offer if unknown. */
export function campaignSpec(type: EmailCampaignType): EmailCampaignSpec {
  return EMAIL_CAMPAIGN_SPECS[type] ?? EMAIL_CAMPAIGN_SPECS['nurture-to-offer'];
}

/** All campaign keys in canonical order. */
export function allCampaigns(): EmailCampaignType[] {
  return [...EMAIL_CAMPAIGN_TYPES];
}

// ---------------------------------------------------------------------------
// Timing style scaling
// ---------------------------------------------------------------------------

const TIMING_MULTIPLIER: Record<EmailTimingStyle, number> = {
  aggressive: 0.5,
  standard: 1,
  gentle: 2,
};

/**
 * Scale a single send-offset token ('+1d', '-3d', '+2h', '+0h') by the timing
 * style. Hours and days are scaled independently; the sign is preserved and the
 * unit is kept. Unparseable tokens pass through unchanged.
 */
export function scaleOffset(offset: string, style: EmailTimingStyle): string {
  const m = /^([+-]?)(\d+(?:\.\d+)?)([hd])$/.exec(offset.trim());
  if (!m) return offset;
  const sign = m[1] === '-' ? '-' : '+';
  const value = Number(m[2]);
  const unit = m[3];
  if (value === 0) return `${sign}0${unit}`;
  const scaled = Math.max(1, Math.round(value * TIMING_MULTIPLIER[style]));
  return `${sign}${scaled}${unit}`;
}

/** Scale a whole timing plan by the timing style. */
export function scaleTiming(offsets: string[], style: EmailTimingStyle): string[] {
  return offsets.map((o) => scaleOffset(o, style));
}
