import type { CommitmentType, RequirementStatus } from "../domain/coverage";

export interface AuditFields {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface ClientRecord extends AuditFields {
  readonly id: string;
  readonly name: string;
  readonly division: string;
  readonly location: string;
  readonly contact: string;
  readonly email: string;
  readonly phone: string;
}

export interface OemRecord extends AuditFields {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly contact: string;
  readonly email: string;
  readonly phone: string;
  readonly approved: boolean;
  readonly notes: string;
}

export interface PartRecord extends AuditFields {
  readonly id: string;
  readonly partNumber: string;
  readonly clientPartNumber: string;
  readonly description: string;
  readonly oemId: string | null;
  readonly uom: string;
}

export interface RequirementRecord extends AuditFields {
  readonly id: string;
  readonly clientId: string;
  readonly title: string;
  readonly project: string;
  readonly source: string;
  readonly tenderRef: string;
  readonly submissionDeadline: string;
  readonly status: RequirementStatus;
  readonly remarks: string;
}

export interface LineRecord extends AuditFields {
  readonly id: string;
  readonly requirementId: string;
  readonly partId: string;
  readonly requiredQty: number;
  readonly technicalSpec: string;
  readonly requiredDeliveryDate: string;
}

export interface SupplyRecord extends AuditFields {
  readonly id: string;
  readonly oemId: string;
  readonly partId: string;
  readonly supplyQty: number;
}

export interface ResponseRecord extends AuditFields {
  readonly id: string;
  readonly lineId: string;
  readonly oemId: string;
  readonly qty: number;
  readonly commitmentType: CommitmentType;
  readonly responseDate: string;
  readonly note: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: "create" | "update";
  readonly actor: string;
  readonly at: string;
  readonly before: unknown;
  readonly after: unknown;
}
