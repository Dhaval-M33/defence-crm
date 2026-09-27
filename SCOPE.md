# SCOPE.md

What ships in one session, what does not, and the exact words for the parts that do not. Sits on top of
`PRD.md`, `TECH-STACK.md` and `IMPLEMENTATION-PLAN.md`.

---

## The line, and why it is there

**SHIPS NOW is the spine plus modules 1 to 3 of `PRD.md` — requirement and line items, OEM master and
sourcing, and quantity coverage.** Nothing else.

That is a small release, and it is the right small release for one session for four reasons:

1. `PRD.md` itself says "the first three are the ones that matter most". I am not inventing a priority; I
   am taking the client's.
2. It delivers the only thing on the list that no spreadsheet can do — the firm-versus-indication
   distinction and the global coverage ledger. That is the client's own "hard part", and it is the one
   that prevents him committing to quantity he does not hold. Everything else is a nicer version of
   something he already has.
3. The spine underneath it — validation, audit, backup — is invisible and therefore always the first
   thing cut by an over-optimistic plan. It is not cuttable here, because without it the visible screens
   are a spreadsheet with a login page's worth of trust.
4. Everything in PHASE TWO either needs months of data that will not exist on day one (search, dashboard,
   loss analysis), needs an account or a waiting period I do not have today (sending, cloud), or needs an
   answer the client has not given (the commission milestone).

**What this build does not do, stated plainly:** it does not save him the hours he complained about. The
"3 to 4 hours a day" of follow-ups, the "about 1 week" of documents and the "3 to 4 days" of quote prep
are all in PHASE TWO, because follow-ups need a submitted quote, and quote prep needs the history that
only exists once quotes have been recorded. If he hears "CRM" and expects his afternoons back, he will be
disappointed, and the sentence below says so. What this build fixes is the record and the quantity risk —
not the hours.

---

## SHIPS NOW

*(done) is written so that we can disagree about whether it is finished, rather than agree because it is
vague.*

**1. The spine: local storage, validation, audit, backup.**
- *Done means:* create a record, close the browser completely, reopen it, and every field is identical.
  Every write appears in an audit log with the actor's declared name and a timestamp. Export produces one
  file; wiping storage and importing that file restores every record **and every attached document,
  byte-identical**. An invalid record is refused with a named missing field and nothing is saved.
- *Why it is not cuttable:* it is the difference between a tool and a demo.

**2. Requirement and RFI with line items.**
- *Done means:* capture customer, product, quantity, required delivery date, technical specification,
  tender or enquiry reference and submission deadline; add, edit and remove line items; attach files to
  the requirement; reload and find all of it. Adding a requirement with no customer is refused with a
  reason. One part per requirement is the expected case; the ceiling is the real one he quoted, 25-30,
  and the screen is built for that, not for 500.

**3. Masters: customer or agency, OEM, product or part.**
- *Done means:* create and edit all three; the OEM carries an approved-or-not flag; a requirement selects
  its customer and line items select a part from the master rather than free text; deleting a master that
  is referenced by a requirement is refused with a reason.

**4. OEM sourcing with firm versus indication.**
- *Done means:* from a requirement, record shortlisted OEMs, each request, and each response; every
  response carries a quantity and a type of **firm** or **indication**, where firm is only a signed OEM PO
  or written confirmation. The two types are structurally different records, not a label, and the screen
  shows which is which without legend-hunting.

**5. Coverage and the global capacity ledger.**
- *Done means:* with 1,000 required, OEM A firm 600 and OEM B firm 400, coverage reads 1,000 and
  uncovered 0. A 400 indication does **not** reduce uncovered. A second requirement for the same part
  sees availability reduced by the first requirement's firm commitments. Cancelling the first requirement
  releases those commitments and availability returns. At no point does the screen show a quantity as
  covered when only indications exist behind it.

---

## PHASE TWO — cut, with the sentence to say

Each cut names what the client loses and the words to use. No euphemisms.

**Quotations and bid intelligence (`PRD.md` module 4).**
- *He loses:* the thing he does about twenty times a month, and the past-bid history that is supposed to
  change his price.
- *Say:* "There is no quoting in this build. You will keep preparing quotes the way you do now. What
  changes is that the requirement, the OEM responses and the quantity coverage sit in one record instead
  of a spreadsheet — and that record is what quoting will be built on next."

**Government response and follow-up (`PRD.md` module 5).**
- *He loses:* the automatic follow-up that was meant to give back 3 to 4 hours a day.
- *Say:* "Follow-ups are not automated yet. You will keep chasing by email and memory. The reminders need
  a submitted quote to chase, and quoting is not in this build."

**Order and PO (`PRD.md` module 6).**
- *He loses:* raising a PO from the system and carrying the quote history into it.
- *Say:* "You cannot raise a PO from this build. Orders stay where they are for now. The system stops at
  the point a requirement is covered."

**Fulfilment, PDI and delivery risk (`PRD.md` module 7).**
- *He loses:* the timeline from OEM PO to acceptance, the PDI quantities, and the early delivery-risk
  flag.
- *Say:* "There is no delivery timeline, no PDI quantities and no delivery-risk warning yet. You will
  still find out where an order is the way you do today."

**Invoices, payments and commission (`PRD.md` module 8, money half).**
- *He loses:* partial payment tracking and the commission ledger.
- *Say:* "There is no invoice, payment or commission tracking. Commission cannot be built until you tell
  me exactly what event counts as the OEM-payment milestone — when the client has paid the OEM, when PDI
  is cleared, or when delivery is accepted. I am not going to guess a date that decides when you get
  paid."

**Document vault with expiry and renewal reminders (`PRD.md` module 8, document half).**
- *He loses:* the three-to-five-year renewal watch that he specifically described.
- *Say:* "You can attach a document to a requirement or an OEM and get it back, and it travels with your
  backup. There are no expiry dates and no renewal reminders yet, so the three-to-five-year watch is not
  built."

**Search, history and loss analysis (`PRD.md` module 9).**
- *He loses:* searching all history for a comparable requirement, and the structured loss reasons.
- *Say:* "There is no search across history and no loss analysis. In week one there is not enough recorded
  history for it to tell you anything you do not already know."

**Dashboard and plain-language questions (`PRD.md` module 10).**
- *He loses:* the morning view and the question box.
- *Say:* "There is no morning dashboard and no plain-language question box in this build. You get the
  sourcing and coverage screens, not a summary of them."

**Roles, approvals and the audit viewer (`PRD.md` module 11).**
- *He loses:* approval gates on quotes, orders, documents and compliance items, and a screen to read the
  audit log.
- *Say:* "Every change is logged from the first day and you can see it on the record itself. But there are
  no user roles and no approval gates, because with no login an approval is a ticket anyone can stamp —
  and I would rather not build you a control that cannot be trusted."

**Sending anything, anywhere — email, WhatsApp, SMS, government portals.**
- *He loses:* nothing he was promised as a baseline; `PRD.md` rules all of it out and it needs verified
  sender domains and provider accounts I do not have today.
- *Say:* "Nothing in this build sends anything, on purpose. No email, no WhatsApp, no portal. And there is
  no send button anywhere in the interface, so nothing can look like it might have been sent."

**Charts and analytics.**
- *He loses:* nothing he asked for.
- *Say:* "There are no charts. You asked for counts and lists, and that is what you get."

**The trading or margin model.**
- *He loses:* nothing yet — it is unconfirmed.
- *Say:* "Only a commission model is on the table. If some of your orders are trades where you buy from
  the OEM and resell, tell me and I will scope it separately — I am not going to build both on a guess."

**Cloud sync and second devices.**
- *He loses:* opening the same data on another laptop.
- *Say:* "The data lives on this laptop only. If you work from a second machine you will not see it there,
  and the only way to move it is the backup file."

**Automatic or scheduled backup.**
- *He loses:* protection against simply forgetting.
- *Say:* "Backup is a button you press, not something that happens by itself. Nothing leaves this laptop
  unless you export it, and if the browser's storage is cleared before you do, that data is gone."

---

## The honest half, and no coming-soon buttons

Where a feature is partly deliverable, this build ships the part that is true and omits the part that is
not. It never ships a stub dressed as a feature.

- **Attachments rather than a vault:** you can attach and retrieve a document. You cannot set an expiry,
  because there is no reminder engine to honour it. There is no "add expiry" field that saves and does
  nothing.
- **Coverage rather than OEM selection:** the build shows coverage and flags what is uncovered. It does
  not rank or select an OEM, and there is no "recommended OEM" control, because `PRD.md` forbids choosing
  an OEM without human approval and there is no approval step in this build.
- **Listing the audit log rather than a viewer:** each record shows its own change history. There is no
  separate audit section with date filters, and no disabled "coming soon" placeholder where one would go.
- **Standing rule for the whole interface:** if a capability is not in this build, its control does not
  exist. No greyed-out buttons, no "coming soon" labels, no inert toggles. A control that does nothing is
  worse than an absent one, because someone will eventually assume it fired.

---

## If the session runs short

The line moves in this order, and I will say so rather than quietly ship less:

1. Drop the per-record audit history screen. The audit log keeps being written and still leaves with the
   backup; only the on-screen list goes.
2. Drop requirement attachments. They return in phase two with the vault.
3. Reduce sourcing to two OEM responses per requirement.

**What never drops, even if the session ends early:** the validation gateway, the backup export and
import, and the firm-versus-indication distinction in coverage. If those are not finished, there is no
honest release to show, and I would rather show a smaller product than a demo that cannot be trusted with
a quantity.

---

## The one thing I need from the client before phase two

The exact event that counts as the **OEM-payment milestone**. It decides when commission is recognised,
it is the single most expensive thing to guess, and it is currently undefined in every document and every
spreadsheet. Phase two's money half cannot start without it.
