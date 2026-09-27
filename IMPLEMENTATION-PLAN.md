# IMPLEMENTATION-PLAN.md

The build order for the CRM described in `PRD.md`, using the stack fixed in `TECH-STACK.md`.
Written to be followed literally: where a rule is enforceable, the enforcement is named.

---

## Before the order: two things you need to know

**Your model-call rule does not discriminate in this project, and pretending it does would misorder the
build.** The rule — everything that works without a model comes first — is the right instinct, but
`TECH-STACK.md` removed every model call from the product: the plain-language questions are answered by a
local deterministic parser, not an LLM. So there is no "needs an API call" tier at all. Every feature is
deterministic and every feature survives a rate limit. I have applied the *spirit* of the rule instead —
most deterministic and most foundational first, and the question parser last, because it reads everything
else. If you expected an AI tier sitting apart from a deterministic tier, there isn't one, and that is a
deliberate result of the stack, not an omission from this plan.

**The order in `PRD.md` is not a build order, and following it literally will hurt in three places.**
`PRD.md` numbers its modules 1 to 11 and says "build these in order". Three of those placements are
wrong for a build:

1. **Audit and approvals are module 11; they must be in the foundation.** An audit trail written
   last records nothing that happened before it. Every write from Step 2 onward must pass through the
   audit log, or the "what, who, when" the PRD requires is missing for the first half of the product's
   own history.
2. **Module 4 needs module 9 to exist first.** "Before pricing, show comparable past bids" cannot be
   built at module 4, because comparable bids come from recorded outcomes in module 9. Outcome recording
   and loss reasons must exist before the comparison surface does, or the pricing screen ships with a
   promise it cannot keep.
3. **The two costs the client leads with are in modules 5, 7 and 8, which the PRD defers.** Follow-ups at
   "3 to 4 hours a day" and documents at "about 1 week" are not reached until late. I am not moving them
   to the front — the foundation genuinely has to come first, and I say why in Step 1 — but you should
   know that the first demonstrable relief for the client is later than module 1 suggests.

The rest of this document is the order I would use, with the reason each step sits where it does.

---

## The one decision most expensive to reverse

**Global OEM capacity: quantity is owned by the OEM-and-part pair and drawn down by firm commitments
across all orders.** This is the decision the client made when he chose "300" over "1,000" (PRD section
6, item 1). It is settled in the Step 2 data model and first exercised in Step 7, and it is the most
expensive thing here to change later, because it redefines what the word *available* means everywhere:
on the OEM record, on the requirement, on the coverage view, on the quote, and on every warning the
system raises. Reversing it after orders exist means re-deriving every historical availability figure and
re-auditing promises already made to customers. It is set once, in Step 2, and never re-opened.

Two close seconds, both also fixed in Step 2: money stored as integer minor units, and the fact that the
**customer is not the payer** — the government agency is the end client, the OEM is who pays the
commission. Getting that relationship backwards would hang the commission ledger off the wrong party, and
unpicking it means rewriting every payment and commission record.

---

## The order

### Stage A — the spine

**Step 1. A skeleton that runs and passes its gates.**
- *Build:* repository, TypeScript strict, Vite serving on localhost, ESLint and Prettier, Vitest wired,
  a single page that loads.
- *Why here:* nothing else can be verified until the gates exist. The failure this prevents is the demo
  that runs but cannot be checked.
- *Demo:* the page opens on localhost; `tsc --noEmit`, lint and test all run clean and are shown.
- *If wrong downstream:* every later step loses its only automatic check, and "it works on my machine"
  becomes the whole verification story.

**Step 2. The walking skeleton: persistence, validation, audit, backup, approval primitive — proved on
one real entity (the Requirement).**
- *Build:* the complete IndexedDB schema for **all** entities and relations (not just Requirement), the
  Dexie version chain and migration harness, one Zod schema per entity, a single write gateway that
  validates → writes in a transaction → appends an audit row, the approval primitive (a status change
  carrying an actor and a timestamp), and export/import of one zip. Then Requirement create, list, edit
  and view through that gateway.
- *Why here:* this is the one step that cannot be split usefully. Each of its parts is invisible alone,
  and a foundation split into invisible pieces is exactly how a project ends up with a polished demo and
  no base. The whole data model is written here, once, which is why the expensive decision above is made
  here and only here.
- *Demo:* create a requirement, reload the browser, it is still there; change it, and the audit log shows
  what changed and when; export a backup, clear storage, re-import, and the requirement returns.
- *If wrong downstream:* a schema that accretes module by module forces a migration per module and
  corrupts the "one requirement, one record, one timeline" premise. A gateway that anything can bypass
  silently loses audit rows and lets invalid records in.

**Step 3. Masters: customer or agency, OEM, and product or part.**
- *Build:* records and simple list and edit screens for the three masters named in `PRD.md` modules 1
  and 2, with the OEM's "approved or not" flag.
- *Why here:* requirements reference them, and sourcing references the OEM. They are the first foreign
  keys, so they must exist before anything that points at them.
- *Demo:* add a customer, an OEM and a part; a requirement can now select them.
- *If wrong downstream:* the OEM key underpins commitments, quotes and commission; a weak or duplicated
  OEM identity breaks the global capacity ledger and misattributes commission.

### Stage B — the hard part

**Step 4. Requirement line items.**
- *Build:* line items under a requirement — part number, client part number, quantity, unit, technical
  specification, required delivery date. One part per requirement is the norm; the 25-30 case is the
  ceiling (`PRD.md` section 6, items 3 and 5).
- *Why here:* the line item, not the requirement, is the unit that coverage, quoting and the PO all key
  off. Building sourcing before it would build it against the wrong key.
- *Demo:* a requirement with its line items listed and editable.
- *If wrong downstream:* coverage, quote lines and PO lines inherit the mistake and every quantity in the
  system is attributed to the wrong thing.

**Step 5. Document and compliance vault.**
- *Build:* documents as entities with type, supplier, issue date, expiry date and links to product and
  requirement; files stored as blobs; upload, list, download.
- *Why here:* `PRD.md` module 1 captures documents at requirement time, and module 2 needs OEM compliance
  documents, so it has to exist before sourcing and before the quote. It is cross-cutting, which is
  another reason to build it early rather than bolt it on.
- *Demo:* upload a compliance certificate against an OEM, see it listed with its expiry date, download it.
- *If wrong downstream:* expiry reminders, compliance gating and the vault search all read these records;
  a document with no expiry or no link is invisible to every reminder the client asked for.

**Step 6. OEM sourcing: requests, responses, and commitment types.**
- *Build:* per requirement, shortlist OEMs, record each request and each response, and record a quantity
  with a commitment type of **firm** or **indication** (plus availability or quote indication). Firm is
  only what `PRD.md` section 6 item 4 defines: a signed OEM PO or written confirmation.
- *Why here:* this is the record that feeds coverage. It must exist, with its types correct, before any
  coverage number is shown, or the coverage view has nothing trustworthy to count.
- *Demo:* a requirement with two OEM responses, one firm and one indication, visibly distinguished.
- *If wrong downstream:* this is the highest-consequence error in the product. If indications count as
  firm, coverage reads green while nothing is committed, and the client commits to quantity he does not
  hold — the exact failure `PRD.md` warns against.

**Step 7. Coverage and the global capacity ledger.**
- *Build:* required against firm-committed against uncovered, per part; availability on an OEM reduced by
  firm commitments already made across every other order; several OEMs and several shipments covering
  one requirement; and a defined release rule for commitments when a requirement is lost or cancelled.
- *Why here:* it needs Steps 4 and 6. It is the highest-value feature in the product and the one the
  client called "the hard part", so it comes before anything glossy.
- *Demo:* 1,000 required, OEM A 600 firm and OEM B 400 firm, coverage 1,000, uncovered 0; then a second
  requirement sees only what is left.
- *If wrong downstream:* every quote and every PO quotes a quantity that may not exist. The release rule
  matters as much as the draw-down: without it, availability silently decays as orders close.

### Stage C — money in

**Step 8. Quotes: versions, approval, pricing inputs.**
- *Build:* a quote built from a requirement and its line items, carrying OEM price, lead time, target
  margin and a recommended price that the human edits; versioning where an approved quote is immutable
  and a change creates a new version; an approval gate before submission.
- *Why here:* it needs line items and OEM responses, both done. The approval gate must exist here because
  `PRD.md` requires quotes to be approved before they are used.
- *Demo:* build a quote from a requirement, approve a version, change it, see a new version appear while
  the approved one stays fixed.
- *If wrong downstream:* the PO in Step 11 must map to an approved quote; if versions are mutable or the
  gate is soft, that rule cannot be enforced and quotes can be edited under a submitted bid.

**Step 9. Outcomes, structured loss reasons, and the comparable-bid surface.**
- *Build:* record won or lost with a structured loss reason from a closed list; then the surface that
  shows comparable past bids, what was quoted, won or lost, and the winning or losing price.
- *Why here:* this is the correction to the PRD's order. Outcomes must be recordable before any
  comparison can show them, so the recording comes first and the comparison follows in the same step.
  Until history exists, the comparison must say so explicitly rather than show nothing.
- *Demo:* mark a quote lost with a reason; then open a new quote and see the comparable past bid, or an
  honest "no comparable history yet".
- *If wrong downstream:* if free text is allowed where the reason should be, loss analysis in Step 15 is
  impossible and the client repeats the mistake he is paying to avoid.

### Stage D — response and order

**Step 10. Government response states and follow-up tasks.**
- *Build:* the post-submission states — submitted, clarification requested, technical clarification,
  commercial negotiation, awaiting approval, won, lost, cancelled — and follow-up tasks generated from
  rules such as no response for seven days. Internal tasks only; nothing sends.
- *Why here:* it needs the quote to be submitted first. It is also the first step that gives the client
  back time from the "3 to 4 hours a day" of follow-ups, so it should not slip further than this.
- *Demo:* submit a quote, and when the response date passes, a follow-up task appears in the task list.
- *If wrong downstream:* the dashboard's "quotes awaiting a response" and "OEM responses pending" counts
  read from these states; wrong states make the morning view lie.

**Step 11. The order and the PO.**
- *Build:* convert an approved quote to an order with the whole history carried over; PO number and date,
  product, quantity, price, delivery deadline, selected OEM, the supplier PO, and the compliance,
  inspection and PDI requirements. The rule is enforced, not merely displayed: **a PO cannot exist unless
  an approved quote exists.**
- *Why here:* it needs the approved quote from Step 8. It is the hinge between selling and delivering.
- *Demo:* an approved quote becomes a PO; attempting to create a PO without an approved quote is refused
  with a clear reason.
- *If wrong downstream:* an orphan PO breaks the audit chain, and every invoice, delivery and commission
  record hangs off a PO whose origin cannot be proved.

### Stage E — delivery and money out

**Step 12. Fulfilment timeline, PDI, and delivery risk.**
- *Build:* timeline steps from OEM PO placed through production, PDI scheduled and passed, government
  inspection, dispatch, delivered and accepted, each with an owner and an expected date; PDI with three
  separate quantities — offered, cleared, rejected; a hold or failure blocking dispatch; and a risk flag
  comparing projected completion to the committed deadline.
- *Why here:* it needs the PO. It is the step that answers "where is our order?" before the client asks.
- *Demo:* a PO shows its timeline, a PDI records offered 100, cleared 90, rejected 10, dispatch is held
  while the PDI is not passed, and a slipping expected date raises a risk flag.
- *If wrong downstream:* if cleared is allowed to equal offered, or offered is used as cleared, the client
  signs off quantity that failed inspection, and the delivery and payment balances in Step 13 are wrong
  from the start.

**Step 13. Invoices, deliveries, partial payments, and lifecycle balances.**
- *Build:* many invoices per PO, many deliveries per invoice, partial payments against an invoice with
  due dates and reminders; balances visible across the lifecycle — requested, quoted, committed, ready,
  inspected, invoiced, delivered, accepted, paid.
- *Why here:* it needs the PO and PDI quantities. It is the money-in ledger.
- *Demo:* one PO with two invoices and three deliveries, a part payment on one invoice, and each balance
  shown as a number that a person can check by eye.
- *If wrong downstream:* commission in Step 14 is calculated on invoice value, so an incorrect invoice or
  payment balance produces a wrong commission, silently, and it is found at settlement.

**Step 14. Commission on the OEM-payment milestone.**
- *Build:* the commission ledger hanging off the OEM, as a percentage of the OEM's invoice value, with the
  commission invoice record. The trigger is the "OEM payment milestone", and it is **gated on one
  unanswered detail** — the exact event that counts as the milestone (end client has paid the OEM, PDI
  cleared, or delivery accepted). Build the ledger shape now, and wire the trigger once that is confirmed;
  do not default it silently.
- *Why here:* it needs the payment records from Step 13.
- *Demo:* a payment event at the milestone raises a commission due with its percentage and base value
  shown; before the milestone, commission is zero.
- *If wrong downstream:* a guessed trigger recognises revenue at the wrong time on every order, and the
  error is a financial one that only appears at settlement.

### Stage F — read only

**Step 15. Cross-entity search and history, including loss analysis.**
- *Build:* search across requirements, OEMs, quotes, orders and documents; a comparable-requirement view
  surfacing past OEM, price, delivery time, margin, documents and problems; loss reasons aggregated.
- *Why here:* it reads everything, so it cannot be built before everything is recorded consistently. This
  is the step the PRD placed at module 9 but whose value is realised only after outcomes exist.
- *Demo:* search a requirement and see the past OEM, price, margin and outcome; ask what was lost and why.
- *If wrong downstream:* search that silently omits records is worse than no search, because the client
  will price against a partial history and believe it is complete.

**Step 16. The morning dashboard.**
- *Build:* exactly the six answers `PRD.md` names — open orders and their states, quotes awaiting a
  response, orders at delivery risk, payments pending, OEM responses pending, documents expiring.
- *Why here:* every count reads from a step above it.
- *Demo:* the six counts, each of which can be traced to the list behind it.
- *If wrong downstream:* a wrong count on the morning view is the fastest way to lose trust in the system,
  because it is the first screen seen every day.

**Step 17. Plain-language questions.**
- *Build:* the local deterministic parser over a fixed question set, mapped to parameterised queries,
  covering the four example questions. An unrecognised question returns an explicit "I do not have that
  data", never an approximation.
- *Why here:* it queries all the data, so it comes after the data is trustworthy. It is last for that
  reason alone — it needs no model, so it is not blocked by any provider (see the note at the top).
- *Demo:* "how many orders are there", "how many contracts did we win this month", "what did we lose",
  "why did we lose them" — each answered from stored rows, and a question outside the set answered
  honestly with "no".
- *If wrong downstream:* a parser that returns zero for both "no matching records" and "I did not
  understand" is the silent failure of this step; the two must be distinguishable on screen.

**Step 18. Roles, approvals surface, and the audit viewer.**
- *Build:* the declared-role layer, the approval screens on quotes, documents, orders and compliance
  items, and a viewer over the audit log written since Step 2.
- *Why here:* the audit log is written from Step 2; only its presentation is late. This step depends on
  the audit data already existing.
- *Demo:* the audit log for one requirement from creation to now, with each entry attributed; an approval
  recorded against a quote.
- *If wrong downstream:* per `TECH-STACK.md`, without authentication the actor is self-declared. If this
  step is presented to the client as a control rather than a record, it oversells what it can prove.

---

## Steps that could silently half-work

These are where the build will appear to succeed and the fault will surface later, in front of someone.

- **Coverage (Step 7)** — if an indication is ever counted as firm, coverage reads green with nothing
  committed. Guard: coverage counts only firm; a test asserts an indication does not move the number.
- **Capacity release (Step 7)** — if commitments are not released when a requirement is lost or cancelled,
  availability silently decays and later orders are wrongly refused. Guard: a released-order test.
- **PDI quantities (Step 12)** — if cleared is defaulted from offered, failed quantity is signed off.
  Guard: offered, cleared and rejected are three independent fields, and cleared never defaults.
- **Audit coverage (Steps 2 onward)** — any write that bypasses the gateway saves data and writes no
  audit row. Guard: the gateway is the only write path, and a test asserts a bypass attempt cannot exist.
- **Backup round-trip (Step 2)** — an export that omits document blobs restores a database with the
  documents missing, and nothing looks wrong until a compliance file is needed. Guard: the round-trip test
  includes a binary document and asserts it survives.
- **Money rounding (Steps 8, 13, 14)** — integer minor units with one rounding rule, or sums drift by
  paise across partial payments and percentage commission. Guard: balances reconcile to the paise in tests.
- **Commission trigger (Step 14)** — an unset trigger defaulting to something plausible recognises
  revenue at the wrong time. Guard: the trigger is a named, confirmed event; until confirmed, commission
  stays zero and the gap is visible, not guessed.
- **Approval gate (Steps 8, 11)** — an approval that is a button rather than a gate lets an unapproved
  quote be submitted or a PO be raised. Guard: the gate is in the write gateway and asserted by test.
- **Search completeness (Step 15)** — a search that quietly skips a record type returns a partial history
  the client treats as complete. Guard: a test seeds one record of each type and asserts all are found.
- **Question parser (Step 17)** — "no matching records" and "I did not understand the question" must not
  render the same way. Guard: two distinct responses, both tested.
