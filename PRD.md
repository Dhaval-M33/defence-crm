# PRD — CRM for a defence contract consultant

**Source of truth:** the Requirement brief supplied for "Ram Prasad", treated as the discovery output.
Every quotation, figure and name below is taken from that brief. Nothing has been invented.
**Evidence note:** the nine spreadsheets in `Ram Prasad Assets\` were inspected separately, including their
formulas, sheet visibility and hidden content, so that nothing in them was missed. The brief remains the
confirmed source for the module requirements. Where his own written specification workbook is quoted — the
money-flow analysis in section 4 — it is quoted as his own statement of intent, not as executed data. No
raw data value (price, quantity, date or customer name) has been taken from those files.

---

## 1. The client, in five lines

- A defence contract consultant, working as a one-to-few-person practice, not a department.
- Volume: "roughly 25 to 30 enquiries a month, about 20 quotations, about 10 orders, and 20 to 25 active orders at any time."
- He sells fulfilment, not product: "Government and defence agencies send him requirements; he fulfils them through a network of OEM suppliers."
- His inventory is relationships and documents — OEM capability, compliance papers, past bids — not stock.
- He runs the business on "Excel, email and memory", and the cost of that shows up as "follow-ups 3 to 4 hours a day" and quotes that "start from scratch".

---

## 2. What he said, and what it means for the build

| He said (verbatim) | What it means for the build |
|---|---|
| "Today it runs on Excel, email and memory." | The system replaces three tools, not one. Email stays; Excel and memory must be retired or the record is duplicated and nothing is trusted. |
| "The central record is the RFI / tender requirement. Everything else hangs off it: OEM sourcing, the quote, the PO, PDI and inspection, delivery, payment and commission." | One parent entity owns everything downstream. Every other record must be reachable from the requirement and must not be creatable without it. |
| "One requirement can carry many line items (up to 500 part numbers), not one giant text field." | Line items are first-class rows with their own quantity, part number and specification. The requirement is a container, not a text blob. |
| "Capture a requirement: customer or agency, product, quantity, required delivery date, technical specifications, tender or enquiry reference, submission deadline and documents." | Minimum field set for a valid requirement. Documents attach at requirement level, so they must be storable before any quote exists. |
| "Statuses: received, qualifying, quoted, submitted, won, lost, cancelled." | A closed status list for the requirement, distinct from the post-submission states in module 5. |
| "An OEM record: products supplied, capabilities, prices, typical lead time, compliance documents, contacts, past performance, approved or not." | OEM is a durable master, not a per-enquiry note. "approved or not" is a gated attribute, because OEM choice needs human approval. |
| "From a requirement, shortlist the OEMs who can make it, and record each request and its response." | Each sourcing approach is its own record with a request and a response, so response latency is measurable per OEM. |
| "Show required quantity against OEM committed quantity, with the uncovered balance: 1,000 needed, OEM A 600, OEM B 400, coverage 1,000, uncovered 0." | Coverage is a computed view over commitments, never a typed number. The uncovered balance must always be visible. |
| "Allow several OEMs and several shipments to cover one requirement." | Coverage and fulfilment are both many-to-one against the requirement. |
| "Distinguish a firm quantity commitment from a mere availability or quote indication." | Commitment carries a type. Only firm quantity counts toward coverage. This is a data attribute, not a label on a screen. |
| "Do not let the team confidently commit to a quantity the OEMs have not covered." | The system must actively withhold confidence: an uncovered or indication-only balance must read as uncovered wherever quantity is displayed or acted on. |
| "Build these in order; the first three are the ones that matter most." | Stated priority, not a proven one — see section 4. It is also a build instruction, which is out of scope for this document. |
| "Before pricing, show comparable past bids: what was quoted, whether it was won or lost, and the winning or losing price. He changes the bid from that history." | Pricing is a decision made against historical context. Requires clean past records with outcomes and prices, before pricing can be trusted. |
| "Version and approve quotes." | Quotes are immutable once approved; changes create a new version. Approval is a required gate before a quote can be submitted or converted. |
| "No orphan PO: every PO maps to an approved quote." | Hard integrity rule: a PO cannot exist unless an approved quote exists to attach it to. |
| "One PO can have multiple invoices." — and — "One invoice can be fulfilled by several delivery events." | Invoice and delivery are independent many-to-many dimensions against the PO, each with its own balance. |
| "PDI is quantified: quantity offered, cleared, rejected." — and — "PDI cleared is distinct from offered and rejected." | Three separate quantities on every inspection. Cleared is never inferred from offered. |
| "A failed or held PDI can block dispatch." | PDI outcome is a gate on dispatch, not a status note. A hold must be an explicit, lifting state. |
| "Support partial deliveries, with the outstanding balance visible." | Every fulfilment stage must expose ordered-minus-done. No stage may show "complete" while a balance remains. |
| "Flag delivery risk early: expected completion against the committed deadline, so he is not asked 'where is our order?' before he knows." | Each timeline step needs an owner and an expected date, and the system compares the projected finish to the committed deadline and raises risk before the deadline, not after. |
| "Commission is earned on an OEM-payment milestone, subject to the open question below." | Commission is an event-triggered, not date-triggered, receivable. It cannot be recognised until the milestone is met. |
| "Support partial payments, due dates and reminders." | Payments are events against an invoice, with a running balance; reminders are derived from due dates. |
| "A document and compliance vault: type, supplier, issue date, expiry date, linked product and requirement, with expiry reminders." | Documents are entities with their own lifecycle and expiry, linkable to products and requirements, and searchable by expiry. |
| "He keeps approved item lists that renew every 3 to 5 years." | Long-horizon expiry tracking. A renewal cycle measured in years is a core use case, not an edge case. |
| "Search all history for a comparable requirement, and surface the past OEM, price, delivery time, margin, documents and problems." | Search must return outcome context, not just documents. Its usefulness is capped by the quality of past records. |
| "When an opportunity is lost, record a structured loss reason: price, technical non-compliance, delivery timeline, competitor preference, quantity or capacity, cancelled, not pursued, other." | Loss reason is a closed list, so losses can be counted and compared. Free text destroys the analysis. |
| "The morning view answers: how many orders are open and what state each is in, quotes awaiting a response, orders at delivery risk, payments pending, OEM responses pending, documents expiring." | Six named, fixed answers. This is the whole v1 dashboard — nothing more was asked for. |
| "He wants to ask in plain language: 'how many orders are there?', 'how many contracts did we win this month?', 'what did we lose?', 'why did we lose them?'." — and — "Answer from the stored data, never invented." | A question interface whose only acceptable failure mode is "I don't have that data". It may never approximate, estimate or fill a gap. |
| "Roles: owner or management, sales, operations, finance." | Four named roles, but no headcount, and no allocation of duties was given — see section 4. |
| "An audit trail of material changes: what, who, when." | Every material change is append-only and attributable to a named user. This depends on the roles above being real people. |
| "No automatic final bid price." — yet — "recommended price", "He changes the bid from that history." | The system may suggest and must not set. "Recommended" needs a precise, visible derivation, and the human always owns the final number. |
| "No OEM chosen without human approval." — yet — "shortlist the OEMs who can make it." | Ranked shortlisting is allowed; selection is a human act. The interface must never present a shortlist as a decision. |
| "Not a full accounting or ERP replacement, and not a generic document generator." | Money figures are for tracking and visibility, not statutory books. Documents are records and data-derived outputs, not a templating product. |
| "No government-portal automation or auto-messaging as a baseline requirement." | Internal reminders and tasks only. Nothing sends on his behalf, and no portal is integrated, in the baseline. |

---

## 3. The problems, ranked by what they cost him

Ranked by cost — money lost, hours lost, or trust lost — not by how often the brief mentions them.
The brief's module order is not the same as this order, and that gap matters (section 4).

**1. He prices and bids blind, so he loses margin on every quote.**
"History is not searchable, so every new quote starts from scratch." Every quote is therefore re-derived
from first principles, with no memory of what won, what lost, or at what price. At "about 20 quotations"
a month, this is the single largest recurring cost, and it repeats forever until history is usable. It also
feeds the next problem directly: the same missing history is why "Quotation prep takes 3 to 4 days".

**2. Follow-up occupies half his working day.**
"follow-ups 3 to 4 hours a day." Call it a half-day, every working day, of manual chasing. In a
one-to-few-person practice this is not an inefficiency; it is the dominant cost of doing business, and it
is exactly what a system should absorb. Note that only *internal* reminders are in scope.

**3. He cannot see his own obligations until a customer asks.**
"Flag delivery risk early ... so he is not asked 'where is our order?' before he knows." The cost here is
trust, and it is asymmetric: one surprise on an active government order costs more goodwill than many
hours of admin. With "20 to 25 active orders at any time" tracked on a spreadsheet, the surprise is
structural, not unlucky.

**4. He risks committing to quantity he does not hold.**
"Do not let the team confidently commit to a quantity the OEMs have not covered." This is the brief's own
"hard part". It is low-frequency and high-severity: a committed-but-uncovered quantity is a contractual
and reputational exposure on a government order. Ranked fourth by cost but first by downside.

**5. Document creation and quote assembly consume the best part of a week.**
"document creation about 1 week" plus "Quotation prep takes 3 to 4 days". Much of this is likely waiting and
rework rather than labour, and the brief itself qualifies the quote delay — see section 4. The addressable
part is the data-driven portion; the hand-prepared portion is not a software problem.

**6. Commission and payment leakage.**
"Commission is earned on an OEM-payment milestone"; "Support partial payments, due dates and reminders."
With partial payments normal and commission triggered by an external event, receivables are easy to lose
track of quietly. The cost is invisible until an audit, which makes it worth building even though it was
mentioned late.

**7. OEM response latency is unmeasured.**
"OEM communication 1 to 10 days." A tenfold spread is a scheduling risk, and today nothing records which
OEMs are fast. Partly external, but the *measurement* is entirely a software problem.

**8. Losses leave no trace, so nothing is learned.**
Loss reasons are proposed as a list, not as data. Without structured reasons, the next bid repeats the last
mistake, which compounds problem 1.

---

## 4. What does not add up

**Objection first: do not build the money-and-fulfilment half yet. The schema still rests on one
unanswered question, and guessing it means rebuilding the core later.** The money question — "Who invoices
whom and who pays the OEM? When is commission actually earned?" — governs quoting, ordering, payment and
commission, and it is still open. It cannot be answered from his records, because no supplied file contains
the money trail (below); it must be answered with one real transaction. The question that sat beside it —
global or per-order capacity — is now answered, and the answer is material: capacity is global, so
coverage becomes a shared ledger that every order draws down, not a private calculation per requirement.
That is a different schema from the one the "hard part" example implied, and it was decided by a single
follow-up.

The rest, in descending order of severity.

**The stated priority order contradicts his own pain.** He says "Build these in order; the first three are
the ones that matter most." But the costs he leads with — "follow-ups 3 to 4 hours a day" and "document
creation about 1 week" — live in modules 5, 7 and 8, which that order defers. Modules 1 to 3 are structural
and necessary, but they do not remove a single hour from his day on their own. Either the priority is
wrong, or the cost figures in the brief are not the ones that drive the decision. He should say which.

**He has already told you the quote delay is partly not a software problem.** "Quotation prep takes 3 to 4
days (partly because it is never urgent)." That parenthetical is the most important sentence in the brief.
A task that is "never urgent" to anyone is a prioritisation and incentive problem, and software will not
make it urgent. Until someone owns the deadline, the tool will just record the delay faster. Note the
direct contradiction with module 4, which presumes urgency ("submission deadline") and module 5, which
presumes responsiveness ("no response for seven days").

**The revenue model is stated two ways and is never resolved.** The brief describes reselling — "he
fulfils them through a network of OEM suppliers", with "target margin, recommended price" — and also
brokering — "Commission is earned on an OEM-payment milestone". Margin and commission are different
businesses with different money flows, and the same quote cannot cleanly feed both. He flags it himself
("Confirm with one real transaction"). It has since been resolved in favour of commission as the primary
flow, with the trading model possibly a second type (below) — but at the time of writing the brief left it
open rather than treating it as the blocking decision it was.

**The money direction is now confirmed: the agency model.** Asked to choose, he confirmed the flow —
"the OEM pays Ram Prasad's company once commission is earned" — which matches his written spec rather than
the brief's ambiguous phrasing. The chain is: the OEM invoices the end client after PDI clearance; the end
client pays the OEM; the OEM pays his company the agreed commission. His company never pays the OEM. Two
details are still undefined, and both are needed before the commission module is complete: the exact event
that counts as the "OEM payment milestone", and whether any orders run on the alternate trading model in
the sales register.

**The assets do state an intended flow, and on a careful read it is the agency model.** The dashboard sheet
of his own spec carries the rule in plain words: "Commission invoice can only be raised after OEM payment
milestone." Its commission module bills the OEM — "OEM Name — OEM billed", "Commission Percentage —
Agreed commission", "Base Invoice Amount — OEM invoice value". Its payment module tracks "client payments
made to OEMs". Its order-management stage list runs RFI → Quotation → Purchase Order → Invoice to OEM →
Delivery → Payment to OEM → Inverbrass Invoice, the last marked "After Payment is received by primary
client ... within 7 days". Read together, the stated flow is: the OEM invoices the end client after PDI
clearance; the end client pays the OEM; his company raises a commission invoice on the OEM once the OEM
payment milestone is met. In that flow his company never pays the OEM, and he has now confirmed that this
is the correct reading.

**The same workbook set also contains the opposite model.** The sales register (`4. Sales 26-27.xlsx`) is
his company invoicing a customer directly — "CUS, LOC, INV NO, INV DT, PO NO, PO DATE, ITEM, QTY (Mtrs),
NET, GST 18%, GROSS". That is trading: he buys from the OEM and sells on, and the margin is his revenue.
So the files show two monetisation modes — commission on the OEM's invoice, and margin on his own. The
brief collapses both into "target margin" and "commission", which is why the revenue model read as a
contradiction. It may not be one: it may be two transaction types, chosen per requirement. That is a
question for him, not an assumption for me.

**No executed money trail exists in his records.** A walk of one real order was attempted across all nine
supplied files. The front of the chain survives in fragments — enquiry, quote reference, PO number,
customer, quantity, rate, value and a delivery-due date — but the back of the chain is empty: the orders
sheet's invoice, supplied-quantity and balance columns hold no data in any row; the payments workbook
contains working deduction formulas (18% GST, TDS, LD) yet not one filled transaction, only zeroes and
`#REF!`; and the sales register has no invoice rows. The intended flow is written down (above), but no
completed order shows it running. That is exactly why he asks to "confirm with one real transaction" — the
transaction is not in the spreadsheets. It is also why the commission module cannot be finished yet: the
rule is stated, but the trigger event it depends on is not defined anywhere.

**A later module feeds an earlier one, so "build in order" cannot hold.** Module 4 needs history —
"Before pricing, show comparable past bids" — but history is module 9, "Search all history for a comparable
requirement". The quote module cannot show comparable bids until the search module exists, and search is
only as good as the records, which the brief itself doubts: "Which historical Excel columns are trustworthy
enough to power quote comparison and win or loss analysis?" So the flagship feature of module 4 inherits an
unresolved data-quality question from module 9. This is the clearest case of something promised in two
phases at once.

**"Up to 500 part numbers" is a ceiling presented as a requirement — now confirmed as hypothetical.**
Asked for the largest requirement he has actually handled, he said 25-30, and that a real requirement is
usually a single part. The 500 figure should therefore not drive interface work: bulk entry and
large-line-item review are not the common path and should not be the design centre. (One caveat to
re-confirm: 25-30 is also the brief's monthly enquiry figure, so it may be the monthly volume restated
rather than the largest line-item count.)

**Coverage is demonstrated with one product and specified for many — now partly resolved.** The worked
example — "1,000 needed, OEM A 600, OEM B 400" — is a single quantity, and he has confirmed a real
requirement is usually "one part". Coverage is therefore per part, and the example is representative
rather than simplified. What remains, and is now a design instruction rather than a gap: because capacity
is global (section 6, item 1), coverage is a shared ledger across all orders, so the same OEM quantity
cannot be promised twice.

**"Recommended price" versus "No automatic final bid price."** These sit together in the brief. A
recommendation is a suggested number, and if it is derived automatically it is functionally an automatic
price with a softer name. The rule can hold only if the derivation is visible and the human edits it. The
boundary needs to be written down explicitly, or the "not to build" line is already broken on the first
screen.

**Four roles are named for what appears to be one person.** "Roles: owner or management, sales,
operations, finance", but the brief is written entirely in the third person singular — "he fulfils", "he
changes the bid" — and no headcount or duty split is given. "Approvals where the business needs them on
quotes, documents, orders and compliance items" and an audit trail of "what, who, when" both require that
those roles are real, distinct humans. If he is all four, approvals are a formality and the audit trail
names one person. Building an approval matrix for a single approver is process theatre, and it is a
process problem, not a software one.

**The delivery-risk flag depends on the least reliable input in the system.** Module 7 requires each step
to carry "an owner and an expected date", and risk is "expected completion against the committed deadline".
But those expected dates come from OEMs, whose communication already varies by "1 to 10 days". The flag
can only be as good as dates nobody has yet committed to. Making OEM dates a tracked, confirmed artefact
is a people-and-process precondition; the software merely exposes the gap.

**"Automatic follow-up tasks" sits close to a stated prohibition.** The brief wants automatic tasks, and
also says "No government-portal automation or auto-messaging as a baseline requirement". The line between
"a task appears in my own list" and "a message is sent on my behalf" must be drawn explicitly and held,
because the second is out of scope and the first is not.

**This cannot all ship together.** No time budget appears anywhere in the brief, so I cannot tell him what
fits. Without one, I can still say plainly what will not: modules 1 through 8 plus structured history,
plus a plain-language question interface, plus a working approval matrix, is not one release for a practice
of this size. The plain-language interface in particular ("Answer from the stored data, never invented")
cannot be delivered responsibly while the historical data is of unconfirmed quality — it would answer
confidently from bad records, which is worse than not answering.

---

## 5. Explicitly out of scope, and why

**Stated by him (taken as binding):**

- "No automatic legal or compliance judgement, and no automatic final bid price." — Liability and
  judgement sit with him; a wrong automated call on a government tender is not recoverable by an apology.
- "No OEM chosen without human approval." — Source selection is a relationship and accountability
  decision. The system may rank and shortlist only.
- "Not a full accounting or ERP replacement, and not a generic document generator." — Books and statutory
  filings stay elsewhere; documents are records and data-derived outputs.
- "No government-portal automation or auto-messaging as a baseline requirement." — No portal
  integration, no sending on his behalf. Internal reminders and tasks only.

**Added by me, with reasons:**

- **Plain-language question interface, in v1.** "Answer from the stored data, never invented" cannot be
  honoured over history of unconfirmed quality. Deferred until the history question is answered; the
  fixed morning view covers the same questions for now.
- **Any multi-level or matrix approval workflow.** No second approver has been demonstrated. Until the
  roles are shown to be distinct people, an approval is a single acknowledgement, not a chain.
- **Global OEM capacity ledger** — removed from this list. It was out of scope only until the capacity
  question was answered; he has now confirmed capacity is global (section 6, item 1), so a shared
  firm-commitment ledger is required, not optional.
- **Migration or analysis of existing spreadsheet history.** He asks which columns are "trustworthy
  enough to power quote comparison and win or loss analysis" — unanswered, so nothing historical is
  imported or relied on.
- **Anything that sends, posts, or acts outside the system.** Email, SMS, WhatsApp and portals are all
  out of the baseline.
- **Statutory GST, TDS and e-way-bill filing.** Money is tracked for visibility and reminders, not filed.
- **Mobile apps, offline mode, and analytics beyond the six named morning answers.** Not requested.

---

## 6. Open questions I must answer before building

Blocking — these change the schema or invalidate a module, so no work should start until they are answered.
Status after the third review: all five now have answers. Each carries a caveat or a derived detail, marked
below, and nothing has been closed by assumption — where a detail is still missing, it is named.

1. **Global or per-order capacity?** — ANSWERED: global. When OEM A can supply 1,000 and 700 is already
   committed to one order, the next order sees only 300. Requirement: available quantity for a part is the
   OEM's stated supply minus every firm commitment already made, across all orders. A commitment against
   one order reduces what every other order can draw. Derived question this answer creates, and it must be
   answered for availability to be correct: when a requirement is lost or cancelled, do its firm
   commitments release back into the shared pool?
2. **Who invoices whom, who pays the OEM, and when is commission earned?** — ANSWERED (direction); two
   details open. Confirmed flow: the OEM invoices the end client after PDI clearance; the end client pays
   the OEM; the OEM pays his company the agreed commission once commission is earned; his company never
   pays the OEM. This matches his written spec ("Commission invoice can only be raised after OEM payment
   milestone"; "OEM Name — OEM billed"; "client payments made to OEMs"). Still open: (a) what exactly the
   "OEM payment milestone" is — the client has paid the OEM, PDI cleared, or delivery accepted; and (b)
   whether the trading model in the sales register is a second revenue type alongside commission.
3. **Coverage unit: per line item or per requirement?** — ANSWERED: a real requirement is "one part".
   Coverage is per part, and in the common case a requirement carries a single part number. The model must
   still permit the largest case (item 5), but one-part requirements are the norm, not the exception.
4. **What makes a commitment "firm"?** — ANSWERED, one gap left. Proposed standard: "firm = signed OEM
   PO, written confirmation". Still to pin down: is either of those sufficient on its own, or are both
   required together? And is a verbal assurance explicitly excluded? This matters because only firm
   quantity draws down coverage, so the evidence standard is what stops the team over-committing.
5. **What is the largest requirement actually handled, in line items?** — ANSWERED: 25-30. The brief's
   "up to 500 part numbers" is therefore a hypothetical ceiling, not a real requirement, and must not
   drive interface work. Caveat to re-confirm: 25-30 is also the brief's monthly enquiry figure, so I read
   it as the largest line-item count seen, not the monthly volume restated.

Answerable in parallel, but needed before the relevant module is trusted:

6. **Which historical columns are trustworthy?** His own question; it gates quote comparison and
   win/loss analysis.
7. **Which documents consume the one week** — "generated from data, reused, obtained from the OEM, or
   prepared by hand"? Only the generated and reused portions are addressable by software.
8. **What are the real loss-reason labels he uses?** The proposed list is "a starting point".
9. **Are owner, sales, operations and finance distinct people?** If not, who approves what, and what
   does an approval actually change?
10. **What is the one legal entity and name the system should carry?** The brief names the client and
    nothing else; there is no brand or logo to build in.
11. **What does "won" mean concretely, and which event marks the commission milestone?** Both drive
    reporting and recognition timing.
12. **What are the per-step deadlines he wants chased?** "No response for seven days" is an example, not
    a rule, and "partly because it is never urgent" suggests no SLA exists to enforce yet.
13. **What is the time budget, and who else will use this day to day?** Neither appears in the brief, and
    both shape what is achievable at all.

---

## Revision note (2026-10-02)

A **leads** module was added at the client's request, **alongside** this brief rather than replacing it.

- The RFI/requirement remains the central record for fulfilment, and every rule in `DATA-MODEL.md` is
  unchanged. The coverage and capacity engine is untouched and still the main screen's purpose.
- A lead carries a name, a source (`call`, `whatsapp`, `referral`), a stage (`new`, `contacted`, `visited`,
  `negotiation`, `won`, `lost`) and a required follow-up date, with a due-today view for open leads whose
  follow-up is today or already past.
- This does not replace the requirement statuses in section 2, and the requirement submission-deadline due
  view still exists under the Requirements tab.
- The lead source list is deliberately separate from the enquiry-source values recorded in the client's own
  specification (GeM / client portal / direct / OEM). The two describe different things and must not be
  merged.
