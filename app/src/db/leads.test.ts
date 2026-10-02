import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import { isoDatePlusDays, todayLocalIso } from "../domain/dates";
import { leadsDueOnOrBefore } from "../domain/leads";
import { exportBackup, importBackup } from "./backup";
import { WriteRefused, listAudit, resetDatabase, save, update } from "./gateway";
import { db } from "./schema";
import { loadSnapshot } from "./snapshot";

const actor = "Ram Prasad";

async function addLead(name: string, followUpDate: string, stage = "new") {
  return save(
    "leads",
    { name, source: "referral", stage, followUpDate, phone: "", notes: "" },
    actor,
  );
}

describe("leads", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a lead keeps its source and stage, and the save is audited", async () => {
    const created = await addLead("Veer Manufacturing", todayLocalIso());
    const stored = await db.leads.get(created.id);
    expect(stored?.source).toBe("referral");
    expect(stored?.stage).toBe("new");

    const audit = await listAudit("leads", created.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actor).toBe(actor);
  });

  test("a lead moves through the stages, and each move is audited", async () => {
    const created = await addLead("Veer Manufacturing", todayLocalIso());

    await update("leads", created.id, { stage: "contacted" }, actor);
    await update("leads", created.id, { stage: "visited" }, actor);
    await update("leads", created.id, { stage: "negotiation" }, actor);

    const stored = await db.leads.get(created.id);
    expect(stored?.stage).toBe("negotiation");

    const audit = await listAudit("leads", created.id);
    expect(audit).toHaveLength(4);
    expect(audit.map((entry) => entry.action).sort()).toEqual([
      "create",
      "update",
      "update",
      "update",
    ]);
  });

  test("a lead without a name, or without a follow-up date, saves nothing", async () => {
    await expect(
      save(
        "leads",
        { name: "", source: "call", stage: "new", followUpDate: todayLocalIso(), phone: "", notes: "" },
        actor,
      ),
    ).rejects.toBeInstanceOf(WriteRefused);

    await expect(
      save(
        "leads",
        { name: "No date", source: "call", stage: "new", followUpDate: "", phone: "", notes: "" },
        actor,
      ),
    ).rejects.toThrow(/YYYY-MM-DD/);

    expect(await db.leads.count()).toBe(0);
  });

  test("a source outside call, whatsapp and referral is refused", async () => {
    await expect(
      save(
        "leads",
        { name: "Bad source", source: "telepathy", stage: "new", followUpDate: todayLocalIso(), phone: "", notes: "" },
        actor,
      ),
    ).rejects.toBeInstanceOf(WriteRefused);
    expect(await db.leads.count()).toBe(0);
  });

  test("the due list read from the database holds today's and overdue open leads only", async () => {
    await addLead("Due today", todayLocalIso());
    await addLead("Overdue", isoDatePlusDays(-2));
    await addLead("Tomorrow", isoDatePlusDays(1));
    await addLead("Won overdue", isoDatePlusDays(-2), "won");

    const snapshot = await loadSnapshot();
    const due = leadsDueOnOrBefore(snapshot.leads, todayLocalIso())
      .map((lead) => lead.name)
      .sort();

    expect(due).toEqual(["Due today", "Overdue"]);
  });

  test("leads survive a backup round-trip", async () => {
    await addLead("Round trip", todayLocalIso());
    const backup = await exportBackup();

    await resetDatabase();
    expect(await db.leads.count()).toBe(0);

    await importBackup(backup);
    expect(await db.leads.count()).toBe(1);
    const stored = (await db.leads.toArray())[0];
    expect(stored?.name).toBe("Round trip");
  });
});
