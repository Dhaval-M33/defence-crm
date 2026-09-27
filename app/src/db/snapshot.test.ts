import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import { uncoveredView } from "../domain/coverage";
import { resetDatabase, save } from "./gateway";
import { loadSnapshot, toLedger } from "./snapshot";

const actor = "Ram Prasad";

describe("snapshot read path used by the coverage screen", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("snapshot to ledger to uncovered view matches the engine on real rows", async () => {
    const client = await save("clients", { name: "HAL", division: "", location: "", contact: "", email: "", phone: "" }, actor);
    const oemA = await save("oems", { name: "OEM A", location: "", contact: "", email: "", phone: "", approved: true, notes: "" }, actor);
    const oemB = await save("oems", { name: "OEM B", location: "", contact: "", email: "", phone: "", approved: true, notes: "" }, actor);
    const part = await save("parts", { partNumber: "P1", clientPartNumber: "", description: "", oemId: null, uom: "nos" }, actor);
    await save("supplies", { oemId: oemA.id, partId: part.id, supplyQty: 1000 }, actor);
    await save("supplies", { oemId: oemB.id, partId: part.id, supplyQty: 1000 }, actor);
    const requirement = await save(
      "requirements",
      { clientId: client.id, title: "Power panel", project: "", source: "", tenderRef: "", submissionDeadline: "2026-09-30", status: "received", remarks: "" },
      actor,
    );
    const line = await save(
      "lines",
      { requirementId: requirement.id, partId: part.id, requiredQty: 1000, technicalSpec: "", requiredDeliveryDate: "2026-10-30" },
      actor,
    );
    await save("responses", { lineId: line.id, oemId: oemA.id, qty: 600, commitmentType: "firm", responseDate: "2026-09-27", note: "" }, actor);
    await save("responses", { lineId: line.id, oemId: oemB.id, qty: 400, commitmentType: "firm", responseDate: "2026-09-27", note: "" }, actor);

    const snapshot = await loadSnapshot();
    const view = uncoveredView(requirement.id, toLedger(snapshot));

    expect(view.lines).toHaveLength(1);
    expect(view.totals.requiredQty).toBe(1000);
    expect(view.totals.coveredQty).toBe(1000);
    expect(view.totals.uncoveredQty).toBe(0);
    expect(view.lines[0]?.byOem).toHaveLength(2);
  });
});
