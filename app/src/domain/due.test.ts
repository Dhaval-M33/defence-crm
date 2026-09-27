import { describe, expect, test } from "vitest";

import { dueOnOrBefore, isOverdue } from "./due";
import type { DueCandidate } from "./due";

const today = "2026-09-27";

function requirement(
  id: string,
  submissionDeadline: string,
  status: DueCandidate["status"],
): DueCandidate {
  return { id, submissionDeadline, status };
}

describe("due today or earlier", () => {
  test("a requirement due today appears", () => {
    const list = [requirement("R1", today, "received")];
    expect(dueOnOrBefore(list, today).map((entry) => entry.id)).toEqual(["R1"]);
  });

  test("anything earlier than today appears", () => {
    const list = [
      requirement("yesterday", "2026-09-26", "quoted"),
      requirement("lastweek", "2026-09-20", "submitted"),
      requirement("lastyear", "2025-12-31", "qualifying"),
    ];
    expect(dueOnOrBefore(list, today).map((entry) => entry.id)).toEqual([
      "yesterday",
      "lastweek",
      "lastyear",
    ]);
  });

  test("tomorrow does not appear", () => {
    const list = [requirement("tomorrow", "2026-09-28", "received")];
    expect(dueOnOrBefore(list, today)).toEqual([]);
  });

  test("a requirement with no deadline does not appear", () => {
    const list = [requirement("blank", "", "received")];
    expect(dueOnOrBefore(list, today)).toEqual([]);
  });

  test("decided or cancelled requirements do not appear", () => {
    const list = [
      requirement("won", "2026-09-01", "won"),
      requirement("lost", "2026-09-01", "lost"),
      requirement("cancelled", "2026-09-01", "cancelled"),
    ];
    expect(dueOnOrBefore(list, today)).toEqual([]);
  });

  test("overdue is distinguished from due today", () => {
    expect(isOverdue(requirement("late", "2026-09-26", "received"), today)).toBe(true);
    expect(isOverdue(requirement("onTime", today, "received"), today)).toBe(false);
  });
});
