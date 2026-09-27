export type CommitmentType = "firm" | "indication";

export type RequirementStatus =
  | "received"
  | "qualifying"
  | "quoted"
  | "submitted"
  | "won"
  | "lost"
  | "cancelled";

export const ACTIVE_REQUIREMENT_STATUSES: readonly RequirementStatus[] = [
  "received",
  "qualifying",
  "quoted",
  "submitted",
  "won",
];

export interface Requirement {
  readonly id: string;
  readonly status: RequirementStatus;
}

export interface RequirementLine {
  readonly id: string;
  readonly requirementId: string;
  readonly partId: string;
  readonly requiredQty: number;
}

export interface OemSupply {
  readonly oemId: string;
  readonly partId: string;
  readonly supplyQty: number;
}

export interface SourcingResponse {
  readonly id: string;
  readonly lineId: string;
  readonly oemId: string;
  readonly qty: number;
  readonly type: CommitmentType;
}

export interface LedgerInput {
  readonly requirements: readonly Requirement[];
  readonly lines: readonly RequirementLine[];
  readonly responses: readonly SourcingResponse[];
  readonly supplies: readonly OemSupply[];
}

export interface LineCoverage {
  readonly lineId: string;
  readonly partId: string;
  readonly requiredQty: number;
  readonly firmQty: number;
  readonly indicationQty: number;
  readonly coveredQty: number;
  readonly uncoveredQty: number;
  readonly oversupplyQty: number;
}

export interface OemCommitment {
  readonly oemId: string;
  readonly firmQty: number;
  readonly indicationQty: number;
}

export interface LineCoverageWithOems extends LineCoverage {
  readonly byOem: readonly OemCommitment[];
}

export interface UncoveredTotals {
  readonly requiredQty: number;
  readonly firmQty: number;
  readonly indicationQty: number;
  readonly coveredQty: number;
  readonly uncoveredQty: number;
}

export interface UncoveredView {
  readonly requirementId: string;
  readonly lines: readonly LineCoverageWithOems[];
  readonly totals: UncoveredTotals;
}

export interface OemAvailability {
  readonly oemId: string;
  readonly partId: string;
  readonly supplyQty: number;
  readonly committedQty: number;
  readonly availableQty: number;
}

export interface CommitmentRequest {
  readonly oemId: string;
  readonly partId: string;
  readonly qty: number;
  readonly excludeLineIds?: readonly string[];
}

export interface CommitmentCheck {
  readonly ok: boolean;
  readonly reason: string;
  readonly supplyQty: number;
  readonly committedQty: number;
  readonly headroomQty: number;
  readonly requestedQty: number;
}

function assertQuantity(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(label + " must be a whole number, got " + String(value));
  }
  if (value < 0) {
    throw new Error(label + " cannot be negative, got " + String(value));
  }
}

export function isActiveStatus(status: RequirementStatus): boolean {
  return ACTIVE_REQUIREMENT_STATUSES.indexOf(status) !== -1;
}

interface LedgerContext {
  readonly lineById: ReadonlyMap<string, RequirementLine>;
  readonly activeLineIds: ReadonlySet<string>;
  readonly responsesByLine: ReadonlyMap<string, readonly SourcingResponse[]>;
  readonly partIdByLineId: ReadonlyMap<string, string>;
}

function buildContext(input: LedgerInput): LedgerContext {
  const statusById = new Map<string, RequirementStatus>();
  for (const requirement of input.requirements) {
    statusById.set(requirement.id, requirement.status);
  }

  const lineById = new Map<string, RequirementLine>();
  const activeLineIds = new Set<string>();
  const partIdByLineId = new Map<string, string>();
  for (const line of input.lines) {
    assertQuantity(line.requiredQty, "requiredQty on line " + line.id);
    lineById.set(line.id, line);
    partIdByLineId.set(line.id, line.partId);
    const status = statusById.get(line.requirementId);
    if (status !== undefined && isActiveStatus(status)) {
      activeLineIds.add(line.id);
    }
  }

  const responsesByLine = new Map<string, SourcingResponse[]>();
  for (const response of input.responses) {
    assertQuantity(response.qty, "qty on response " + response.id);
    if (!lineById.has(response.lineId)) {
      throw new Error("response " + response.id + " points at unknown line " + response.lineId);
    }
    const existing = responsesByLine.get(response.lineId);
    if (existing) {
      existing.push(response);
    } else {
      responsesByLine.set(response.lineId, [response]);
    }
  }

  return { lineById, activeLineIds, responsesByLine, partIdByLineId };
}

function sumSupply(oemId: string, partId: string, input: LedgerInput): number {
  let total = 0;
  for (const entry of input.supplies) {
    assertQuantity(entry.supplyQty, "supplyQty for " + entry.oemId + "/" + entry.partId);
    if (entry.oemId === oemId && entry.partId === partId) {
      total += entry.supplyQty;
    }
  }
  return total;
}

function firmCommitted(
  oemId: string,
  partId: string,
  input: LedgerInput,
  context: LedgerContext,
  excludeLineIds?: ReadonlySet<string>,
): number {
  let committed = 0;
  for (const response of input.responses) {
    if (response.type !== "firm") continue;
    if (response.oemId !== oemId) continue;
    if (!context.activeLineIds.has(response.lineId)) continue;
    if (excludeLineIds !== undefined && excludeLineIds.has(response.lineId)) continue;
    if (context.partIdByLineId.get(response.lineId) !== partId) continue;
    committed += response.qty;
  }
  return committed;
}

function coverageForLine(line: RequirementLine, context: LedgerContext): LineCoverage {
  let firmQty = 0;
  let indicationQty = 0;
  if (context.activeLineIds.has(line.id)) {
    const responses = context.responsesByLine.get(line.id);
    if (responses) {
      for (const response of responses) {
        if (response.type === "firm") {
          firmQty += response.qty;
        } else {
          indicationQty += response.qty;
        }
      }
    }
  }
  return {
    lineId: line.id,
    partId: line.partId,
    requiredQty: line.requiredQty,
    firmQty,
    indicationQty,
    coveredQty: Math.min(firmQty, line.requiredQty),
    uncoveredQty: Math.max(line.requiredQty - firmQty, 0),
    oversupplyQty: Math.max(firmQty - line.requiredQty, 0),
  };
}

export function lineCoverage(lineId: string, input: LedgerInput): LineCoverage {
  const context = buildContext(input);
  const line = context.lineById.get(lineId);
  if (line === undefined) {
    throw new Error("unknown line " + lineId);
  }
  return coverageForLine(line, context);
}

export function uncoveredView(requirementId: string, input: LedgerInput): UncoveredView {
  const context = buildContext(input);
  const lines: LineCoverageWithOems[] = [];
  const totals = {
    requiredQty: 0,
    firmQty: 0,
    indicationQty: 0,
    coveredQty: 0,
    uncoveredQty: 0,
  };

  for (const line of input.lines) {
    if (line.requirementId !== requirementId) continue;
    const base = coverageForLine(line, context);
    const perOem = new Map<string, { firmQty: number; indicationQty: number }>();

    if (context.activeLineIds.has(line.id)) {
      const responses = context.responsesByLine.get(line.id);
      if (responses) {
        for (const response of responses) {
          const entry = perOem.get(response.oemId) ?? { firmQty: 0, indicationQty: 0 };
          if (response.type === "firm") {
            entry.firmQty += response.qty;
          } else {
            entry.indicationQty += response.qty;
          }
          perOem.set(response.oemId, entry);
        }
      }
    }

    const byOem: OemCommitment[] = [];
    for (const [oemId, entry] of perOem) {
      byOem.push({ oemId, firmQty: entry.firmQty, indicationQty: entry.indicationQty });
    }

    lines.push({ ...base, byOem });
    totals.requiredQty += base.requiredQty;
    totals.firmQty += base.firmQty;
    totals.indicationQty += base.indicationQty;
    totals.coveredQty += base.coveredQty;
    totals.uncoveredQty += base.uncoveredQty;
  }

  return { requirementId, lines, totals };
}

export function oemAvailabilityForPart(partId: string, input: LedgerInput): OemAvailability[] {
  const context = buildContext(input);
  const oemIds = new Set<string>();
  for (const entry of input.supplies) {
    if (entry.partId === partId) oemIds.add(entry.oemId);
  }
  for (const response of input.responses) {
    if (context.partIdByLineId.get(response.lineId) === partId) oemIds.add(response.oemId);
  }

  const result: OemAvailability[] = [];
  for (const oemId of oemIds) {
    const supplyQty = sumSupply(oemId, partId, input);
    const committedQty = firmCommitted(oemId, partId, input, context);
    result.push({
      oemId,
      partId,
      supplyQty,
      committedQty,
      availableQty: Math.max(supplyQty - committedQty, 0),
    });
  }
  return result;
}

export function availableForRequirement(
  requirementId: string,
  oemId: string,
  partId: string,
  input: LedgerInput,
): number {
  const context = buildContext(input);
  const myLineIds = new Set<string>();
  for (const line of input.lines) {
    if (line.requirementId === requirementId) myLineIds.add(line.id);
  }
  const supplyQty = sumSupply(oemId, partId, input);
  const committedByOthers = firmCommitted(oemId, partId, input, context, myLineIds);
  return Math.max(supplyQty - committedByOthers, 0);
}

export function checkFirmCommitment(
  request: CommitmentRequest,
  input: LedgerInput,
): CommitmentCheck {
  assertQuantity(request.qty, "commitment qty");
  const context = buildContext(input);
  const exclude = request.excludeLineIds === undefined ? undefined : new Set(request.excludeLineIds);
  const supplyQty = sumSupply(request.oemId, request.partId, input);
  const committedQty = firmCommitted(request.oemId, request.partId, input, context, exclude);
  const headroomQty = Math.max(supplyQty - committedQty, 0);

  if (headroomQty >= request.qty) {
    return { ok: true, reason: "", supplyQty, committedQty, headroomQty, requestedQty: request.qty };
  }

  const reason =
    "OEM " +
    request.oemId +
    " can supply " +
    supplyQty +
    " of " +
    request.partId +
    "; " +
    committedQty +
    " is firmly committed, leaving " +
    headroomQty +
    " available against a request of " +
    request.qty +
    ".";

  return { ok: false, reason, supplyQty, committedQty, headroomQty, requestedQty: request.qty };
}
