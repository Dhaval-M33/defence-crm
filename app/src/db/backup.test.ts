import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import { BackupRefused, exportBackup, importBackup } from "./backup";
import { resetDatabase, save } from "./gateway";
import { db } from "./schema";

const actor = "Ram Prasad";
const deadline = "2026-09-30";
const deliveryDate = "2026-10-30";
const responseDate = "2026-09-27";

async function seedEverything() {
  const client = await save(
    "clients",
    { name: "HAL", division: "Aero", location: "BLR", contact: "", email: "", phone: "" },
    actor,
  );
  const oemA = await save(
    "oems",
    { name: "OEM A", location: "BLR", contact: "", email: "", phone: "", approved: true, notes: "" },
    actor,
  );
  const oemB = await save(
    "oems",
    { name: "OEM B", location: "BLR", contact: "", email: "", phone: "", approved: false, notes: "" },
    actor,
  );
  const part = await save(
    "parts",
    { partNumber: "P1", clientPartNumber: "", description: "Power panel", oemId: null, uom: "nos" },
    actor,
  );
  await save("supplies", { oemId: oemA.id, partId: part.id, supplyQty: 1000 }, actor);
  await save("supplies", { oemId: oemB.id, partId: part.id, supplyQty: 1000 }, actor);
  const requirement = await save(
    "requirements",
    {
      clientId: client.id,
      title: "Power panel",
      project: "LCA",
      source: "SRM",
      tenderRef: "H-01",
      submissionDeadline: deadline,
      status: "received",
      remarks: "",
    },
    actor,
  );
  const line = await save(
    "lines",
    {
      requirementId: requirement.id,
      partId: part.id,
      requiredQty: 1000,
      technicalSpec: "per drawing",
      requiredDeliveryDate: deliveryDate,
    },
    actor,
  );
  await save(
    "responses",
    { lineId: line.id, oemId: oemA.id, qty: 600, commitmentType: "firm", responseDate, note: "" },
    actor,
  );
  await save(
    "responses",
    { lineId: line.id, oemId: oemB.id, qty: 400, commitmentType: "indication", responseDate, note: "" },
    actor,
  );
  return { requirementId: requirement.id };
}

async function counts() {
  return {
    clients: await db.clients.count(),
    oems: await db.oems.count(),
    parts: await db.parts.count(),
    requirements: await db.requirements.count(),
    lines: await db.lines.count(),
    supplies: await db.supplies.count(),
    responses: await db.responses.count(),
    audit: await db.audit.count(),
  };
}

describe("backup round-trip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("export, wipe, import restores every table including the audit trail", async () => {
    await seedEverything();
    const before = await counts();
    const beforeResponses = await db.responses.orderBy("id").toArray();
    const beforeAudit = await db.audit.orderBy("id").toArray();

    const backup = await exportBackup();

    await resetDatabase();
    expect(await db.responses.count()).toBe(0);
    expect(await db.audit.count()).toBe(0);

    const result = await importBackup(backup);

    expect(await counts()).toEqual(before);
    expect(result.counts.responses).toBe(before.responses);
    expect(await db.responses.orderBy("id").toArray()).toEqual(beforeResponses);
    expect(await db.audit.orderBy("id").toArray()).toEqual(beforeAudit);
  });

  test("the restored data still computes the same coverage", async () => {
    const { requirementId } = await seedEverything();
    const backup = await exportBackup();
    await resetDatabase();
    await importBackup(backup);

    const { uncoveredView } = await import("../domain/coverage");
    const { toLedger, loadSnapshot } = await import("./snapshot");
    const view = uncoveredView(requirementId, toLedger(await loadSnapshot()));

    expect(view.totals.requiredQty).toBe(1000);
    expect(view.totals.firmQty).toBe(600);
    expect(view.totals.indicationQty).toBe(400);
    expect(view.totals.coveredQty).toBe(600);
    expect(view.totals.uncoveredQty).toBe(400);
  });

  test("a file that is not a backup is refused and leaves the data untouched", async () => {
    await seedEverything();
    const before = await counts();

    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(importBackup(garbage)).rejects.toBeInstanceOf(BackupRefused);
    expect(await counts()).toEqual(before);

    const wrongFormat = await exportBackup();
    const { strFromU8, strToU8, unzipSync, zipSync } = await import("fflate");
    const entries = unzipSync(wrongFormat);
    const payload = JSON.parse(strFromU8(entries["data.json"]!)) as { format: string };
    payload.format = "something-else";
    const tampered = zipSync({ "data.json": strToU8(JSON.stringify(payload)) });

    await expect(importBackup(tampered)).rejects.toThrow(/not in the expected format/);
    expect(await counts()).toEqual(before);
  });
});
