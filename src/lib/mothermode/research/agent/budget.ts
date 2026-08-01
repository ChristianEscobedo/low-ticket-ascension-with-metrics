/**
 * Research budgets + the kill switch (roadmap task 2.4): the enforceable
 * core of plan-approve-execute. Per-round and per-day caps on PAID tool
 * runs (the free lane — web_search, internal_metrics, get_context,
 * create_artifact — never budgets), plus the provider kill switch.
 *
 * Pure: no imports. The loop reads usage from the call log (0.3 telemetry)
 * and checks this before spending; the cost table lives in ./cost.
 */

export interface ResearchBudget {
  /** Max paid calls in ONE tool round (a sweep is capped, not cancelled). */
  turnPaidRuns: number;
  /** Max paid calls per session per day. */
  dayPaidRuns: number;
  /** Max estimated spend (cents) per session per day. */
  dayEstCostCents: number;
}

/** The honest defaults: a deep dive or two plus a sweep, not a runaway. */
export const DEFAULT_RESEARCH_BUDGET: ResearchBudget = {
  turnPaidRuns: 6,
  dayPaidRuns: 25,
  dayEstCostCents: 200,
};

export interface CallUsage {
  paidRunsToday: number;
  estCostCentsToday: number;
}

export const ZERO_USAGE: CallUsage = {
  paidRunsToday: 0,
  estCostCentsToday: 0,
};

export type BudgetCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * May this round's paid calls run? The kill switch wins first, then the
 * per-round cap, then the daily caps. The reason is READABLE — the model
 * sees it as the tool result and tells the owner plainly.
 */
export function checkBudget(opts: {
  usage: CallUsage;
  plannedPaidRuns: number;
  plannedEstCostCents: number;
  budget?: ResearchBudget;
  killSwitch?: boolean;
}): BudgetCheck {
  if (opts.killSwitch) {
    return {
      allowed: false,
      reason:
        'the paid-tools kill switch is on (RESEARCH_PAID_TOOLS_OFF). Paid scrapers are off until the owner turns them back on; use the free tools (web_search, internal_metrics, get_context) and say so.',
    };
  }
  const budget = opts.budget ?? DEFAULT_RESEARCH_BUDGET;
  if (opts.plannedPaidRuns > budget.turnPaidRuns) {
    return {
      allowed: false,
      reason: `this round plans ${opts.plannedPaidRuns} paid runs and the per-round cap is ${budget.turnPaidRuns}. Run fewer paid tools at once (one dive or sweep per round) and continue.`,
    };
  }
  if (opts.usage.paidRunsToday + opts.plannedPaidRuns > budget.dayPaidRuns) {
    return {
      allowed: false,
      reason: `the session is at ${opts.usage.paidRunsToday} of ${budget.dayPaidRuns} paid runs today. The daily budget is spent; use the free tools or come back tomorrow.`,
    };
  }
  if (
    opts.usage.estCostCentsToday + opts.plannedEstCostCents >
    budget.dayEstCostCents
  ) {
    return {
      allowed: false,
      reason: `the session is at ~$${(opts.usage.estCostCentsToday / 100).toFixed(2)} of the ~$${(budget.dayEstCostCents / 100).toFixed(2)} daily estimate. The daily budget is spent; use the free tools or come back tomorrow.`,
    };
  }
  return { allowed: true };
}

/** The tool outcome a blocked call returns (never a crash, never silent). */
export function budgetBlockedOutcome(name: string, reason: string) {
  return {
    content: `${name} blocked by the research budget: ${reason}`,
    inputSummary: '',
    resultSummary: 'blocked: budget',
  };
}
