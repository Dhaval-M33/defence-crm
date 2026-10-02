import { describe, expect, test } from "vitest";

import { isLeadOverdue, isOpenLeadStage, leadsDueOnOrBefore, LEAD_SOURCES, LEAD_STAGES } from "./leads";
import type { LeadCandidate } from "./leads";

const today = "2026-10-02";

function lead(id: string, followUpDate: string, stage: LeadCandidate["stage"]): LeadCandidate {
  return { id, followUpDate, stage };
}

describe("lead stages and sources", () => {
  test("the six stages and three sources are exactly the agreed lists", () => {
    expect(LEAD_STAGES).toEqual(["new", "contacted", "visited", "negotiation", "won", "lost"]);
    expect(LEAD_SOURCES).toEqual(["call", "whatsapp", "referral"]);
  });

  test("won and lost are closed, the rest are open", () => {
    expect(isOpenLeadStage("won")).toBe(false);
    expect(isOpenLeadStage("lost")).toBe(false);
    expect(isOpenLeadStage("new")).toBe(true);
    expect(isOpenLeadStage("contacted")).toBe(true);
    expect(isOpenLeadStage("visited")).toBe(true);
    expect(isOpenLeadStage("negotiation")).toBe(true);
  });
});

describe("leads due today or earlier", () => {
  test("a lead with a follow-up of today is listed", () => {
    const list = [lead("L1", today, "new")];
    expect(leadsDueOnOrBefore(list, today).map((entry) => entry.id)).toEqual(["L1"]);
  });

  test("overdue leads are listed", () => {
    const list = [lead("yesterday", "2026-10-01", "contacted"), lead("lastmonth", "2026-09-01", "negotiation")];
    expect(leadsDueOnOrBefore(list, today).map((entry) => entry.id)).toEqual(["yesterday", "lastmonth"]);
  });

  test("tomorrow is not listed", () => {
    const list = [lead("tomorrow", "2026-10-03", "new")];
    expect(leadsDueOnOrBefore(list, today)).toEqual([]);
  });

  test("won and lost leads are never listed, even when overdue", () => {
    const list = [lead("won", "2026-09-01", "won"), lead("lost", "2026-09-01", "lost")];
    expect(leadsDueOnOrBefore(list, today)).toEqual([]);
  });

  test("overdue is distinguished from due today", () => {
    expect(isLeadOverdue(lead("late", "2026-10-01", "new"), today)).toBe(true);
    expect(isLeadOverdue(lead("now", today, "new"), today)).toBe(false);
    expect(isLeadOverdue(lead("done", "2026-10-01", "won"), today)).toBe(false);
  });
});
