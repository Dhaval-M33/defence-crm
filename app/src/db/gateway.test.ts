import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import {
  WriteRefused,
  listAudit,
  loadLedger,
  resetDatabase,
  save,
  uncoveredViewFromDb,
  update,
} from "./gateway";
import { db } from "./schema";

const actor = "Ram Prasad";
const deadline = "2026-09-30";
const deliveryDate = "2026-10-30";
const responseDate = "2026-09-27";

async function seed() {
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
    { name: "OEM B", location: "BLR", contact: "", email: "", phone: "", approved: true, notes: "" },
    actor,
  );
  const part = await save(
    "parts",
    { partNumber: "P1", clientPartNumber: "", description: "", oemId: null, uom: "nos" },
    actor,
  );
  return { clientId: client.id, oemAId: oemA.id, oemBId: oemB.id, partId: part.id };
}

async function newRequirement(clientId: string) {
  return save(
    "requirements",
    {
      clientId,
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
}

describe("write boundary", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a valid requirement saves and appends exactly one audit entry", async () => {
    const { clientId } = await seed();
    const requirement = await newRequirement(clientId);

    const audit = await listAudit("requirements", requirement.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actor).toBe(actor);
    expect(audit[0]?.action).toBe("create");
  });

  test("a requirement without a client is refused and saves nothing", async () => {
    await seed();

    await expect(
      save(
        "requirements",
        {
          clientId: "",
          title: "Power panel",
          project: "",
          source: "",
          tenderRef: "",
          submissionDeadline: deadline,
          status: "received",
          remarks: "",
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(WriteRefused);

    expect(await db.requirements.count()).toBe(0);
    expect(await db.audit.where("entityType").equals("requirements").count()).toBe(0);
  });

  test("a requirement pointing at a client that does not exist is refused", async () => {
    await seed();
    await expect(newRequirement("ghost-client")).rejects.toThrow(/client ghost-client does not exist/);
    expect(await db.requirements.count()).toBe(0);
  });

  test("a line with a fractional quantity is refused", async () => {
    const { clientId, partId } = await seed();
    const requirement = await newRequirement(clientId);

    await expect(
      save(
        "lines",
        { requirementId: requirement.id, partId, requiredQty: 2.5, technicalSpec: "", requiredDeliveryDate: deliveryDate },
        actor,
      ),
    ).rejects.toThrow(/whole number/);

    expect(await db.lines.count()).toBe(0);
  });

  test("a firm response within supply saves", async () => {
    const { clientId, oemAId, partId } = await seed();
    const requirement = await newRequirement(clientId);
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);
    const line = await save(
      "lines",
      { requirementId: requirement.id, partId, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );

    await save(
      "responses",
      { lineId: line.id, oemId: oemAId, qty: 700, commitmentType: "firm", responseDate, note: "" },
      actor,
    );

    expect(await db.responses.count()).toBe(1);
  });

  test("a firm response beyond the shared supply is refused, saves nothing and names the headroom", async () => {
    const { clientId, oemAId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);

    const first = await newRequirement(clientId);
    const firstLine = await save(
      "lines",
      { requirementId: first.id, partId, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );
    await save(
      "responses",
      { lineId: firstLine.id, oemId: oemAId, qty: 700, commitmentType: "firm", responseDate, note: "" },
      actor,
    );

    const second = await newRequirement(clientId);
    const secondLine = await save(
      "lines",
      { requirementId: second.id, partId, requiredQty: 400, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );

    await expect(
      save(
        "responses",
        { lineId: secondLine.id, oemId: oemAId, qty: 400, commitmentType: "firm", responseDate, note: "" },
        actor,
      ),
    ).rejects.toThrow(/leaving 300 available/);

    expect(await db.responses.count()).toBe(1);
  });

  test("an indication beyond supply is allowed because it covers nothing", async () => {
    const { clientId, oemAId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 100 }, actor);
    const requirement = await newRequirement(clientId);
    const line = await save(
      "lines",
      { requirementId: requirement.id, partId, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );

    await save(
      "responses",
      { lineId: line.id, oemId: oemAId, qty: 900, commitmentType: "indication", responseDate, note: "" },
      actor,
    );

    const view = await uncoveredViewFromDb(requirement.id);
    expect(view.totals.firmQty).toBe(0);
    expect(view.totals.indicationQty).toBe(900);
    expect(view.totals.uncoveredQty).toBe(1000);
  });

  test("the uncovered view reads back from the database exactly as the engine computes it", async () => {
    const { clientId, oemAId, oemBId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);
    await save("supplies", { oemId: oemBId, partId, supplyQty: 1000 }, actor);
    const requirement = await newRequirement(clientId);
    const line = await save(
      "lines",
      { requirementId: requirement.id, partId, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );
    await save(
      "responses",
      { lineId: line.id, oemId: oemAId, qty: 600, commitmentType: "firm", responseDate, note: "" },
      actor,
    );
    await save(
      "responses",
      { lineId: line.id, oemId: oemBId, qty: 400, commitmentType: "firm", responseDate, note: "" },
      actor,
    );

    const view = await uncoveredViewFromDb(requirement.id);
    expect(view.totals.requiredQty).toBe(1000);
    expect(view.totals.firmQty).toBe(1000);
    expect(view.totals.coveredQty).toBe(1000);
    expect(view.totals.uncoveredQty).toBe(0);
  });

  test("losing a requirement through the gateway releases its quantity (C7)", async () => {
    const { clientId, oemAId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);

    const first = await newRequirement(clientId);
    const firstLine = await save(
      "lines",
      { requirementId: first.id, partId, requiredQty: 700, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );
    await save(
      "responses",
      { lineId: firstLine.id, oemId: oemAId, qty: 700, commitmentType: "firm", responseDate, note: "" },
      actor,
    );

    const second = await newRequirement(clientId);
    await save(
      "lines",
      { requirementId: second.id, partId, requiredQty: 300, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );

    const beforeLoss = await loadLedger();
    expect(beforeLoss.responses).toHaveLength(1);

    await update("requirements", first.id, { status: "lost" }, actor);

    const view = await uncoveredViewFromDb(first.id);
    expect(view.totals.firmQty).toBe(0);
    expect(view.totals.uncoveredQty).toBe(700);

    const secondNow = await uncoveredViewFromDb(second.id);
    expect(secondNow.totals.uncoveredQty).toBe(300);

    const audit = await listAudit("requirements", first.id);
    expect(audit.map((entry) => entry.action).sort()).toEqual(["create", "update"]);
  });

  test("a response pointing at a line that does not exist is refused", async () => {
    const { oemAId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);

    await expect(
      save(
        "responses",
        { lineId: "ghost-line", oemId: oemAId, qty: 10, commitmentType: "firm", responseDate, note: "" },
        actor,
      ),
    ).rejects.toThrow(/line ghost-line does not exist/);

    expect(await db.responses.count()).toBe(0);
    expect(await db.audit.where("entityType").equals("responses").count()).toBe(0);
  });

  test("an update records the previous and the new value in the audit trail", async () => {
    const { clientId } = await seed();
    const requirement = await newRequirement(clientId);

    await update("requirements", requirement.id, { status: "submitted" }, actor);

    const audit = await listAudit("requirements", requirement.id);
    const change = audit.find((entry) => entry.action === "update");
    const before = change?.before as { status?: string } | undefined;
    const after = change?.after as { status?: string } | undefined;
    expect(before?.status).toBe("received");
    expect(after?.status).toBe("submitted");
  });

  test("a response with quantity zero is refused and saves nothing", async () => {
    const { clientId, oemAId, partId } = await seed();
    await save("supplies", { oemId: oemAId, partId, supplyQty: 1000 }, actor);
    const requirement = await newRequirement(clientId);
    const line = await save(
      "lines",
      { requirementId: requirement.id, partId, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: deliveryDate },
      actor,
    );

    await expect(
      save(
        "responses",
        { lineId: line.id, oemId: oemAId, qty: 0, commitmentType: "firm", responseDate, note: "" },
        actor,
      ),
    ).rejects.toThrow(/greater than zero/);

    expect(await db.responses.count()).toBe(0);
  });
});
