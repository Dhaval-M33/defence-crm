import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import { isoDatePlusDays, todayLocalIso } from "../domain/dates";
import { dueOnOrBefore } from "../domain/due";
import { resetDatabase, save } from "./gateway";
import { loadSnapshot } from "./snapshot";

const actor = "Ram Prasad";

async function addRequirement(clientId: string, title: string, deadline: string, status: "received" | "lost") {
  return save(
    "requirements",
    {
      clientId,
      title,
      project: "",
      source: "",
      tenderRef: "",
      submissionDeadline: deadline,
      status,
      remarks: "",
    },
    actor,
  );
}

describe("due today or earlier, read from the database", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a requirement whose submission deadline is today is found", async () => {
    const client = await save(
      "clients",
      { name: "HAL", division: "", location: "", contact: "", email: "", phone: "" },
      actor,
    );
    await addRequirement(client.id, "Due today", todayLocalIso(), "received");
    await addRequirement(client.id, "Due tomorrow", isoDatePlusDays(1), "received");
    await addRequirement(client.id, "Due yesterday", isoDatePlusDays(-1), "received");

    const snapshot = await loadSnapshot();
    const found = dueOnOrBefore(snapshot.requirements, todayLocalIso())
      .map((requirement) => requirement.title)
      .sort();

    expect(found).toEqual(["Due today", "Due yesterday"]);
  });

  test("a decided requirement does not appear even when its deadline has passed", async () => {
    const client = await save(
      "clients",
      { name: "BEL", division: "", location: "", contact: "", email: "", phone: "" },
      actor,
    );
    await addRequirement(client.id, "Already lost", isoDatePlusDays(-3), "lost");
    await addRequirement(client.id, "Still open", isoDatePlusDays(-3), "received");

    const snapshot = await loadSnapshot();
    const found = dueOnOrBefore(snapshot.requirements, todayLocalIso()).map((r) => r.title);
    expect(found).toEqual(["Still open"]);
  });
});
