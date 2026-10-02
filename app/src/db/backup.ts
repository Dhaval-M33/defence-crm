import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";

import { resetDatabase } from "./gateway";
import { db } from "./schema";
import {
  auditStored,
  clientStored,
  leadStored,
  lineStored,
  oemStored,
  partStored,
  requirementStored,
  responseStored,
  supplyStored,
} from "./validation";

export const BACKUP_FORMAT = "defence-crm-backup";
export const BACKUP_VERSION = 1;

export class BackupRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupRefused";
  }
}

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().min(1),
  tables: z.object({
    clients: z.array(clientStored),
    oems: z.array(oemStored),
    parts: z.array(partStored),
    requirements: z.array(requirementStored),
    lines: z.array(lineStored),
    supplies: z.array(supplyStored),
    responses: z.array(responseStored),
    leads: z.array(leadStored),
    audit: z.array(auditStored),
  }),
});

export type BackupTables = z.infer<typeof backupSchema>["tables"];

export interface ImportResult {
  readonly counts: Record<string, number>;
}

async function readTables(): Promise<BackupTables> {
  const [clients, oems, parts, requirements, lines, supplies, responses, leads, audit] =
    await Promise.all([
      db.clients.toArray(),
      db.oems.toArray(),
      db.parts.toArray(),
      db.requirements.toArray(),
      db.lines.toArray(),
      db.supplies.toArray(),
      db.responses.toArray(),
      db.leads.toArray(),
      db.audit.toArray(),
    ]);
  return { clients, oems, parts, requirements, lines, supplies, responses, leads, audit };
}

/** Everything needed to restore this database, as a single zip of `data.json`. */
export async function exportBackup(): Promise<Uint8Array> {
  const tables = await readTables();
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
  return zipSync({ "data.json": strToU8(JSON.stringify(payload, null, 2)) });
}

/**
 * Replaces the database with the contents of a backup. The file is fully parsed
 * and validated before anything is cleared, so a bad file leaves the existing
 * data untouched.
 */
export async function importBackup(bytes: Uint8Array): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupRefused("the file is not a readable backup zip");
  }

  const dataFile = entries["data.json"];
  if (dataFile === undefined) {
    throw new BackupRefused("the backup does not contain data.json");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(dataFile));
  } catch {
    throw new BackupRefused("data.json inside the backup is not valid JSON");
  }

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined ? "unknown" : issue.path.map(String).join(".") || "file";
    const why = issue === undefined ? "unknown problem" : issue.message;
    throw new BackupRefused("the backup file is not in the expected format at " + where + ": " + why);
  }

  const tables = parsed.data.tables;

  await resetDatabase();
  await db.transaction(
    "rw",
    [
      db.clients,
      db.oems,
      db.parts,
      db.requirements,
      db.lines,
      db.supplies,
      db.responses,
      db.leads,
      db.audit,
    ],
    async () => {
      await db.clients.bulkAdd(tables.clients);
      await db.oems.bulkAdd(tables.oems);
      await db.parts.bulkAdd(tables.parts);
      await db.requirements.bulkAdd(tables.requirements);
      await db.lines.bulkAdd(tables.lines);
      await db.supplies.bulkAdd(tables.supplies);
      await db.responses.bulkAdd(tables.responses);
      await db.leads.bulkAdd(tables.leads);
      await db.audit.bulkAdd(tables.audit);
    },
  );

  return {
    counts: {
      clients: tables.clients.length,
      oems: tables.oems.length,
      parts: tables.parts.length,
      requirements: tables.requirements.length,
      lines: tables.lines.length,
      supplies: tables.supplies.length,
      responses: tables.responses.length,
      leads: tables.leads.length,
      audit: tables.audit.length,
    },
  };
}
