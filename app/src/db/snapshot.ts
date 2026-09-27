import type { LedgerInput } from "../domain/coverage";
import type {
  ClientRecord,
  LineRecord,
  OemRecord,
  PartRecord,
  RequirementRecord,
  ResponseRecord,
  SupplyRecord,
} from "./entities";
import { db } from "./schema";

export interface Snapshot {
  readonly clients: readonly ClientRecord[];
  readonly oems: readonly OemRecord[];
  readonly parts: readonly PartRecord[];
  readonly requirements: readonly RequirementRecord[];
  readonly lines: readonly LineRecord[];
  readonly responses: readonly ResponseRecord[];
  readonly supplies: readonly SupplyRecord[];
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [clients, oems, parts, requirements, lines, responses, supplies] = await Promise.all([
    db.clients.toArray(),
    db.oems.toArray(),
    db.parts.toArray(),
    db.requirements.toArray(),
    db.lines.toArray(),
    db.responses.toArray(),
    db.supplies.toArray(),
  ]);
  return { clients, oems, parts, requirements, lines, responses, supplies };
}

export function toLedger(snapshot: Snapshot): LedgerInput {
  return {
    requirements: snapshot.requirements.map((record) => ({
      id: record.id,
      status: record.status,
    })),
    lines: snapshot.lines.map((record) => ({
      id: record.id,
      requirementId: record.requirementId,
      partId: record.partId,
      requiredQty: record.requiredQty,
    })),
    responses: snapshot.responses.map((record) => ({
      id: record.id,
      lineId: record.lineId,
      oemId: record.oemId,
      qty: record.qty,
      type: record.commitmentType,
    })),
    supplies: snapshot.supplies.map((record) => ({
      oemId: record.oemId,
      partId: record.partId,
      supplyQty: record.supplyQty,
    })),
  };
}
