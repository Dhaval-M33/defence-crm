import "fake-indexeddb/auto";

import { beforeEach, describe, expect, test } from "vitest";

import { oemAvailabilityForPart, uncoveredView } from "../domain/coverage";
import { loadDemoData } from "./demo";
import { resetDatabase } from "./gateway";
import { loadSnapshot, toLedger } from "./snapshot";

describe("demo data", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("seeds two agencies, three OEMs and one requirement whose coverage matches the claim", async () => {
    const result = await loadDemoData("Ram Prasad");
    expect(result.loaded).toBe(true);
    expect(result.requirementId).toBeTruthy();

    const snapshot = await loadSnapshot();
    expect(snapshot.clients).toHaveLength(2);
    expect(snapshot.oems).toHaveLength(3);
    expect(snapshot.parts).toHaveLength(2);
    expect(snapshot.requirements).toHaveLength(1);
    expect(snapshot.lines).toHaveLength(2);
    expect(snapshot.responses).toHaveLength(3);

    const view = uncoveredView(result.requirementId!, toLedger(snapshot));
    expect(view.totals.requiredQty).toBe(1500);
    expect(view.totals.coveredQty).toBe(1000);
    expect(view.totals.uncoveredQty).toBe(500);
    expect(view.totals.indicationQty).toBe(500);
  });

  test("the fully covered line really is covered and the indication line really is not", async () => {
    const result = await loadDemoData("Ram Prasad");
    const snapshot = await loadSnapshot();
    const view = uncoveredView(result.requirementId!, toLedger(snapshot));

    const coveredLine = view.lines.find((line) => line.uncoveredQty === 0);
    const uncoveredLine = view.lines.find((line) => line.uncoveredQty > 0);

    expect(coveredLine?.firmQty).toBe(1000);
    expect(uncoveredLine?.firmQty).toBe(0);
    expect(uncoveredLine?.indicationQty).toBe(500);
    expect(uncoveredLine?.uncoveredQty).toBe(500);
  });

  test("loading twice does not duplicate the demo set", async () => {
    await loadDemoData("Ram Prasad");
    const second = await loadDemoData("Ram Prasad");
    expect(second.loaded).toBe(false);

    const snapshot = await loadSnapshot();
    expect(snapshot.clients).toHaveLength(2);
    expect(snapshot.requirements).toHaveLength(1);
  });

  test("availability as the screen computes it, per demo line", async () => {
    await loadDemoData("Ram Prasad");
    const snapshot = await loadSnapshot();
    const ledger = toLedger(snapshot);

    const partA = snapshot.parts.find((part) => part.partNumber === "P-123");
    const partB = snapshot.parts.find((part) => part.partNumber === "P-345");
    expect(partA).toBeTruthy();
    expect(partB).toBeTruthy();

    const show = (partId: string) =>
      oemAvailabilityForPart(partId, ledger).map(
        (entry) => "committed " + entry.committedQty + " / supply " + entry.supplyQty + " / available " + entry.availableQty,
      );

    console.log("P-123:", show(partA!.id).join(" | "));
    console.log("P-345:", show(partB!.id).join(" | "));

    expect(show(partB!.id)).toEqual(["committed 0 / supply 500 / available 500"]);
  });
});
