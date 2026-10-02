import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be written as YYYY-MM-DD");

const optionalDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "date must be written as YYYY-MM-DD")
  .default("");

const quantity = z
  .number()
  .int("quantity must be a whole number")
  .nonnegative("quantity cannot be negative");

const positiveQuantity = z
  .number()
  .int("quantity must be a whole number")
  .positive("quantity must be greater than zero");

export const clientInput = z.object({
  name: z.string().trim().min(1, "client name is required"),
  division: z.string().trim().default(""),
  location: z.string().trim().default(""),
  contact: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

export const oemInput = z.object({
  name: z.string().trim().min(1, "OEM name is required"),
  location: z.string().trim().default(""),
  contact: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  approved: z.boolean().default(false),
  notes: z.string().trim().default(""),
});

export const partInput = z.object({
  partNumber: z.string().trim().min(1, "part number is required"),
  clientPartNumber: z.string().trim().default(""),
  description: z.string().trim().default(""),
  oemId: z.string().trim().nullable().default(null),
  uom: z.string().trim().default("nos"),
});

export const requirementInput = z.object({
  clientId: z.string().trim().min(1, "a requirement must reference a client"),
  title: z.string().trim().min(1, "a requirement must have a title"),
  project: z.string().trim().default(""),
  source: z.string().trim().default(""),
  tenderRef: z.string().trim().default(""),
  submissionDeadline: dateString,
  status: z.enum([
    "received",
    "qualifying",
    "quoted",
    "submitted",
    "won",
    "lost",
    "cancelled",
  ]),
  remarks: z.string().trim().default(""),
});

export const lineInput = z.object({
  requirementId: z.string().trim().min(1, "a line must reference a requirement"),
  partId: z.string().trim().min(1, "a line must reference a part"),
  requiredQty: quantity,
  technicalSpec: z.string().trim().default(""),
  requiredDeliveryDate: optionalDate,
});

export const supplyInput = z.object({
  oemId: z.string().trim().min(1, "a supply figure must reference an OEM"),
  partId: z.string().trim().min(1, "a supply figure must reference a part"),
  supplyQty: positiveQuantity,
});

export const responseInput = z.object({
  lineId: z.string().trim().min(1, "a response must reference a line"),
  oemId: z.string().trim().min(1, "a response must reference an OEM"),
  qty: positiveQuantity,
  commitmentType: z.enum(["firm", "indication"]),
  responseDate: dateString,
  note: z.string().trim().default(""),
});

export const leadInput = z.object({
  name: z.string().trim().min(1, "a lead must have a name"),
  source: z.enum(["call", "whatsapp", "referral"]),
  stage: z.enum(["new", "contacted", "visited", "negotiation", "won", "lost"]),
  followUpDate: dateString,
  phone: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

const metaFields = {
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
};

export const clientStored = clientInput.extend(metaFields);
export const oemStored = oemInput.extend(metaFields);
export const partStored = partInput.extend(metaFields);
export const requirementStored = requirementInput.extend(metaFields);
export const lineStored = lineInput.extend(metaFields);
export const supplyStored = supplyInput.extend(metaFields);
export const responseStored = responseInput.extend(metaFields);
export const leadStored = leadInput.extend(metaFields);

export const auditStored = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum(["create", "update"]),
  actor: z.string().min(1),
  at: z.string().min(1),
  before: z.unknown(),
  after: z.unknown(),
});
