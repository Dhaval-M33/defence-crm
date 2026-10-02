import { isoDatePlusDays } from "../domain/dates";
import { save } from "./gateway";
import { db } from "./schema";

export interface DemoResult {
  readonly loaded: boolean;
  readonly message: string;
  readonly requirementId?: string;
}

const DEMO_AGENCY = "Demo HAL";

function isoDate(offsetDays: number): string {
  return isoDatePlusDays(offsetDays);
}

export async function hasDemoData(): Promise<boolean> {
  return (await db.clients.where("name").equals(DEMO_AGENCY).count()) > 0;
}

/**
 * Seeds a small, plainly-labelled sample so the coverage view can be read
 * immediately: two agencies, three OEMs, two parts, one requirement with two
 * line items. Line 1 is fully covered by two firm commitments; line 2 is
 * covered by an indication only, so it stays uncovered. Everything is written
 * through the normal gateway, so it is validated and audited like real data.
 */
export async function loadDemoData(actor: string): Promise<DemoResult> {
  if (await hasDemoData()) {
    return { loaded: false, message: "Demo data is already loaded. Clear all data first to reload it." };
  }

  const hal = await save(
    "clients",
    { name: "Demo HAL", division: "Aero", location: "Bengaluru", contact: "", email: "", phone: "" },
    actor,
  );
  await save(
    "clients",
    { name: "Demo BEL", division: "Radar", location: "Bengaluru", contact: "", email: "", phone: "" },
    actor,
  );

  const oemA = await save(
    "oems",
    { name: "Demo OEM A", location: "Bengaluru", contact: "", email: "", phone: "", approved: true, notes: "" },
    actor,
  );
  const oemB = await save(
    "oems",
    { name: "Demo OEM B", location: "Pune", contact: "", email: "", phone: "", approved: true, notes: "" },
    actor,
  );
  const oemC = await save(
    "oems",
    { name: "Demo OEM C", location: "Hyderabad", contact: "", email: "", phone: "", approved: false, notes: "" },
    actor,
  );

  const partA = await save(
    "parts",
    { partNumber: "P-123", clientPartNumber: "123M", description: "Power panel", oemId: null, uom: "nos" },
    actor,
  );
  const partB = await save(
    "parts",
    { partNumber: "P-345", clientPartNumber: "345M", description: "Radar module", oemId: null, uom: "nos" },
    actor,
  );

  await save("supplies", { oemId: oemA.id, partId: partA.id, supplyQty: 1000 }, actor);
  await save("supplies", { oemId: oemB.id, partId: partA.id, supplyQty: 1000 }, actor);
  await save("supplies", { oemId: oemC.id, partId: partB.id, supplyQty: 500 }, actor);

  const requirement = await save(
    "requirements",
    {
      clientId: hal.id,
      title: "Demo power panel requirement",
      project: "LCA",
      source: "SRM",
      tenderRef: "H-01",
      submissionDeadline: isoDate(14),
      status: "received",
      remarks: "Demo data. Clear all data to remove.",
    },
    actor,
  );

  const lineOne = await save(
    "lines",
    {
      requirementId: requirement.id,
      partId: partA.id,
      requiredQty: 1000,
      technicalSpec: "Per drawing",
      requiredDeliveryDate: isoDate(60),
    },
    actor,
  );
  const lineTwo = await save(
    "lines",
    {
      requirementId: requirement.id,
      partId: partB.id,
      requiredQty: 500,
      technicalSpec: "Per specification",
      requiredDeliveryDate: isoDate(75),
    },
    actor,
  );

  await save(
    "responses",
    { lineId: lineOne.id, oemId: oemA.id, qty: 600, commitmentType: "firm", responseDate: isoDate(0), note: "Signed OEM PO" },
    actor,
  );
  await save(
    "responses",
    { lineId: lineOne.id, oemId: oemB.id, qty: 400, commitmentType: "firm", responseDate: isoDate(0), note: "Written confirmation" },
    actor,
  );
  await save(
    "responses",
    { lineId: lineTwo.id, oemId: oemC.id, qty: 500, commitmentType: "indication", responseDate: isoDate(0), note: "Availability only" },
    actor,
  );

  await save(
    "leads",
    {
      name: "Demo Veer Manufacturing",
      source: "referral",
      stage: "contacted",
      followUpDate: isoDate(0),
      phone: "",
      notes: "Due today",
    },
    actor,
  );
  await save(
    "leads",
    {
      name: "Demo Kaveri Engineering",
      source: "whatsapp",
      stage: "negotiation",
      followUpDate: isoDate(-3),
      phone: "",
      notes: "Overdue",
    },
    actor,
  );
  await save(
    "leads",
    {
      name: "Demo Shakti Systems",
      source: "call",
      stage: "new",
      followUpDate: isoDate(5),
      phone: "",
      notes: "",
    },
    actor,
  );

  return {
    loaded: true,
    message:
      "Demo data loaded: 2 agencies, 3 OEMs, 2 parts, 1 requirement with 2 line items, and 3 leads. Line P-123 is covered 1,000 of 1,000; line P-345 shows 500 uncovered because the only response is an indication. On the Leads tab, two leads are due today or overdue.",
    requirementId: requirement.id,
  };
}
