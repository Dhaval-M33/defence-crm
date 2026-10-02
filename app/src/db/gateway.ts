import type { Table } from "dexie";

import { checkFirmCommitment, uncoveredView } from "../domain/coverage";
import type { LedgerInput, UncoveredView } from "../domain/coverage";
import type { AuditEntry } from "./entities";
import { db } from "./schema";
import {
  clientInput,
  leadInput,
  lineInput,
  oemInput,
  partInput,
  requirementInput,
  responseInput,
  supplyInput,
} from "./validation";

export class WriteRefused extends Error {
  readonly code: string;
  readonly issues: readonly string[];

  constructor(code: string, message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "WriteRefused";
    this.code = code;
    this.issues = issues;
  }
}

const inputSchemas = {
  clients: clientInput,
  oems: oemInput,
  parts: partInput,
  requirements: requirementInput,
  lines: lineInput,
  supplies: supplyInput,
  responses: responseInput,
  leads: leadInput,
} as const;

export type EntityName = keyof typeof inputSchemas;

const tables = {
  clients: db.clients,
  oems: db.oems,
  parts: db.parts,
  requirements: db.requirements,
  lines: db.lines,
  supplies: db.supplies,
  responses: db.responses,
  leads: db.leads,
} as const;

let fallbackCounter = 0;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return "id-" + Date.now().toString(36) + "-" + String(fallbackCounter);
}

function requireActor(actor: string): void {
  if (typeof actor !== "string" || actor.trim() === "") {
    throw new WriteRefused("NO_ACTOR", "an actor name is required so the change can be audited");
  }
}

function invalid(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): never {
  const issues = error.issues.map(
    (issue) =>
      (issue.path.length > 0 ? issue.path.map(String).join(".") : "record") + ": " + issue.message,
  );
  throw new WriteRefused("INVALID", "the record was not saved: " + issues.join("; "), issues);
}

async function requireReference(
  table: Table<unknown, string>,
  id: unknown,
  label: string,
): Promise<void> {
  const value = String(id ?? "");
  if (value === "") return;
  const found = await table.get(value);
  if (found === undefined) {
    throw new WriteRefused("UNKNOWN_REFERENCE", label + " " + value + " does not exist");
  }
}

async function assertReferences(entity: EntityName, data: Record<string, unknown>): Promise<void> {
  if (entity === "requirements") {
    await requireReference(db.clients as Table<unknown, string>, data.clientId, "client");
  }
  if (entity === "lines") {
    await requireReference(
      db.requirements as Table<unknown, string>,
      data.requirementId,
      "requirement",
    );
    await requireReference(db.parts as Table<unknown, string>, data.partId, "part");
  }
  if (entity === "supplies") {
    await requireReference(db.oems as Table<unknown, string>, data.oemId, "OEM");
    await requireReference(db.parts as Table<unknown, string>, data.partId, "part");
  }
  if (entity === "responses") {
    await requireReference(db.lines as Table<unknown, string>, data.lineId, "line");
    await requireReference(db.oems as Table<unknown, string>, data.oemId, "OEM");
  }
}

export async function loadLedger(): Promise<LedgerInput> {
  const [requirements, lines, responses, supplies] = await Promise.all([
    db.requirements.toArray(),
    db.lines.toArray(),
    db.responses.toArray(),
    db.supplies.toArray(),
  ]);

  return {
    requirements: requirements.map((record) => ({ id: record.id, status: record.status })),
    lines: lines.map((record) => ({
      id: record.id,
      requirementId: record.requirementId,
      partId: record.partId,
      requiredQty: record.requiredQty,
    })),
    responses: responses.map((record) => ({
      id: record.id,
      lineId: record.lineId,
      oemId: record.oemId,
      qty: record.qty,
      type: record.commitmentType,
    })),
    supplies: supplies.map((record) => ({
      oemId: record.oemId,
      partId: record.partId,
      supplyQty: record.supplyQty,
    })),
  };
}

/**
 * C6: a firm commitment may never take total firm commitments past the OEM's
 * stated supply for that part. Indications do not consume supply and are not
 * checked, because they cover nothing.
 */
async function assertCommitmentHasHeadroom(
  data: Record<string, unknown>,
  excludeResponseId?: string,
): Promise<void> {
  const line = await db.lines.get(String(data.lineId));
  if (line === undefined) {
    throw new WriteRefused("UNKNOWN_REFERENCE", "line " + String(data.lineId) + " does not exist");
  }

  const ledger = await loadLedger();
  const withoutThisResponse =
    excludeResponseId === undefined
      ? ledger
      : {
          ...ledger,
          responses: ledger.responses.filter((response) => response.id !== excludeResponseId),
        };

  const check = checkFirmCommitment(
    { oemId: String(data.oemId), partId: line.partId, qty: Number(data.qty) },
    withoutThisResponse,
  );
  if (!check.ok) {
    throw new WriteRefused("OVER_COMMITMENT", check.reason);
  }
}

/**
 * The single write path. Everything that changes data goes through here, so that
 * validation, the over-commitment guard and the audit entry can never be skipped.
 */
export async function save(
  entity: EntityName,
  input: unknown,
  actor: string,
): Promise<{ id: string }> {
  requireActor(actor);

  const parsed = inputSchemas[entity].safeParse(input);
  if (!parsed.success) invalid(parsed.error);

  const data = parsed.data as Record<string, unknown>;
  await assertReferences(entity, data);

  if (entity === "responses" && data.commitmentType === "firm") {
    await assertCommitmentHasHeadroom(data);
  }

  const now = new Date().toISOString();
  const record: Record<string, unknown> = {
    ...data,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
  };

  const audit: AuditEntry = {
    id: newId(),
    entityType: entity,
    entityId: String(record.id),
    action: "create",
    actor,
    at: now,
    before: null,
    after: record,
  };

  const table = tables[entity] as Table<unknown, string>;
  await db.transaction("rw", table, db.audit, async () => {
    await table.add(record);
    await db.audit.add(audit);
  });

  return { id: String(record.id) };
}

export async function update(
  entity: EntityName,
  id: string,
  changes: Record<string, unknown>,
  actor: string,
): Promise<void> {
  requireActor(actor);

  const table = tables[entity] as unknown as Table<Record<string, unknown>, string>;
  const existing = await table.get(id);
  if (existing === undefined) {
    throw new WriteRefused("NOT_FOUND", entity.slice(0, -1) + " " + id + " does not exist");
  }

  const merged = { ...existing, ...changes };
  const parsed = inputSchemas[entity].safeParse(merged);
  if (!parsed.success) invalid(parsed.error);

  const data = parsed.data as Record<string, unknown>;
  await assertReferences(entity, data);

  if (entity === "responses" && data.commitmentType === "firm") {
    await assertCommitmentHasHeadroom(data, id);
  }

  const now = new Date().toISOString();
  const updatedRecord: Record<string, unknown> = {
    ...existing,
    ...data,
    updatedAt: now,
    updatedBy: actor,
  };

  const audit: AuditEntry = {
    id: newId(),
    entityType: entity,
    entityId: id,
    action: "update",
    actor,
    at: now,
    before: existing,
    after: updatedRecord,
  };

  await db.transaction("rw", table, db.audit, async () => {
    await table.put(updatedRecord);
    await db.audit.add(audit);
  });
}

export async function uncoveredViewFromDb(requirementId: string): Promise<UncoveredView> {
  return uncoveredView(requirementId, await loadLedger());
}

export async function listAudit(entityType: string, entityId: string): Promise<AuditEntry[]> {
  return db.audit.where({ entityType, entityId }).toArray();
}

export async function resetDatabase(): Promise<void> {
  await db.transaction(
    "rw",
    [db.clients, db.oems, db.parts, db.requirements, db.lines, db.supplies, db.responses, db.leads, db.audit],
    async () => {
      await Promise.all([
        db.clients.clear(),
        db.oems.clear(),
        db.parts.clear(),
        db.requirements.clear(),
        db.lines.clear(),
        db.supplies.clear(),
        db.responses.clear(),
        db.leads.clear(),
        db.audit.clear(),
      ]);
    },
  );
}
