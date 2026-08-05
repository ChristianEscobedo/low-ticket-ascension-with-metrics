export * from './types';
export * from './store';
export { offerToSalesContent, salesContentToOffer } from './fromOffer';
export { ascensionToUpsellContent, upsellContentToAscension } from './fromAscension';
export {
  SALES_EVENT_CAMPAIGN_MAP,
  boundSalesEmailEvents,
  buildSalesEmailPlan,
  planSalesEmailKit,
  type SalesEmailKitPlan,
} from './emailPlan';

// Funnel architecture. The ascension model and the map were pure, unreachable
// modules until `intakeAscension` gave them a real funnel to read; they are
// exported together so callers get the adapter and the model it feeds.
export {
  ASCENSION_STAGES,
  compareDownsellPlacements,
  projectAov,
  suggestAscension,
  validateAscension,
  type AovProjection,
  type AscensionIssue,
  type AscensionIssueCode,
  type AscensionRung,
  type AscensionStage,
  type DownsellPlacement,
  type EscalationAxis,
} from './ascension';
export {
  ATTENTION_DECAY,
  buildFunnelMap,
  orphanedEmails,
  toAsciiMap,
  toMermaid,
  type FunnelMap,
  type FunnelMapInput,
} from './funnelMap';

// The layout pass. Separate from `funnelMap` because the map is the model and
// this is one opinion about how to draw it: pure, DOM-free and therefore
// testable, which the canvas component that consumes it is not.
export {
  FUNNEL_NODE_HEIGHT,
  FUNNEL_NODE_WIDTH,
  funnelNodeStage,
  layoutFunnelMap,
} from './funnelMapLayout';
export {
  ESCALATION_KEYWORDS,
  UPSELL_STAGES,
  auditIntakeFunnel,
  buildFunnelMapFromIntake,
  funnelMapInputFromIntake,
  inferEscalationAxes,
  intakeToAscension,
  intakeToAscensionRungs,
  parseIntakePrice,
  type IntakeAscension,
  type IntakeAscensionNote,
  type IntakeAscensionNoteCode,
  type IntakeFunnelAudit,
  type IntakeFunnelMapOptions,
} from './intakeAscension';
