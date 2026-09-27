import { describe, expect, test } from "vitest";

import {
  availableForRequirement,
  checkFirmCommitment,
  lineCoverage,
  oemAvailabilityForPart,
  uncoveredView,
} from "./coverage";
import type {
  LedgerInput,
  OemSupply,
  Requirement,
  RequirementLine,
  RequirementStatus,
  SourcingResponse,
} from "./coverage";

function requirement(id: string, status: RequirementStatus): Requirement {
  return { id, status };
}

function line(id: string, requirementId: string, partId: string, requiredQty: number): RequirementLine {
  return { id, requirementId, partId, requiredQty };
}

function firm(id: string, lineId: string, oemId: string, qty: number): SourcingResponse {
  return { id, lineId, oemId, qty, type: "firm" };
}

function indication(id: string, lineId: string, oemId: string, qty: number): SourcingResponse {
  return { id, lineId, oemId, qty, type: "indication" };
}

function supply(oemId: string, partId: string, supplyQty: number): OemSupply {
  return { oemId, partId, supplyQty };
}

describe("coverage and capacity", () => {
  test("PRD worked example: 1,000 required, A firm 600 and B firm 400 gives coverage 1,000 and uncovered 0", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 1000)],
      responses: [firm("S1", "L1", "A", 600), firm("S2", "L1", "B", 400)],
      supplies: [supply("A", "P1", 1000), supply("B", "P1", 1000)],
    };

    const coverage = lineCoverage("L1", input);
    expect(coverage.firmQty).toBe(1000);
    expect(coverage.coveredQty).toBe(1000);
    expect(coverage.uncoveredQty).toBe(0);
    expect(coverage.indicationQty).toBe(0);
  });

  test("an indication never covers: A firm 600, B indicates 400, uncovered is 400", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 1000)],
      responses: [firm("S1", "L1", "A", 600), indication("S2", "L1", "B", 400)],
      supplies: [supply("A", "P1", 1000), supply("B", "P1", 1000)],
    };

    const coverage = lineCoverage("L1", input);
    expect(coverage.coveredQty).toBe(600);
    expect(coverage.uncoveredQty).toBe(400);
    expect(coverage.indicationQty).toBe(400);
  });

  test("indication only leaves the line entirely uncovered", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 500)],
      responses: [indication("S1", "L1", "A", 500)],
      supplies: [supply("A", "P1", 1000)],
    };

    const coverage = lineCoverage("L1", input);
    expect(coverage.firmQty).toBe(0);
    expect(coverage.coveredQty).toBe(0);
    expect(coverage.uncoveredQty).toBe(500);
    expect(coverage.indicationQty).toBe(500);
  });

  test("firm quantity above the requirement is capped and reported as oversupply", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 100)],
      responses: [firm("S1", "L1", "A", 150)],
      supplies: [supply("A", "P1", 1000)],
    };

    const coverage = lineCoverage("L1", input);
    expect(coverage.coveredQty).toBe(100);
    expect(coverage.uncoveredQty).toBe(0);
    expect(coverage.oversupplyQty).toBe(50);
  });

  test("capacity is global: 700 firmly committed elsewhere leaves 300 available for a new order", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received"), requirement("R2", "received")],
      lines: [line("L1", "R1", "P1", 700), line("L2", "R2", "P1", 300)],
      responses: [firm("S1", "L1", "A", 700)],
      supplies: [supply("A", "P1", 1000)],
    };

    const availability = oemAvailabilityForPart("P1", input);
    expect(availability[0]?.supplyQty).toBe(1000);
    expect(availability[0]?.committedQty).toBe(700);
    expect(availability[0]?.availableQty).toBe(300);
  });

  test("availability while working a requirement excludes that requirement's own commitments", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received"), requirement("R2", "received")],
      lines: [line("L1", "R1", "P1", 700), line("L2", "R2", "P1", 300)],
      responses: [firm("S1", "L1", "A", 700)],
      supplies: [supply("A", "P1", 1000)],
    };

    expect(availableForRequirement("R1", "A", "P1", input)).toBe(1000);
    expect(availableForRequirement("R2", "A", "P1", input)).toBe(300);
  });

  test("losing a requirement releases its commitments back to the pool (C7)", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "lost"), requirement("R2", "received")],
      lines: [line("L1", "R1", "P1", 700), line("L2", "R2", "P1", 300)],
      responses: [firm("S1", "L1", "A", 700)],
      supplies: [supply("A", "P1", 1000)],
    };

    expect(lineCoverage("L1", input).firmQty).toBe(0);
    expect(lineCoverage("L1", input).uncoveredQty).toBe(700);
    expect(availableForRequirement("R2", "A", "P1", input)).toBe(1000);
  });

  test("cancelling a requirement releases its commitments back to the pool (C7)", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "cancelled"), requirement("R2", "received")],
      lines: [line("L1", "R1", "P1", 700), line("L2", "R2", "P1", 300)],
      responses: [firm("S1", "L1", "A", 700)],
      supplies: [supply("A", "P1", 1000)],
    };

    expect(availableForRequirement("R2", "A", "P1", input)).toBe(1000);
  });

  test("a firm commitment beyond supply is refused with the headroom in the reason", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 700)],
      responses: [firm("S1", "L1", "A", 700)],
      supplies: [supply("A", "P1", 1000)],
    };

    const check = checkFirmCommitment({ oemId: "A", partId: "P1", qty: 400 }, input);
    expect(check.ok).toBe(false);
    expect(check.headroomQty).toBe(300);
    expect(check.reason).toMatch(/leaving 300 available/);
  });

  test("the uncovered view reports per line, per OEM, and as totals", () => {
    const input: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 1000), line("L2", "R1", "P2", 200)],
      responses: [
        firm("S1", "L1", "A", 600),
        indication("S2", "L1", "B", 400),
        firm("S3", "L2", "A", 200),
      ],
      supplies: [supply("A", "P1", 1000), supply("B", "P1", 1000), supply("A", "P2", 500)],
    };

    const view = uncoveredView("R1", input);
    expect(view.totals.requiredQty).toBe(1200);
    expect(view.totals.firmQty).toBe(800);
    expect(view.totals.indicationQty).toBe(400);
    expect(view.totals.uncoveredQty).toBe(400);

    const first = view.lines[0]!;
    expect(first.byOem.find((entry) => entry.oemId === "A")?.firmQty).toBe(600);
    expect(first.byOem.find((entry) => entry.oemId === "B")?.indicationQty).toBe(400);
  });

  test("a fractional or negative quantity is refused", () => {
    const negative: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", -5)],
      responses: [],
      supplies: [],
    };
    expect(() => lineCoverage("L1", negative)).toThrow(/cannot be negative/);

    const fractional: LedgerInput = {
      requirements: [requirement("R1", "received")],
      lines: [line("L1", "R1", "P1", 10)],
      responses: [firm("S1", "L1", "A", 2.5)],
      supplies: [supply("A", "P1", 10)],
    };
    expect(() => lineCoverage("L1", fractional)).toThrow(/must be a whole number/);
  });
});
