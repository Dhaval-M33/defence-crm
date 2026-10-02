import Dexie, { type Table } from "dexie";

import type {
  AuditEntry,
  ClientRecord,
  LeadRecord,
  LineRecord,
  OemRecord,
  PartRecord,
  RequirementRecord,
  ResponseRecord,
  SupplyRecord,
} from "./entities";

export class CrmDatabase extends Dexie {
  clients!: Table<ClientRecord, string>;
  oems!: Table<OemRecord, string>;
  parts!: Table<PartRecord, string>;
  requirements!: Table<RequirementRecord, string>;
  lines!: Table<LineRecord, string>;
  supplies!: Table<SupplyRecord, string>;
  responses!: Table<ResponseRecord, string>;
  leads!: Table<LeadRecord, string>;
  audit!: Table<AuditEntry, string>;

  constructor(name = "defence-crm") {
    super(name);
    this.version(1).stores({
      clients: "id, name",
      oems: "id, name, approved",
      parts: "id, partNumber, oemId",
      requirements: "id, clientId, status, submissionDeadline",
      lines: "id, requirementId, partId",
      supplies: "id, oemId, partId, [oemId+partId]",
      responses: "id, lineId, oemId, commitmentType",
      audit: "id, entityType, entityId, at, actor",
    });
    this.version(2).stores({
      leads: "id, name, stage, source, followUpDate",
    });
  }
}

export const db = new CrmDatabase();
