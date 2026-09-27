# TECH-STACK.md

Derived from `PRD.md` (settled) and the fixed constraints for this build. Recommendations only, one per
layer. Deviations are named in the cell that deviates.

---

## Read this before the table

Four of your constraints cost the product something. Three of them cost it more than you may have
intended, and I would push back on two if they were mine to change. One of them helps.

**1. "No backend" turns the business's only record into a single copy in one browser profile.** The PRD
gives this system compliance documents with three-to-five-year renewal cycles, twenty to twenty-five
active orders and an audit trail. All of that will live in IndexedDB on one laptop. Browser storage is
cleared by "clear browsing data", by profile resets, by some antivirus tools, and by disk failure. There
is no server copy and no scheduled backup. That is the spreadsheet risk you are trying to remove,
reintroduced with a nicer interface. This stack mitigates it with a one-click export/import, but a
mitigation is a discipline the consultant must keep, not a guarantee. If durability matters as much as
the brief implies, the honest answer is that this needs either a backend or an operating-discipline
commitment that a one-person consultancy may not keep.

**2. "No auth" makes module 11 only half-buildable.** The PRD wants roles — "owner or management, sales,
operations, finance" — approvals, and an audit trail of "what, who, when". Without authentication, the
"who" is a name chosen at session start and can be changed freely; it is attribution by assertion, not by
identity. Approvals become a button that anyone can press, and "employee-wise performance" reporting is
meaningless. I will build the audit trail as an append-only log and the roles as declared-at-session, but
it should be described to the client as a record of intent, not a control. If approvals are meant to be a
control, this constraint is the wrong one to keep.

**3. "No deployment step" means every update and every backup is a manual file operation.** Deployment is
normally how fixes reach the user and how a copy leaves the machine. Without it, shipping a change means
copying a folder, and backing up means remembering to export. Combine this with point 1 and the risk is
the same risk wearing a different hat.

**4. "Usable when every AI provider is rate limited or down" is the best constraint in the list.** It
forbids the one thing the PRD explicitly rules out — an answer that is "invented" — by removing the
mechanism that invents. The plain-language questions will be answered by deterministic queries over
stored rows, so a wrong answer can only mean a wrong query, never a hallucination. I would keep this
constraint even if you relaxed it.

---

## The table

| LAYER | CHOICE | THE CONSTRAINT THAT FORCED IT |
|---|---|---|
| Runtime and install | Node.js 20 LTS, version pinned in `.nvmrc` and `engines`; npm, committed `package-lock.json`; install once, then never at runtime | Hotel wifi and offline use: the app must run with zero network after setup. Rejected pnpm and yarn — one more global install to perform on whatever wifi is available. |
| Language | TypeScript with `strict: true` | Built by an agent from a written brief, then handed to a junior: the compiler is the only reviewer that never gets tired. Rejected plain JavaScript — silent shape errors across eleven modules. |
| View framework | React 18 | Agent-correctness and junior maintainability: React has the largest corpus of correct examples for an agent to imitate. Rejected Preact — smaller bytes, but the agent gets React right more often. |
| Build and serve | Vite, run as `vite dev` and `vite preview` on localhost | Runs on localhost with no deployment step: Vite serves locally and also builds to plain static files. Rejected webpack (configuration surface an agent will get wrong) and Next.js (server features and deployment conventions this project forbids). |
| Serving model | A local HTTP server on localhost, never `file://` | IndexedDB needs a real origin; `file://` origins are unreliable in browsers, so localhost is a technical requirement, not a preference. Rejected Electron and Tauri — both add the packaging step you excluded. |
| Routing | Hash-based routing in one small internal hook, no dependency | A fixed set of module views and no backend: a router library buys nothing but an upgrade obligation. Rejected React Router — a dependency for a list of fewer than fifteen views. |
| Persistence | IndexedDB through Dexie | Global capacity ledger and partial balances need real transactions and exact indexed queries, and data must survive reloads and restarts. Rejected `localStorage` (no transactions, roughly 5 MB, no binary blobs) and rejected SQLite-in-the-browser via sql.js or wa-sqlite (WASM fetch, manual persistence, heavier than the job). Close call against the raw `idb` wrapper — chosen Dexie for its versioned schema and live queries, which would otherwise be hand-built and hand-broken. |
| Schema and migrations | Dexie's `version()` chain, every migration declared in code | Handed to a junior and an agent: schema changes must be visible in one place rather than inferred from the data. |
| Validation | Zod schemas, one per entity, enforced before any write | AGENTS.md section 3: an invalid record must save nothing and say why. Rejected hand-written guards — eleven modules of ad-hoc checks is exactly where the pilot's empty-record bug comes back. |
| Money | Integers in the smallest unit (paise) with one stated rounding rule; no floating-point arithmetic | Partial payments and percentage commission must reconcile exactly; the PRD makes both normal. Rejected decimal.js — a dependency for sums that are rounded once at a defined boundary. |
| Dates | ISO `YYYY-MM-DD` strings plus one small internal date utility | Expiry tracking, three-to-five-year renewals, due dates and "days overdue" are all day-granular. Rejected moment (legacy and heavy) and Luxon and date-fns — timezone machinery this problem does not use. |
| Documents | Files stored as `Blob` in IndexedDB, previewed through object URLs | The compliance vault must work with no backend, no cloud and no network. Rejected cloud or shared-drive storage — it needs network and credentials the constraints forbid. |
| Backup and restore | One-click export and import of a single zip (`fflate`) containing `data.json` plus the documents folder | Point 1 above: the record is the only copy and browser storage can vanish. `fflate` is tiny and has no dependencies of its own. |
| Plain-language questions | A local deterministic intent parser over a fixed question set, mapping to parameterised IndexedDB queries; no model call | Must stay usable when every AI provider is rate limited or down, must answer "from the stored data, never invented", and AGENTS.md section 8 forbids keys in the browser. Rejected any hosted LLM SDK and any in-browser model. |
| Reminders and follow-ups | In-app task rows recomputed from due dates on load; no scheduler and no sending | The PRD requires automatic follow-up tasks but forbids "auto-messaging as a baseline"; the laptop is offline. Rejected SMTP, SendGrid, Twilio, WhatsApp Cloud API and any portal integration. |
| Styling and layout | Plain CSS with custom-property design tokens, one stylesheet per view module | No brand kit was supplied (PRD open question 10), so a single direction has to be fixed and held; and AGENTS.md section 3c requires a one-column 375 px layout with 44 px tap targets. Rejected Tailwind (an extra build dependency and verbose markup) and rejected MUI, Ant Design and Bootstrap (weight and a look the brief did not ask for). |
| Tables and lists | Semantic `<table>` with CSS; no grid or spreadsheet component | The PRD confirms the largest requirement is 25-30 line items, so virtualisation is unnecessary. Rejected AG Grid, Handsontable and TanStack Table — weight and licensing for rows that fit on one screen. |
| Typography and icons | Locally bundled `woff2` fonts and inline SVG icons | Hotel wifi: no CDN fonts, icon fonts or remote scripts may be required at runtime. |
| Testing | Vitest with `fake-indexeddb`, covering the logic only — coverage ledger, partial balances, commission, validation, the question parser | Built by an agent and handed to a junior: the balance and coverage rules are the highest-risk code and must run without a browser. |
| Quality gates | `tsc --noEmit`, ESLint with the React Hooks rules, Prettier, all offline | Agent-written code must pass gates it cannot negotiate past; "should work" is not an allowed report. |
| Browser target | Latest Chromium or Firefox on the consultant's laptop; responsive down to 375 px | A laptop that may be on hotel wifi; no mobile app was requested. Rejected service workers and PWA install plumbing — the app is served from localhost and needs no network. |

---

## HARD EXCLUSIONS

An agent left to choose reaches for the popular option. Each of these is popular and each is forbidden
here, with the reason.

- **No server of any kind** — no Express, no Fastify, no Node API routes, no serverless functions. Forced
  by "no backend".
- **No cloud database** — Firebase, Supabase, MongoDB Atlas, hosted Postgres. Forced by "no database
  server" and hotel wifi.
- **No cloud file storage** — S3, Google Drive API, Dropbox. Forced by "no backend" and offline use.
- **No auth provider** — Auth0, Clerk, Firebase Auth, Supabase Auth. Forced by "no auth". Consequence
  accepted: audit attribution is self-declared (see point 2 above).
- **No secrets or API keys anywhere in the bundle.** AGENTS.md section 8; also impossible to protect with
  no backend.
- **No hosted model SDK** — OpenAI, Anthropic, Google, OpenRouter clients in the browser. Forced by the
  offline requirement and by key exposure.
- **No in-browser model** — llama.cpp WASM, web-llm, transformers.js, ONNX runtime. Too heavy for the job,
  and unmaintainable by the person this is handed to.
- **No service worker, no PWA install, no offline cache layer.** The app is served from localhost; a cache
  layer only adds stale-version bugs.
- **No `localStorage` or `sessionStorage` for entity data.** Size limits, no transactions, no binary
  storage.
- **No second persistence library beside Dexie.** One storage path, or the two will disagree.
- **No SQLite in the browser** — sql.js, wa-sqlite, absurd-sql, OPFS-backed SQLite. WASM weight and manual
  persistence for a dataset that fits comfortably in IndexedDB.
- **No ORM or SQL query builder.** IndexedDB is not SQL; Dexie is the query layer.
- **No CSS framework or component kit** — Tailwind, Bootstrap, MUI, Ant Design, Chakra. Weights the page,
  imposes a designed look, and contradicts the "one strong direction" the missing brand kit forces.
- **No data-grid or spreadsheet component** — AG Grid, Handsontable, DataTables, TanStack Table. The real
  maximum is 25-30 rows, and some carry licences that will not suit this client.
- **No charting library** — Chart.js, Recharts, D3, ECharts. The six morning answers are counts and lists.
- **No form library** — react-hook-form, Formik, Final Form. Zod plus native inputs covers these forms.
- **No state-management library** — Redux, MobX, Recoil, Jotai, Zustand. Dexie live queries plus React
  context are one source of truth; a second store is a second truth.
- **No date library** — moment, Luxon, date-fns, Day.js. Dates here are day-granular ISO strings.
- **No floating-point money.** Balances and commission must reconcile to the paise.
- **No PDF authoring library** — jsPDF, pdfmake, PDFKit. Generated quotes and POs use the browser's own
  print-to-PDF with a print stylesheet, and the PRD forbids being a general document generator.
- **No spreadsheet import/export** — SheetJS, exceljs, xlsx. The PRD leaves the trustworthiness of the
  historical columns unanswered, so no migration is built and no such dependency is added.
- **No CDN at runtime** — fonts, icon fonts, scripts, styles. Hotel wifi must not be able to break the UI.
- **No file-routing or SSR framework** — Next.js, Remix, SvelteKit, Astro. Server and deployment
  conventions this project explicitly excludes.
- **No desktop packaging** — Electron, Tauri, Neutralino. It is a deployment step by another name.
- **No messaging or portal integrations** — SMTP, SendGrid, Twilio, WhatsApp Cloud API, GeM portal
  automation. The PRD rules these out as a baseline requirement.
- **No analytics, telemetry or crash-reporting SDK.** Offline, and business data must not leave the laptop.

---

## Dependency flags

- **Weight accepted deliberately:** React (heavier than Preact), Dexie (heavier than raw `idb`), Zod
  (heavier than hand-written guards). Each buys a specific correctness property named in its row.
- **`fflate`** is small and dependency-free; it exists only so a backup is one file.
- **Touch support:** no chosen dependency has its own touch behaviour. The libraries known for poor touch
  handling on a laptop — desktop-oriented grids and hover-dependent UI kits — are already excluded above.
- **Maintenance status not verified.** I could not check live package maintenance in this offline
  environment, so that claim is UNVERIFIED. Before any install, confirm that Dexie, `fflate` and Zod have
  current releases and pin exact versions in `package-lock.json`. If any of the three is stale, the
  fallbacks in order are: raw `idb` for Dexie, `pako` for `fflate`, and hand-written guards for Zod.
