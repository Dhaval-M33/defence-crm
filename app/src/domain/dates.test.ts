import { describe, expect, test } from "vitest";

import { isoDatePlusDays, isDueOnOrBefore, toLocalIsoDate, todayLocalIso } from "./dates";

describe("date helpers", () => {
  test("formats a local date with zero padding", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
    expect(toLocalIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  test("today is the local date, not the UTC date", () => {
    const localLateEvening = new Date(2026, 8, 27, 23, 30, 0);
    expect(todayLocalIso(localLateEvening)).toBe("2026-09-27");

    const localEarlyMorning = new Date(2026, 8, 28, 0, 30, 0);
    expect(todayLocalIso(localEarlyMorning)).toBe("2026-09-28");
  });

  test("adds days across a month boundary", () => {
    expect(isoDatePlusDays(3, new Date(2026, 8, 29))).toBe("2026-10-02");
  });

  test("due on or before treats today as due and tomorrow as not", () => {
    const today = "2026-09-27";
    expect(isDueOnOrBefore("2026-09-27", today)).toBe(true);
    expect(isDueOnOrBefore("2026-09-26", today)).toBe(true);
    expect(isDueOnOrBefore("2026-01-05", today)).toBe(true);
    expect(isDueOnOrBefore("2026-09-28", today)).toBe(false);
    expect(isDueOnOrBefore("2026-10-01", today)).toBe(false);
  });

  test("a missing deadline is never due", () => {
    expect(isDueOnOrBefore("", "2026-09-27")).toBe(false);
  });
});
