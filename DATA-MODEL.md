# DATA-MODEL.md

The schema for the phase-one release defined in `SCOPE.md`, with the coverage and capacity rules written
out precisely. This is the one document in the project that is expensive to change later, so it is
written before any screen.

Scope note: only phase-one entities appear here. Quote, PO, invoice, delivery, payment and commission
entities are added when their phase begins, as a new Dexie version, with a migration. They are not
designed here.

---

## Conventions (fixed, not choices)

- **Quantities** are whole numbers and non-negative. A fractional or negative quantity is refused with a
  reason. Written as *integer* throughout.
- **Money** is an integer in the smallest unit (paise). Never a float. Formatting for display only.
- **Dates** are ISO `YYYY-MM-DD` strings. Day granularity, no times, no timezones.
- **Identifiers** are opaque strings from `crypto.randomUUID()`.
- **Every row** carries `createdAt`, `updatedAt` and the actor's declared name.
- **Audit** is append-only. Every write that changes data appends an entry. The log is never edited or
  deleted, and it is written from the first phase-one write, not added later.
- **Derived values are never stored.** Balances and coverage are computed on read. The database stores
  only inputs; storing a computed balance is how the two versions drift apart.

---

## Phase-one entities

| Entity | Key fields | Notes |
|---|---|---|
| Client | id, name, division, location, contact, email, phone | The government agency or customer. The end client, not the payer. |
| Oem | id, name, location, contacts, approved (boolean), notes | `approved` is set by a human only. |
| Part | id, partNumber, clientPartNumber, description, oemId (nullable), uom | The unit that coverage, quoting and, later, POs key off. |
| Requirement | id, clientId, title, project, source, tenderRef, submissionDeadline, status, remarks | The central record. |
| RequirementLine | id, requirementId, partId, requiredQty, technicalSpec, requiredDeliveryDate | One part per requirement is the norm; 25-30 is the ceiling. |
| OemSupply | id, oemId, partId, supplyQty | The OEM's stated total supply of a part. This is the pool that capacity is drawn from. |
| SourcingResponse | id, lineId, oemId, qty, commitmentType, responseDate, note | `commitmentType` is `firm` or `indication`. The most consequential field in the schema. |
| Lead | id, name, source, stage, followUpDate, phone, notes | Added 2026-10-02 alongside requirements, not replacing them. `source` is call, whatsapp or referral. `stage` is new, contacted, visited, negotiation, won or lost. |
| Attachment | id, ownerType, ownerId, filename, mimeType, sizeBytes, blob, issueDate, expiryDate (nullable) | Phase one stores and returns files. Expiry is stored but not acted on until phase two. |
| AuditEntry | id, entityType, entityId, action, actor, at, before, after | Append-only. |

Requirement statuses: `received`, `qualifying`, `quoted`, `submitted`, `won`, `lost`, `cancelled`.
**Active** means `received`, `qualifying`, `quoted`, `submitted` or `won`. **Closed** means `lost` or
`cancelled`. The distinction drives every number below.

---

## Coverage and capacity rules

These are the rules the uncovered-quantity view is computed from. They are implemented as pure functions
in `domain/coverage.mts` and proved in `domain/coverage.test.mts`.

**C1. Only `firm` quantity counts as coverage.** An `indication` is displayed and never counted. Firm is
only what the client defined: a signed OEM PO or a written confirmation.

**C2. A response on a closed requirement counts for nothing.** If a requirement is `lost` or `cancelled`,
its firm responses neither cover it nor consume any OEM's supply.

**C3. Coverage of a line** is computed from its own firm responses:
- `firmQty` = sum of firm responses on that line
- `coveredQty` = min(`firmQty`, `requiredQty`)
- `uncoveredQty` = max(`requiredQty` − `firmQty`, 0)
- `oversupplyQty` = max(`firmQty` − `requiredQty`, 0)
- `indicationQty` = sum of indication responses on that line, shown separately

No value is ever negative. Coverage never exceeds the required quantity.

**C4. Capacity is global across orders, and it belongs to the OEM-and-part pair.** The available
quantity for an OEM and part is `supplyQty` minus every firm commitment made against that pair across
all active requirements — not just the one being viewed. A commitment made for one order reduces what
every other order can draw. This is the decision the client made when he chose "300" over "1,000".

**C5. Availability excludes the requirement you are working on.** When viewing requirement R, the
available quantity shown for an OEM and part is `supplyQty` minus firm commitments on *all other* active
requirements. R's own commitments are shown as its coverage, not as a reduction in what it can still
draw. Without this rule the screen double-counts and a requirement appears to consume its own capacity.

**C6. Supply cannot be over-committed.** A firm commitment that would push total firm commitments for an
OEM-and-part above its `supplyQty` is refused at the write boundary with a reason naming the supply, what
is already committed, and the remaining headroom. A commitment is never silently capped.

**C7. Losing or cancelling a requirement releases its commitments automatically.** *Confirmed by the
client.* Because coverage is computed rather than stored, this falls out of C2: closing a requirement
immediately returns its firm quantity to every other order's availability. A lost bid does not hold
capacity.

**C8. Quantity validation at the edge.** `requiredQty`, `supplyQty` and response `qty` are refused unless
they are non-negative integers. A record with an invalid quantity saves nothing.

---

## What the uncovered view must show

For a requirement, one row per line, and nothing hidden behind a tap:

- required, firm, indication, covered, uncovered, for each line
- the per-OEM split of firm and indication behind each line, so "who is covering this" is visible
- the totals across the requirement

Two presentation rules that are part of the requirement, not styling:

1. **An uncovered balance greater than zero must be unmissable.** It cannot be shown as a neutral figure
   beside the covered number, and it is never rounded away.
2. **An indication must never be rendered in the same visual weight as a firm commitment.** The client's
   stated fear is a team trusting an uncommitted quantity; a screen that makes the two look alike causes
   exactly that.

---

## Worked example (the acceptance case)

Required 1,000 for part P1. `OemSupply` A/P1 = 1,000, B/P1 = 1,000.

| Case | Responses | coveredQty | uncoveredQty | indicationQty |
|---|---|---|---|---|
| Both firm | A 600 firm, B 400 firm | 1,000 | 0 | 0 |
| B only indicates | A 600 firm, B 400 indication | 600 | 400 | 400 |
| Nothing firm | A 400 indication only | 0 | 1,000 | 400 |
| Oversupply | A 1,500 firm | 1,000 | 0 | 0 (oversupply 500) |

And the capacity case the client chose: with A/P1 supply 1,000 and a firm 700 already committed on another
active requirement, a new requirement sees **300** available for A/P1, and a firm request for 400 more is
refused with the reason.

---

## Leads (added 2026-10-02, alongside requirements)

Leads are prospective business, tracked separately from the RFI/requirement record, which remains the
central record for fulfilment. A lead may later produce a requirement, but it is not one, and nothing in
the coverage rules changes.

- `source` is one of `call`, `whatsapp`, `referral`. This is the lead's origin, and is deliberately a
  different list from the enquiry-source values recorded in the client's own spec (GeM / client portal /
  direct / OEM); the two describe different things and must not be merged.
- `stage` is one of `new`, `contacted`, `visited`, `negotiation`, `won`, `lost`.
- `followUpDate` is required on every lead, ISO `YYYY-MM-DD`.
- A lead is **open** while its stage is `new`, `contacted`, `visited` or `negotiation`. `won` and `lost`
  are closed, and a closed lead never appears in the due list.
- The due list shows leads whose `followUpDate` is today or earlier, compared as ISO text, using the same
  local-date rule that `src/domain/dates.ts` applies to requirement deadlines.
- Storage rule `L1`: every lead has a name and a follow-up date; a lead without either saves nothing.

---

## Confirmation status

Rules C1 to C8 are confirmed by the client. C7 — a lost or cancelled requirement releases its committed
quantity back to the shared pool — was confirmed after it had already been implemented and tested, and is
no longer an assumption. No rule in this document is currently unconfirmed.
