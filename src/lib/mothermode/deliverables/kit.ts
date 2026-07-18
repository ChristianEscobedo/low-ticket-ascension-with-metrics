/**
 * A tiny HTML string-builder kit shared by every deliverable document. Keeps
 * the 8 long-form resources visually identical and on-brand (design-guide.txt:
 * Bone/Ink/Mode/Brass, Tiempos-style display headings, generous line height,
 * no em dashes, no decorative excess) without hand-repeating Tailwind classes
 * in every content file.
 *
 * Every helper returns a plain HTML string. Content authors compose a
 * document body by concatenating calls to these, then export the result as a
 * DeliverableDoc.html. The delivery page renders it with dangerouslySetInnerHTML
 * inside a themed shell; nothing here ever touches user input.
 */

export const eyebrow = (text: string) =>
  `<div class="text-xs font-semibold uppercase tracking-[0.2em] text-mode">${text}</div>`;

export const h1 = (text: string) =>
  `<h1 class="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">${text}</h1>`;

export const h2 = (text: string) =>
  `<h2 class="mt-12 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">${text}</h2>`;

export const h3 = (text: string) =>
  `<h3 class="mt-8 font-display text-xl text-ink">${text}</h3>`;

export const lead = (text: string) =>
  `<p class="mt-4 text-lg leading-relaxed text-ink/80">${text}</p>`;

export const p = (text: string) =>
  `<p class="mt-4 leading-relaxed text-ink/75">${text}</p>`;

export const small = (text: string) =>
  `<p class="mt-2 text-sm leading-relaxed text-ink/55">${text}</p>`;

/** A neutral, mode-tinted callout for a key idea. */
export const callout = (text: string) =>
  `<div class="mt-6 rounded-2xl border border-mode/20 bg-mode/[0.05] p-5 leading-relaxed text-ink/80">${text}</div>`;

/** A labeled brass note. Use for "do this tonight" / time-boxed actions. */
export const note = (label: string, text: string) =>
  `<div class="mt-6 rounded-2xl border border-brass/30 bg-brass/[0.06] p-5 leading-relaxed text-ink/80">
    <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-brass">${label}</span>
    ${text}
  </div>`;

/** A quoted, italic line set apart. Use for the one sentence worth remembering. */
export const pullQuote = (text: string) =>
  `<p class="mt-6 border-l-2 border-mode pl-5 font-display text-xl italic leading-snug text-ink">${text}</p>`;

export const ul = (items: string[]) =>
  `<ul class="mt-4 space-y-2.5">${items
    .map(
      (i) =>
        `<li class="flex items-start gap-2.5 leading-relaxed text-ink/75"><span class="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mode"></span><span>${i}</span></li>`,
    )
    .join('')}</ul>`;

export const ol = (items: string[]) =>
  `<ol class="mt-4 space-y-3">${items
    .map(
      (i, idx) =>
        `<li class="flex items-start gap-3 leading-relaxed text-ink/75"><span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-mode text-xs font-semibold text-bone">${
          idx + 1
        }</span><span class="flex-1 pt-0.5">${i}</span></li>`,
    )
    .join('')}</ol>`;

/** A two-line checklist item: a bold label plus a short description. Used for
 *  domain checklists, first-night steps, etc. */
export const checkItem = (label: string, description?: string) =>
  `<li class="flex items-start gap-3 py-2.5">
    <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-mode/40"></span>
    <span class="flex-1">
      <span class="font-medium text-ink">${label}</span>
      ${description ? `<span class="block text-sm leading-relaxed text-ink/60">${description}</span>` : ''}
    </span>
  </li>`;

export const checklist = (itemsHtml: string[]) =>
  `<ul class="mt-4 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white/50 px-5">${itemsHtml.join(
    '',
  )}</ul>`;

/** A copy-ready script block. `tone` is a small brass tag ("Softer" / "Firmer"
 *  / "When it comes back"). */
export const scriptCard = (label: string, tone: string, body: string) =>
  `<div class="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-5">
    <div class="flex items-center justify-between gap-3">
      <span class="font-display text-base text-ink">${label}</span>
      <span class="flex-shrink-0 rounded-full border border-brass/30 bg-brass/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brass">${tone}</span>
    </div>
    <p class="mt-3 leading-relaxed text-ink/80">&ldquo;${body}&rdquo;</p>
  </div>`;

/** A person-grouped section header inside the delegate scripts. */
export const personHeader = (name: string, relation: string) =>
  `<div class="mt-10 flex items-baseline gap-3 border-b border-ink/10 pb-2">
    <span class="font-display text-lg text-ink">${name}</span>
    <span class="text-xs uppercase tracking-[0.16em] text-ink/40">${relation}</span>
  </div>`;

/** A compact domain-count bar for the Load Map. `pct` 0 to 100. */
export const loadBar = (label: string, pct: number, tint: 'mode' | 'brass' = 'mode') =>
  `<div class="mt-3">
    <div class="flex items-baseline justify-between text-sm">
      <span class="font-medium text-ink">${label}</span>
      <span class="text-ink/50">${pct}%</span>
    </div>
    <div class="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div class="h-full rounded-full bg-${tint}" style="width:${pct}%"></div>
    </div>
  </div>`;

export const divider = () => `<div class="my-12 h-px bg-ink/10"></div>`;

/** A simple two-column table. Use sparingly, matches the editorial-restraint rule. */
export const table = (headers: string[], rows: string[][]) =>
  `<div class="mt-6 overflow-hidden rounded-2xl border border-ink/10">
    <table class="w-full text-left text-sm">
      <thead class="bg-ink/[0.03]">
        <tr>${headers
          .map(
            (h) =>
              `<th class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">${h}</th>`,
          )
          .join('')}</tr>
      </thead>
      <tbody class="divide-y divide-ink/10">
        ${rows
          .map(
            (r) =>
              `<tr>${r
                .map(
                  (c, i) =>
                    `<td class="px-4 py-3 leading-relaxed text-ink/75 ${i === 0 ? 'font-medium text-ink' : ''}">${c}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>`;

/** The closing "next step" strip every document ends on. */
export const nextStep = (text: string) =>
  `<div class="mt-14 flex items-start gap-3 rounded-2xl border border-mode/20 bg-mode/[0.04] p-5">
    <span class="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-mode"></span>
    <p class="leading-relaxed text-ink/80"><span class="font-semibold text-ink">Next: </span>${text}</p>
  </div>`;

/**
 * A mount point for a client-side interactive tool. ResourceDocument splits
 * the document HTML on this marker and renders a registered React component
 * in its place, so a document can stay a plain HTML string almost
 * everywhere and drop into an interactive workspace at one exact spot.
 */
export const interactiveSlot = (id: string) => `<div data-mm-slot="${id}"></div>`;

/**
 * A branded promo band for the MotherMode OS (the app this whole low-ticket
 * pack leads into). `features` renders as short bolded phrases, matching the
 * app's real capabilities so the promise stays honest. `href` defaults to the
 * OS upsell page.
 */
export const appPromo = (
  eyebrowText: string,
  headline: string,
  body: string,
  features: string[],
  ctaLabel: string,
  href = '/mothermode/upsell',
) =>
  `<div class="mt-10 rounded-3xl border border-mode/25 bg-gradient-to-br from-mode/[0.07] to-brass/[0.05] p-6 sm:p-8">
    <div class="text-xs font-semibold uppercase tracking-[0.2em] text-mode">${eyebrowText}</div>
    <h3 class="mt-2 font-display text-xl font-semibold text-ink sm:text-2xl">${headline}</h3>
    <p class="mt-3 leading-relaxed text-ink/75">${body}</p>
    <ul class="mt-5 space-y-2">${features
      .map(
        (f) =>
          `<li class="flex items-start gap-2.5 text-sm leading-relaxed text-ink/70"><span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brass"></span><span>${f}</span></li>`,
      )
      .join('')}</ul>
    <a href="${href}" class="mt-6 inline-flex items-center gap-2 rounded-full bg-mode px-5 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep">
      ${ctaLabel}
      <span aria-hidden="true">&rarr;</span>
    </a>
  </div>`;

/** A small, quiet one-line breadcrumb toward the app. Use inline, mid-document,
 *  where a full promo band would be too much. */
export const appBreadcrumb = (text: string, href = '/mothermode/upsell') =>
  `<p class="mt-6 text-sm leading-relaxed text-ink/55">${text} <a href="${href}" class="font-semibold text-mode underline decoration-mode/30 underline-offset-2 hover:text-mode-deep">See how &rarr;</a></p>`;

/** Wraps a set of section HTML strings into one document body. */
export const doc = (...parts: string[]) => parts.join('\n');
