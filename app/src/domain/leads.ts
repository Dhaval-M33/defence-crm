import { isDueOnOrBefore } from "./dates";

export type LeadSource = "call" | "whatsapp" | "referral";

export type LeadStage =
  | "new"
  | "contacted"
  | "visited"
  | "negotiation"
  | "won"
  | "lost";

export const LEAD_SOURCES: readonly LeadSource[] = ["call", "whatsapp", "referral"];

export const LEAD_STAGES: readonly LeadStage[] = [
  "new",
  "contacted",
  "visited",
  "negotiation",
  "won",
  "lost",
];

/** Stages where the lead is still being worked, so its follow-up date matters. */
export const OPEN_LEAD_STAGES: readonly LeadStage[] = [
  "new",
  "contacted",
  "visited",
  "negotiation",
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  referral: "Referral",
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  visited: "Visited",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export interface LeadCandidate {
  readonly id: string;
  readonly stage: LeadStage;
  readonly followUpDate: string;
}

export function isOpenLeadStage(stage: LeadStage): boolean {
  return OPEN_LEAD_STAGES.indexOf(stage) !== -1;
}

/**
 * Leads whose follow-up is today or already past. Closed leads (won, lost) are
 * excluded, because there is nothing left to chase.
 */
export function leadsDueOnOrBefore<T extends LeadCandidate>(
  leads: readonly T[],
  todayIso: string,
): T[] {
  return leads.filter(
    (lead) => isOpenLeadStage(lead.stage) && isDueOnOrBefore(lead.followUpDate, todayIso),
  );
}

export function isLeadOverdue(lead: LeadCandidate, todayIso: string): boolean {
  return (
    isOpenLeadStage(lead.stage) &&
    lead.followUpDate !== "" &&
    lead.followUpDate < todayIso
  );
}
