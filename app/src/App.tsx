import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { oemAvailabilityForPart, uncoveredView } from "./domain/coverage";
import type { LedgerInput, UncoveredView } from "./domain/coverage";
import { BackupRefused, exportBackup, importBackup } from "./db/backup";
import { loadDemoData } from "./db/demo";
import { WriteRefused, resetDatabase, save, update } from "./db/gateway";
import { todayLocalIso } from "./domain/dates";
import { dueOnOrBefore, isOverdue } from "./domain/due";
import {
  isLeadOverdue,
  isOpenLeadStage,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  leadsDueOnOrBefore,
} from "./domain/leads";
import type { LeadSource, LeadStage } from "./domain/leads";
import { QuantityInputError, parseQuantity } from "./domain/quantity";
import { loadSnapshot, toLedger } from "./db/snapshot";
import type { Snapshot } from "./db/snapshot";
import type { LeadRecord, RequirementRecord } from "./db/entities";

const DEFAULT_ACTOR = "Ram Prasad";
const STATUSES = ["received", "qualifying", "quoted", "submitted", "won", "lost", "cancelled"] as const;

interface Notice {
  readonly kind: "ok" | "error";
  readonly text: string;
}

type Run = (action: () => Promise<unknown>, okText: string) => Promise<void>;

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  name?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function Picker(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  name?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Form(props: {
  title?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <form
      className="form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        props.onSubmit(event);
      }}
    >
      {props.title ? <h3>{props.title}</h3> : null}
      <div className="form-grid">{props.children}</div>
      <button type="submit">{props.submitLabel ?? "Add"}</button>
    </form>
  );
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <div className="panel">
      <h3>{props.title}</h3>
      {props.children}
    </div>
  );
}

function ClientForm({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [location, setLocation] = useState("");
  return (
    <Form
      submitLabel="Add agency"
      onSubmit={() => {
        void run(
          () => save("clients", { name, division, location, contact: "", email: "", phone: "" }, DEFAULT_ACTOR),
          "Customer saved.",
        ).then(() => {
          setName("");
          setDivision("");
          setLocation("");
        });
      }}
    >
      <Field label="Name" value={name} onChange={setName} />
      <Field label="Division" value={division} onChange={setDivision} />
      <Field label="Location" value={location} onChange={setLocation} />
    </Form>
  );
}

function OemForm({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [approved, setApproved] = useState(false);
  return (
    <Form
      submitLabel="Add OEM"
      onSubmit={() => {
        void run(
          () =>
            save(
              "oems",
              { name, location: "", contact: "", email: "", phone: "", approved, notes: "" },
              DEFAULT_ACTOR,
            ),
          "OEM saved.",
        ).then(() => {
          setName("");
          setApproved(false);
        });
      }}
    >
      <Field label="Name" value={name} onChange={setName} />
      <label className="field checkbox">
        <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
        <span>Approved to supply</span>
      </label>
    </Form>
  );
}

function PartForm({ run }: { run: Run }) {
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("nos");
  return (
    <Form
      submitLabel="Add part"
      onSubmit={() => {
        void run(
          () =>
            save(
              "parts",
              { partNumber, clientPartNumber: "", description, oemId: null, uom },
              DEFAULT_ACTOR,
            ),
          "Part saved.",
        ).then(() => {
          setPartNumber("");
          setDescription("");
        });
      }}
    >
      <Field label="Part number" value={partNumber} onChange={setPartNumber} />
      <Field label="Description" value={description} onChange={setDescription} />
      <Field label="Unit" value={uom} onChange={setUom} />
    </Form>
  );
}

function SupplyForm({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const [oemId, setOemId] = useState("");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("");
  return (
    <Form
      submitLabel="Add supply"
      onSubmit={(event) => {
        const form = new FormData(event.currentTarget);
        void run(
          () =>
            save(
              "supplies",
              {
                oemId,
                partId,
                supplyQty: parseQuantity(form.get("qty"), "Supply quantity", { positive: true }),
              },
              DEFAULT_ACTOR,
            ),
          "Supply saved.",
        ).then(() => setQty(""));
      }}
    >
      <Picker
        label="OEM"
        value={oemId}
        onChange={setOemId}
        options={[{ value: "", label: "select…" }, ...snapshot.oems.map((o) => ({ value: o.id, label: o.name }))]}
      />
      <Picker
        label="Part"
        value={partId}
        onChange={setPartId}
        options={[{ value: "", label: "select…" }, ...snapshot.parts.map((p) => ({ value: p.id, label: p.partNumber }))]}
      />
      <Field label="Can supply" name="qty" value={qty} onChange={setQty} type="number" />
    </Form>
  );
}

function RequirementForm({ snapshot, run, onCreated }: { snapshot: Snapshot; run: Run; onCreated: (id: string) => void }) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [tenderRef, setTenderRef] = useState("");
  const [deadline, setDeadline] = useState("");
  return (
    <Form
      title="New requirement"
      submitLabel="Add requirement"
      onSubmit={() => {
        void run(async () => {
          const created = await save(
            "requirements",
            {
              clientId,
              title,
              project: "",
              source: "",
              tenderRef,
              submissionDeadline: deadline,
              status: "received",
              remarks: "",
            },
            DEFAULT_ACTOR,
          );
          onCreated(created.id);
        }, "Requirement saved.").then(() => {
          setTitle("");
          setTenderRef("");
        });
      }}
    >
      <Picker
        label="Customer or agency"
        value={clientId}
        onChange={setClientId}
        options={[{ value: "", label: "select…" }, ...snapshot.clients.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Tender or enquiry ref" value={tenderRef} onChange={setTenderRef} />
      <Field label="Submission deadline" value={deadline} onChange={setDeadline} type="date" />
    </Form>
  );
}

function LineForm({ requirementId, snapshot, run }: { requirementId: string; snapshot: Snapshot; run: Run }) {
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  return (
    <Form
      title="Add line item"
      submitLabel="Add line"
      onSubmit={(event) => {
        const form = new FormData(event.currentTarget);
        void run(
          () =>
            save(
              "lines",
              {
                requirementId,
                partId,
                requiredQty: parseQuantity(form.get("qty"), "Required quantity", { positive: true }),
                technicalSpec: "",
                requiredDeliveryDate: deliveryDate,
              },
              DEFAULT_ACTOR,
            ),
          "Line added.",
        ).then(() => setQty(""));
      }}
    >
      <Picker
        label="Part"
        value={partId}
        onChange={setPartId}
        options={[{ value: "", label: "select…" }, ...snapshot.parts.map((p) => ({ value: p.id, label: p.partNumber }))]}
      />
      <Field label="Required quantity" name="qty" value={qty} onChange={setQty} type="number" />
      <Field label="Required delivery" value={deliveryDate} onChange={setDeliveryDate} type="date" />
    </Form>
  );
}

function ResponseForm({ lineId, snapshot, run }: { lineId: string; snapshot: Snapshot; run: Run }) {
  const [oemId, setOemId] = useState("");
  const [qty, setQty] = useState("");
  const [type, setType] = useState<"firm" | "indication">("firm");
  const today = todayLocalIso();
  return (
    <form
      className="response-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run(
          () =>
            save(
              "responses",
              {
                lineId,
                oemId,
                qty: parseQuantity(form.get("qty"), "Quantity", { positive: true }),
                commitmentType: type,
                responseDate: today,
                note: "",
              },
              DEFAULT_ACTOR,
            ),
          "OEM response recorded.",
        ).then(() => setQty(""));
      }}
    >
      <Picker
        label="OEM"
        value={oemId}
        onChange={setOemId}
        options={[{ value: "", label: "select…" }, ...snapshot.oems.map((o) => ({ value: o.id, label: o.name }))]}
      />
      <Field label="Quantity" name="qty" value={qty} onChange={setQty} type="number" />
      <Picker
        label="Commitment"
        value={type}
        onChange={(value) => setType(value === "firm" ? "firm" : "indication")}
        options={[
          { value: "firm", label: "Firm commitment" },
          { value: "indication", label: "Indication (not counted)" },
        ]}
      />
      <button type="submit">Record response</button>
      <p className="helper">
        Firm means a signed OEM PO or written confirmation, and it is the only kind that covers a quantity.
        An indication is availability only and never counts.
      </p>
    </form>
  );
}

function StagePicker({ lead, run }: { lead: LeadRecord; run: Run }) {
  return (
    <label className="field stage-field">
      <span>Stage</span>
      <select
        value={lead.stage}
        onChange={(event) => {
          void run(
            () => update("leads", lead.id, { stage: event.target.value }, DEFAULT_ACTOR),
            "Stage updated to " + LEAD_STAGE_LABELS[event.target.value as LeadStage] + ".",
          );
        }}
      >
        {LEAD_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {LEAD_STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeadForm({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<LeadSource>("call");
  const [stage, setStage] = useState<LeadStage>("new");
  const [followUpDate, setFollowUpDate] = useState(todayLocalIso());

  return (
    <Form
      title="New lead"
      submitLabel="Add lead"
      onSubmit={(event) => {
        const form = new FormData(event.currentTarget);
        void run(
          () =>
            save(
              "leads",
              {
                name: String(form.get("name") ?? "").trim(),
                source: String(form.get("source") ?? "call"),
                stage: String(form.get("stage") ?? "new"),
                followUpDate: String(form.get("followUpDate") ?? ""),
                phone: "",
                notes: "",
              },
              DEFAULT_ACTOR,
            ),
          "Lead saved.",
        ).then(() => setName(""));
      }}
    >
      <Field label="Name" name="name" value={name} onChange={setName} />
      <Picker
        label="Source"
        name="source"
        value={source}
        onChange={(value) => setSource(value as LeadSource)}
        options={LEAD_SOURCES.map((value) => ({ value, label: LEAD_SOURCE_LABELS[value] }))}
      />
      <Picker
        label="Stage"
        name="stage"
        value={stage}
        onChange={(value) => setStage(value as LeadStage)}
        options={LEAD_STAGES.map((value) => ({ value, label: LEAD_STAGE_LABELS[value] }))}
      />
      <Field
        label="Follow-up date"
        name="followUpDate"
        value={followUpDate}
        onChange={setFollowUpDate}
        type="date"
      />
    </Form>
  );
}

function LeadsView({ snapshot, run, today }: { snapshot: Snapshot; run: Run; today: string }) {
  const due = leadsDueOnOrBefore(snapshot.leads, today);

  return (
    <>
      <section className="section">
        <h2>Due today or earlier</h2>
        <p className="muted">Leads whose follow-up is today or already past. Today is {today}.</p>
        {due.length === 0 ? (
          <p className="muted">Nothing due today or earlier.</p>
        ) : (
          <ul className="lead-list">
            {due.map((lead) => (
              <li key={lead.id} className="lead">
                <span className="lead-name">{lead.name}</span>
                <span className="pill source">{LEAD_SOURCE_LABELS[lead.source]}</span>
                <span className="muted small">
                  {LEAD_STAGE_LABELS[lead.stage]} · follow up {lead.followUpDate}
                </span>
                <span className={isLeadOverdue(lead, today) ? "badge uncovered" : "badge covered"}>
                  {isLeadOverdue(lead, today) ? "OVERDUE" : "DUE TODAY"}
                </span>
                <StagePicker lead={lead} run={run} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>All leads ({snapshot.leads.length})</h2>
        {snapshot.leads.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="lead-list">
            {snapshot.leads.map((lead) => (
              <li key={lead.id} className={isOpenLeadStage(lead.stage) ? "lead" : "lead closed"}>
                <span className="lead-name">{lead.name}</span>
                <span className="pill source">{LEAD_SOURCE_LABELS[lead.source]}</span>
                <span className="muted small">follow up {lead.followUpDate}</span>
                <StagePicker lead={lead} run={run} />
              </li>
            ))}
          </ul>
        )}
        <div className="form-row">
          <LeadForm run={run} />
        </div>
      </section>
    </>
  );
}

function Totals({ view }: { view: UncoveredView }) {
  return (
    <dl className="totals">
      <div>
        <dt>Required</dt>
        <dd>{view.totals.requiredQty}</dd>
      </div>
      <div>
        <dt>Firm</dt>
        <dd>{view.totals.firmQty}</dd>
      </div>
      <div>
        <dt>Covered</dt>
        <dd>{view.totals.coveredQty}</dd>
      </div>
      <div className="indication">
        <dt>Indication</dt>
        <dd>{view.totals.indicationQty}</dd>
      </div>
      <div className={view.totals.uncoveredQty > 0 ? "uncovered" : "covered"}>
        <dt>Uncovered</dt>
        <dd>{view.totals.uncoveredQty}</dd>
      </div>
    </dl>
  );
}

function CoverageBoard(props: {
  requirement: RequirementRecord;
  snapshot: Snapshot;
  ledger: LedgerInput;
  run: Run;
}) {
  const { requirement, snapshot, ledger, run } = props;
  const view = uncoveredView(requirement.id, ledger);
  const client = snapshot.clients.find((entry) => entry.id === requirement.clientId);
  const lines = snapshot.lines.filter((entry) => entry.requirementId === requirement.id);
  const oemName = (id: string) => snapshot.oems.find((entry) => entry.id === id)?.name ?? "unknown OEM";

  return (
    <section className="section">
      <header className="board-head">
        <div>
          <p className="eyebrow">4. Coverage</p>
          <h2>{requirement.title}</h2>
          <p className="muted">
            {client?.name ?? "unknown customer"} · {requirement.tenderRef || "no tender ref"} ·{" "}
            {requirement.submissionDeadline || "no deadline"}
          </p>
        </div>
        <label className="field inline">
          <span>Status</span>
          <select
            value={requirement.status}
            onChange={(event) => {
              void run(
                () => update("requirements", requirement.id, { status: event.target.value }, DEFAULT_ACTOR),
                "Status updated.",
              );
            }}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </header>

      <Totals view={view} />

      {lines.length === 0 ? <p className="muted">No line items yet.</p> : null}

      {lines.map((line) => {
        const part = snapshot.parts.find((entry) => entry.id === line.partId);
        const coverage = view.lines.find((entry) => entry.lineId === line.id);
        const responses = snapshot.responses.filter((entry) => entry.lineId === line.id);
        const availability = oemAvailabilityForPart(line.partId, ledger);
        return (
          <article className="line-card" key={line.id}>
            <div className="line-head">
              <h3>
                {part?.partNumber ?? "unknown part"}{" "}
                <span className="muted">{part?.description}</span>
              </h3>
              {coverage && coverage.uncoveredQty > 0 ? (
                <span className="badge uncovered">UNCOVERED {coverage.uncoveredQty}</span>
              ) : (
                <span className="badge covered">COVERED</span>
              )}
            </div>
            <p className="muted">
              Required {line.requiredQty}
              {line.requiredDeliveryDate ? " · due " + line.requiredDeliveryDate : ""}
            </p>

            <ul className="responses">
              {responses.length === 0 ? <li className="empty">No OEM responses recorded.</li> : null}
              {responses.map((response) => (
                <li key={response.id} className={response.commitmentType}>
                  <span className="oem">{oemName(response.oemId)}</span>
                  <span className="qty">{response.qty}</span>
                  <span className={response.commitmentType === "firm" ? "kind" : "kind indication"}>
                    {response.commitmentType === "firm" ? "firm" : "indication — not counted"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="availability">
              <span className="muted small">Availability per OEM:</span>
              {availability.length === 0 ? (
                <span className="muted small">no supply recorded</span>
              ) : (
                availability.map((entry) => (
                  <span
                    key={entry.oemId}
                    className={entry.availableQty === 0 ? "chip exhausted" : "chip"}
                  >
                    <strong>{oemName(entry.oemId)}</strong>
                    {" committed "}
                    {entry.committedQty}
                    {", available "}
                    {entry.availableQty} of {entry.supplyQty}
                  </span>
                ))
              )}
            </div>

            <ResponseForm lineId={line.id} snapshot={snapshot} run={run} />
          </article>
        );
      })}

      <LineForm requirementId={requirement.id} snapshot={snapshot} run={run} />
    </section>
  );
}

export default function App() {
  const [actor, setActor] = useState(DEFAULT_ACTOR);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [view, setView] = useState<"leads" | "requirements">("leads");

  const refresh = useCallback(async () => {
    setSnapshot(await loadSnapshot());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback<Run>(
    async (action, okText) => {
      try {
        await action();
        await refresh();
        setNotice({ kind: "ok", text: okText });
      } catch (error) {
        const known =
          error instanceof WriteRefused ||
          error instanceof BackupRefused ||
          error instanceof QuantityInputError;
        setNotice({ kind: "error", text: known ? error.message : "Unexpected error: " + String(error) });
      }
    },
    [refresh],
  );

  const ledger = useMemo(() => (snapshot === null ? null : toLedger(snapshot)), [snapshot]);

  async function handleExport() {
    try {
      const bytes = await exportBackup();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "defence-crm-backup-" + new Date().toISOString().slice(0, 10) + ".zip";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice({ kind: "ok", text: "Backup exported." });
    } catch (error) {
      setNotice({ kind: "error", text: "Export failed: " + String(error) });
    }
  }

  async function handleImport(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await run(async () => {
      await importBackup(bytes);
      setSelectedId(null);
    }, "Backup imported. The database now holds exactly what was in the file.");
  }

  async function handleDemo() {
    try {
      const result = await loadDemoData(actor);
      if (result.requirementId) setSelectedId(result.requirementId);
      await refresh();
      setNotice({ kind: result.loaded ? "ok" : "error", text: result.message });
    } catch (error) {
      const known = error instanceof WriteRefused;
      setNotice({ kind: "error", text: known ? error.message : "Demo load failed: " + String(error) });
    }
  }

  async function handleClear() {
    const confirmed = window.confirm(
      "Delete every record, including the audit trail? Export a backup first if you want to keep anything.",
    );
    if (!confirmed) return;
    try {
      await resetDatabase();
      setSelectedId(null);
      await refresh();
      setNotice({ kind: "ok", text: "All data cleared." });
    } catch (error) {
      setNotice({ kind: "error", text: "Clear failed: " + String(error) });
    }
  }

  const selected =
    snapshot?.requirements.find((entry) => entry.id === selectedId) ?? snapshot?.requirements[0] ?? null;

  const today = todayLocalIso();
  const due = dueOnOrBefore(snapshot?.requirements ?? [], today);

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Requirement coverage</h1>
          <p className="muted">One requirement, one record. Firm quantity only.</p>
        </div>
        <div className="masthead-tools">
          <Field label="Working as" value={actor} onChange={setActor} />
          <div className="tools">
            <button type="button" onClick={() => void handleDemo()}>
              Load demo data
            </button>
            <button type="button" onClick={() => void handleExport()}>
              Export backup
            </button>
            <label className="file-button">
              <span>Import backup</span>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImport(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button type="button" className="ghost" onClick={() => void handleClear()}>
              Clear all data
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <p className={notice.kind === "error" ? "notice error" : "notice ok"} role="status">
          {notice.text}
        </p>
      ) : null}

      {snapshot === null || ledger === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <nav className="view-switch" aria-label="Views">
            <button
              type="button"
              className={view === "leads" ? "active" : ""}
              onClick={() => setView("leads")}
            >
              Leads
            </button>
            <button
              type="button"
              className={view === "requirements" ? "active" : ""}
              onClick={() => setView("requirements")}
            >
              Requirements
            </button>
          </nav>

          {view === "leads" ? (
            <LeadsView snapshot={snapshot} run={run} today={today} />
          ) : (
            <>
          <section className="section">
            <h2>1. Masters</h2>
            <p className="muted">
              Add an agency and an OEM here first. The requirement form below reads from these lists, and the
              line items read from the parts list.
            </p>
            <div className="panels">
              <Panel title={"Agencies (" + snapshot.clients.length + ")"}>
                {snapshot.clients.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul className="simple-list">
                    {snapshot.clients.map((client) => (
                      <li key={client.id}>
                        <strong>{client.name}</strong>
                        {client.location ? <span className="muted"> · {client.location}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <ClientForm run={run} />
              </Panel>

              <Panel title={"OEMs (" + snapshot.oems.length + ")"}>
                {snapshot.oems.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul className="simple-list">
                    {snapshot.oems.map((oem) => (
                      <li key={oem.id}>
                        <strong>{oem.name}</strong>
                        <span className="muted">
                          {" · "}
                          {oem.approved ? "approved" : "not approved"}
                          {oem.location ? " · " + oem.location : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <OemForm run={run} />
              </Panel>

              <Panel title={"Parts (" + snapshot.parts.length + ")"}>
                {snapshot.parts.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul className="simple-list">
                    {snapshot.parts.map((part) => (
                      <li key={part.id}>
                        <strong>{part.partNumber}</strong>
                        {part.description ? <span className="muted"> · {part.description}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <PartForm run={run} />
              </Panel>

              <Panel title={"OEM supply (" + snapshot.supplies.length + ")"}>
                {snapshot.supplies.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul className="simple-list">
                    {snapshot.supplies.map((supply) => (
                      <li key={supply.id}>
                        <strong>
                          {snapshot.oems.find((oem) => oem.id === supply.oemId)?.name ?? "unknown OEM"}
                        </strong>
                        <span className="muted">
                          {" · "}
                          {snapshot.parts.find((part) => part.id === supply.partId)?.partNumber ?? "unknown part"}
                          {" · "}
                          {supply.supplyQty}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <SupplyForm snapshot={snapshot} run={run} />
              </Panel>
            </div>
          </section>

          <section className="section">
            <h2>2. Due today or earlier</h2>
            <p className="muted">
              Requirements still awaiting submission whose deadline is today or already past. Today is{" "}
              {today}.
            </p>
            {due.length === 0 ? (
              <p className="muted">Nothing due today or earlier.</p>
            ) : (
              <ul className="requirement-list">
                {due.map((requirement) => (
                  <li key={requirement.id}>
                    <button
                      type="button"
                      className="requirement"
                      onClick={() => setSelectedId(requirement.id)}
                    >
                      <span>{requirement.title}</span>
                      <span className="muted">
                        {requirement.submissionDeadline} · {requirement.status}
                      </span>
                      <span className={isOverdue(requirement, today) ? "badge uncovered" : "badge covered"}>
                        {isOverdue(requirement, today) ? "OVERDUE" : "DUE TODAY"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section">
            <h2>3. Requirements</h2>
            {snapshot.requirements.length === 0 ? <p className="muted">None yet.</p> : null}
            <ul className="requirement-list">
              {snapshot.requirements.map((requirement) => (
                <li key={requirement.id}>
                  <button
                    type="button"
                    className={requirement.id === selected?.id ? "requirement active" : "requirement"}
                    onClick={() => setSelectedId(requirement.id)}
                  >
                    <span>{requirement.title}</span>
                    <span className="muted">
                      {snapshot.clients.find((entry) => entry.id === requirement.clientId)?.name ?? "unknown"} ·{" "}
                      {requirement.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="form-row">
              <RequirementForm snapshot={snapshot} run={run} onCreated={setSelectedId} />
            </div>
          </section>

          {selected ? (
            <CoverageBoard requirement={selected} snapshot={snapshot} ledger={ledger} run={run} />
          ) : (
            <p className="muted">Add a requirement to see its coverage.</p>
          )}
            </>
          )}
        </>
      )}
    </main>
  );
}
