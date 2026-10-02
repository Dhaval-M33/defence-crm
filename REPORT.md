# REPORT — Vercel redeploy (27 Sep 2026)

> Correction (27 Sep 2026, ~14:53 IST): both Vercel projects (`defence-crm` and `defence-crm-vcwb`)
> were deleted after this deploy. Anonymous `Invoke-WebRequest` now returns `410 Gone` for the
> immutable deployment URL and `404 Not Found` for both production aliases; `vercel ls defence-crm`
> returns `project_not_found`; `vercel project ls` lists only `launchx-website` and
> `launch-follow-up-board`. There is currently NO live deployment. The deletion was not done in this
> session. Everything below describes the state before the deletion.

## Status per part

Redeploy `defence-crm` to Vercel production: DONE
  evidence: `npx vercel --prod --yes --scope test-website7` (workdir `D:\Defence CRM\app`) printed
  `✓ Ready in 18s` and `Aliased https://defence-crm-green.vercel.app`.
  `npx vercel inspect https://defence-60ubk4zyy-test-website7.vercel.app --json` printed
  `id dpl_FErtwzQpqTccb1P9uyxXLHDrVSpR`, `readyState READY`, `target production`,
  `aliases defence-crm-green.vercel.app, defence-crm-test-website7.vercel.app`.

Build correctness of the deployed bundle: DONE
  evidence: local `npm run build` (workdir `D:\Defence CRM\app`) printed
  `dist/assets/index-CkQnRUQI.js 444.78 kB`. The live deployment served through protection by
  `npx vercel curl https://defence-crm-test-website7.vercel.app/ --scope test-website7` contains
  `<title>Requirement coverage</title>` and the asset path `/assets/index-CkQnRUQI.js` — the same hash.

Git-triggered auto-deploy from GitHub: BLOCKED
  evidence: `npx vercel inspect https://defence-cuv4cmy81-test-website7.vercel.app` printed
  `status ● Blocked` and
  `reason The deployment was blocked because the commit author doesn't have permission to create deployments for this project.`
  `GET https://api.vercel.com/v9/projects?teamId=team_hkZqMUYeSx1oX1xncEf2XbXy` printed
  `gitForkProtection=True` for both `defence-crm` and `defence-crm-vcwb`.
  `git log --format='%h | %an <%ae>'` prints `APJ-Gurukul <apjgurukul@gmail.com>` for all three commits;
  the Vercel team user is `digitalmagictools-8678`. Making the repo public does not change this.

Public access to the deployed app: BLOCKED (security guard, deliberately not changed)
  evidence: anonymous `Invoke-WebRequest https://defence-crm-test-website7.vercel.app/` returned
  `200`, header `X-Matched-Path: /login`, title `Login – Vercel`.
  Project setting from the API: `ssoProtection={"deploymentType":"all_except_custom_domains"}`.

## What broke and how I fixed it

- The assumption was that a private repo was blocking the deploy. It was not. The blocked git deploys
  are a permission check: Vercel's `gitForkProtection` refuses a commit whose author is not a member
  of the team that owns the project. The commit author (`apjgurukul@gmail.com`) is not a member of
  team `test-website7`.
- The "Ready" deployments from before were empty: their build log shows
  `Running "vercel build"` then `Build Completed in /vercel/output [74ms]` at commit `779dd53`, before
  the root `vercel.json` existed. They served no app.
- I produced a working deployment without touching either guard, by deploying from this machine as the
  authenticated team owner (`digitalmagictools-8678`). A CLI deploy has no blocked git author, so fork
  protection does not apply, and the build ran the real command
  `tsc -b && vite build` and became READY.
- The app is now correctly built and serves on production, but every `*.vercel.app` URL still shows the
  Vercel login page because `ssoProtection` is set to protect all deployments except custom domains.

## Claims ledger

| Claim | Command that proves it | Result |
|---|---|---|
| A new production deployment exists and is READY | `npx vercel inspect https://defence-60ubk4zyy-test-website7.vercel.app --json` | READY, dpl_FErtwzQpqTccb1P9uyxXLHDrVSpR |
| It holds the production aliases | same inspect, `aliases` field | `defence-crm-green.vercel.app, defence-crm-test-website7.vercel.app` |
| The deployed bundle is the same build as local | `npx vercel curl https://defence-crm-test-website7.vercel.app/ --scope test-website7` | title `Requirement coverage`, `/assets/index-CkQnRUQI.js` |
| The public URL is login-walled | anonymous `Invoke-WebRequest https://defence-crm-test-website7.vercel.app/` | `200`, `X-Matched-Path: /login` |
| Git deploys are blocked, not the repo visibility | `npx vercel inspect https://defence-cuv4cmy81-test-website7.vercel.app` | `Blocked`, commit-author permission reason |
| No client spreadsheets were uploaded | deploy ran from `app/`; upload was 606.5 KB / 45 files | `Ram Prasad Assets/` is outside `app/` |
| `defence-crm-vcwb` still serves the empty build | `npx vercel ls defence-crm-vcwb` | newest READY is the old 2s deployment; left alone |
| The site is publicly viewable | — | UNVERIFIED: it is not; the login wall blocks it |

## What I would tell the next person

Two separate dashboard settings must change before this is a normal, shareable site. Neither is repo
visibility, and I did not change either (AGENTS.md section 6 forbids touching security guards):

1. Project `defence-crm` → Settings → Git → turn off **Fork Protection** (or add the GitHub account
   behind `apjgurukul@gmail.com` to team `test-website7`). Until then every push auto-deploy is Blocked.
2. Project `defence-crm` → Settings → Deployment Protection → **Vercel Authentication**. It is set to
   protect all deployments except custom domains, so the `*.vercel.app` URL always shows the Vercel
   login. Set it to protect Preview only, or attach a custom domain, to make the app public.

`defence-crm-vcwb` is a duplicate of the same GitHub repo. Decide which one is real and delete the
other, or both will keep deploying the same code to two production URLs.

Working tree changed by `vercel link`: `app/.gitignore` was modified (added `.vercel`, `.env*`),
`app/.vercelignore` is new, and `app/.env.local` (holding `VERCEL_OIDC_TOKEN`) plus `app/.vercel/` are
gitignored. None of this is committed.
