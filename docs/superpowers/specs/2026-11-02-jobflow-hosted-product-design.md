# JobFlow As A Hosted Product

Status: approved by the owner on 2026-11-02.

## Intent

The owner used the open-source Career Ops CLI and found it good at finding
jobs. JobFlow turns that experience into a mobile app that **anyone can
install and use**, with no desktop setup:

- the user sets up once: uploads a CV and states what job they want
  (role, salary, remote/on-site, country, keywords);
- the system finds matching jobs on its own, so the user never types a job
  search and never has to read every job description;
- AI scoring of a job against the CV is the paid upgrade that improves
  matching.

The app stops at "here are the jobs that fit you, and why". Applying and
everything after it is the user's decision. The app never applies for them.

This replaces the earlier "local-first" model, where the phone talked to a
wrapper on the owner's own desktop. That model cannot serve other people.

## Goals

- Install-and-use Android app for any occupation and any market, with no
  gating by job type. Quality improves over time as job sources and scoring
  rubrics are added.
- A backend that is reliable, easy to scale, and easy to repair or replace
  piece by piece. Choosing a cloud must only be a question of money.
- Not tied to one AI vendor. Use whichever is cheap and good, and switch by
  configuration.
- Paid features sold through Google Play Billing.

## Non-goals (for now)

- Pricing, marketing and target-segment strategy (owner: a business
  question, decided later).
- Choosing a cloud provider (later; the design must run on any).
- iOS.
- Auto-applying to jobs, or any feature that sends applications or messages
  for the user.
- Most Career Ops modes (see [Scope](#scope-of-the-first-release)).

## Anti-goals (would make this a failure even if it works)

- **Paying AI bills for strangers.** Any path where someone can trigger AI
  calls without a verified entitlement or a free-trial quota.
- **Leaking CVs.** A CV readable in a database dump, a log line, or an AI
  provider's training data.
- **Vendor lock-in by accident.** Firebase, a cloud or an AI vendor reachable
  from core business code instead of through an adapter.
- **Scraping sources that forbid it** (for example LinkedIn). In a hosted
  product the operator, not the user, carries that liability.
- **Using the owner's AI subscription to serve real users.** Subscription
  CLIs are for development only.
- **Using "career-ops" in the product's name, store listing or branding.**
  "Works with career-ops" or "based on career-ops" with attribution is fine
  (see Career Ops `TRADEMARK.md`).

## Users

Anyone looking for a job, any occupation, any country. The first users will
probably be technical people, because Career Ops's job sources and default
scoring rubric lean toward tech today. That is an observation, not a gate.

## Scope of the first release

Career Ops has about 20 modes. The first release ships the core loop only.

| Career Ops mode | In the app | Release |
| --- | --- | --- |
| `interview` (onboarding) | Setup: upload the CV, state preferences | first |
| `scan` | Feed of new jobs; the server scans on a schedule | first |
| `oferta` (A–G evaluation) | AI score and report for one job | first (paid) |
| `tracker` | Mark a job applied / interview / rejected / skipped | first |
| `pipeline` (URL inbox) | Android **Share → JobFlow** on any job page, then evaluate | next |
| `followup` | Push reminder to follow up after applying | next |
| `ofertas` | Compare two or three jobs | next |
| `pdf`, `cover`, `interview-prep`, `deep` | Tailored CV PDF, cover letter, interview prep, company research | later (paid) |
| `patterns` | Why applications get rejected | later |
| `batch`, `auto-pipeline` | Server internals, not user features | n/a |
| `apply`, `contacto`, `latex`, `update`, `project`, `training` | Not in the app (desktop-only, out of scope, or against platform terms) | never |

## How it works (user's view)

1. **First open.** The user can look around without signing in (Firebase
   anonymous auth). They upload a CV and set preferences.
2. **Sign in** with Google when they want to sync or buy. The anonymous
   account is linked, so nothing is lost. Apple sign-in is supported by the
   backend but not required on Android; ship it with iOS.
3. **Feed.** The server scans job sources on a schedule and matches new jobs
   against each user's preferences. When there are new matches, the user
   gets a push ("3 new jobs match you"). Opening the app shows them, newest
   and best first.
4. **Evaluate.** The user taps Evaluate on a job and goes on with other
   things. A progress notification shows the real steps (fetching the job,
   analyzing, writing the report). On Android 16+ it is a Live Update. When
   it is done, a tap opens the score and report.
5. **Track.** The user marks jobs applied, interviewing, rejected or
   skipped. This syncs across devices.

## Architecture

### Principles

- **Ports and adapters.** The core (matching, scoring, entitlement, quota)
  depends only on interfaces. Every external system sits behind a port:
  `AuthVerifier`, `LlmProvider`, `JobSource`, `BlobStore`, `KeyManager`,
  `PushSender`, `PurchaseVerifier`, `IntegrityVerifier`. Replacing a vendor
  means writing one adapter.
- **Stateless API, work in a queue.** HTTP handlers answer fast. Scans and
  AI evaluations are jobs in a queue, with retries, timeouts and
  idempotency, run by workers that scale separately.
- **One container image, configured by environment.** It runs on a $5 VPS,
  Cloud Run or Kubernetes without code changes. It has a health endpoint,
  structured logs with redaction, and metrics.
- **Contract first.** The OpenAPI contract and examples are the boundary with
  Android, as today. A mock server built from the examples lets Android
  work before the backend is done.

### Components

```
Android app ──HTTPS + Firebase ID token + Play Integrity──► API service
                                                              │
                         ┌────────────────────────────────────┼─────────────────────┐
                         ▼                                    ▼                     ▼
                   PostgreSQL ◄──── queue (pg-boss) ────► Workers:          Object storage
                   (users, prefs,                          - scan scheduler   (S3 API; CV
                   jobs index, matches,                    - matcher          originals,
                   evaluations, tracker,                   - evaluator        encrypted)
                   entitlements, quota)                    - notifier
                                                              │
                                     ┌────────────────────────┼──────────────────┐
                                     ▼                        ▼                  ▼
                               Job sources               LLM providers         FCM
                           (ATS APIs, job boards)    (Gemini/OpenAI/Claude…)
```

- **API service:** auth, preferences, CV import, feed, evaluations, tracker,
  entitlement, account deletion.
- **Job index (shared by all users):** each job is scanned once, whoever it
  matches. Fields: source, external id, URL, company, title, location,
  remote policy, accepted countries or timezones when stated, salary when
  stated, description text, first and last seen, closed. A job that drops
  off its source is marked closed.
- **Scan scheduler:** runs each source on its own interval. It uses the
  Career Ops providers (Greenhouse, Lever, Ashby, Workable, Workday,
  SmartRecruiters, Recruitee, RemoteOK, Remotive, WorkingNomads, Glints,
  JobStreet, Arbeitsagentur, SolidJobs…) through a `JobSource` port. Users
  can add a company careers page; the provider is detected from the URL and
  the company joins the shared index.
- **Matcher (per user):**
  - Stage 1, first release: hard filters from preferences (keywords in and
    out, location and remote, accepted countries, salary when stated,
    seniority). Cheap SQL.
  - Stage 2, next release: rank by similarity between the job and a CV
    profile vector (`pgvector`).
  - Stage 3: the AI evaluation, on demand (paid), and later scheduled for the
    top few (paid).
- **Evaluator:** builds the prompt (rubric + CV + job), calls the
  `LlmProvider`, validates the JSON against a schema, stores the result, and
  pushes stage updates.
- **Notifier:** sends FCM messages for new matches, evaluation progress and
  reminders.

### Data the server keeps

| Data | Where | Protection |
| --- | --- | --- |
| User (Firebase uid, created, linked, deleted, merged into) | PostgreSQL | no email or name stored unless needed for support |
| Preferences, tracker states, FCM tokens | PostgreSQL | per-user rows |
| CV text (Markdown) | PostgreSQL, encrypted column | envelope encryption, per-user data key wrapped by a KMS key |
| CV original file (PDF/DOCX) | object storage | encrypted with the same per-user key |
| CV profile without personal data (skills, years, titles) and its vector | PostgreSQL | not encrypted; contains no direct identifiers |
| Evaluations (score, report) | PostgreSQL | per-user; deleted with the account |
| Entitlements, purchase tokens, quota counters | PostgreSQL | verified with Google |
| Job index | PostgreSQL | public data |

Deleting the account deletes all of the user's rows, the object-storage
files and the user's data key. Only a uid-only deletion record may remain, if
the backup restore needs it (see [Security baseline](#security-baseline)). Logs
never contain CV text, prompts or AI output.

## CV handling

- **Import.** The app uploads the file to the API (5 MiB cap). The server
  extracts text (a `pdftotext`/Tika-class extractor; for scanned images, an
  LLM that reads images, or a "please use a text PDF" message in the first
  release), optionally asks the LLM to restructure it as Markdown in Career
  Ops's `cv.md` shape, and returns it for the user to review and edit. The
  text and the original are then stored encrypted.
- **Personal data removal before AI.** Before any prompt leaves the server,
  name, email, phone, street address and links that identify the person are
  replaced with placeholders. The AI needs skills and experience, not
  identity.
- **Profile.** A personal-data-free summary (skills, years, titles, domains)
  and its embedding are derived after import and on every edit, for
  matching.
- **The app keeps a local copy** (Room/app-private storage) for offline
  viewing.

## AI providers

- `LlmProvider` port: prompt in, schema-valid JSON out, with token usage and
  cost reported.
- Production adapters use API keys (Gemini, OpenAI, Anthropic, Moonshot/Kimi,
  xAI). The one to use is chosen by configuration, per task if needed (for
  example a cheap model for CV restructuring, a better one for evaluation).
- **Development adapters:** the existing `claude -p` adapter (tool-less, from
  issue #3) and a Gemini CLI adapter, using the owner's subscriptions.
  **They refuse to start when the environment is production.** A provider's
  free API tier is also fine for development, with synthetic CVs only,
  because free-tier data may be used for training.
- **Evaluation set:** a few dozen synthetic CV and job pairs with expected
  scores, run whenever a model or prompt changes, to compare quality and
  cost with numbers.
- Production providers must have terms that exclude API data from training.

## Accounts, payment and abuse protection

- **Firebase Auth** (anonymous first, then Google; Apple later). The backend
  verifies ID tokens behind `AuthVerifier`, so another OIDC provider can
  replace Firebase.
- **Guests.** The app starts one guest per install: reinstalling is the only way to get another. This is a product rule,
  not abuse protection. Firebase's automatic clean-up of anonymous accounts stays off, because it goes by account age and
  would delete a guest who is still active. The backend removes guests by last activity instead.
- **Sign-in API.** Firebase signs in and links on the device; the app never sends
  a Google ID token. Then, each with a Firebase ID token as Bearer and none public:
  - `POST /auth/guest` needs an anonymous token and returns the account. Limits on
    guests belong here later.
  - `POST /auth/sso`, with an optional `guestToken`, needs a token that is not
    anonymous. The account comes only from the Bearer token. A valid anonymous
    `guestToken` of another, unmerged user has its data moved in one transaction,
    and that guest closes, so its token gets 401. A guest the server never saw has no
    data, so nothing happens to it and its token works until it expires. An expired or invalid
    `guestToken` never fails the sign-in: `guestMerged` is false. One that cannot be
    checked because of an outage gets a 503 the app retries, so it does not give up on
    the guest's data. Rules per table:
    preferences keep the member's and the guest's only fill gaps; tracker entries
    combine and the newer wins for the same job; a CV moves only if the member has
    none, encrypted again with the member's key; the guest's FCM tokens are dropped.
  - `POST /auth/logout` removes the caller's device row and FCM token for one
    `installationId`. It revokes no token, because that would sign out every device.

  Firebase and the backend share no transaction, so the calls are idempotent. A
  sign-in counts only once both have succeeded: if the call fails, the app signs out of
  Firebase on the device and the user tries again. Any route still creates a missing user, as a safety net for when
  the app is signed in to Firebase but the call failed.
- **Google Play Billing** on the device, with the hashed user id as
  `obfuscatedAccountId`. The app sends the purchase token to the server, which
  verifies it with the Google Play Developer API and stores the entitlement.
  Real-time developer notifications keep renewals and cancellations current.
- **Play Integrity** on requests that cost money (evaluation, CV import),
  so scripts cannot call the API directly.
- **Quota** per user and plan (for example evaluations per month), plus a
  small free trial, enforced on the server before any AI call.
- **Account deletion** in the app and through a web link, as Google Play
  requires.

## Security baseline

The target is the normal level for a consumer app that stores personal data
(owner, 2026-11-02), not an enterprise level. Each item ships in the phase
shown. "Release" means before the first public release.

| Area | Requirement | Phase |
| --- | --- | --- |
| Authentication | Every route requires a verified token by default; a public route (such as health) is an explicit exception | 1 |
| Authorization | Every query for user data is scoped to the authenticated user; never trust a user id from the request. Each endpoint with user data has a test that user A cannot read or change user B's data | 1, then each endpoint |
| Input | Every route validates with a schema, and has size limits and timeouts. Errors never expose stack traces or internal details | 1 |
| Resource limits | Rate limits per user and per IP, on top of the AI quota | 1 |
| Secrets | Never in code, images or logs; injected at runtime. Secret scanning runs in CI | 1 |
| Supply chain | Lockfile with `npm ci`; dependency and image scans in CI; a pinned base image; the container does not run as root. Every new dependency is reviewed | 1 |
| CV parsing | The extractor handles files from strangers, so it runs in a separate process or container with no secrets, no network, and memory and time limits | 2 |
| Stored files | Buckets are private; the app never gets a public file URL | 2 |
| User-supplied URLs | Any URL from a user (careers pages, later shared job links) goes through the SSRF-guarded fetch and a per-user cap | 2, then each new path |
| AI cost | A spending cap at each AI provider and an alert on a cost spike, in addition to the quota, in case a bug bypasses the quota | 3 |
| AI input and output | Job postings are untrusted: prompts stay fenced and output is schema-validated. A posting cannot trigger tools or actions | 3 |
| Purchase notifications | Real-time developer notifications use a Pub/Sub pull subscription, or a push endpoint that verifies Google's signed token | 3 |
| Network | HTTPS only; the firewall opens only what is needed; the database, queue and storage admin are not reachable from the internet; SSH by key only, if used at all | Release |
| Access | MFA on every account that can reach production, kept by the owner: GitHub, Firebase/GCP, Play Console, hosting and storage, DNS, and AI provider consoles. Each service has its own least-privilege account. The app's database role cannot change the schema | Release |
| AI agents and production | AI development agents get no production secrets and no direct access to production data. Deploys run from CI or by the owner, with the owner's approval | Release |
| Backups | PostgreSQL and object storage are backed up automatically and encrypted, with a tested restore. The KMS key has deletion protection or its own recovery path. After a restore, accounts deleted since the backup are deleted again, using the identity provider or a uid-only deletion log kept outside the backed-up database. The privacy policy states how long deleted data stays in backups | Release |
| Monitoring | Alerts on 5xx rate, auth failure spikes, queue backlog and cost | Release |
| Incident runbook | How to rotate each secret, revoke access, and decide who must be told about a personal-data breach | Release |
| Security check | A pass through the OWASP API Security Top 10, with results recorded in `docs/` | Release |
| Privacy | The privacy policy and Play Data safety form are done; personal data is removed before AI; AI providers' terms exclude training; logs carry no CV text; account deletion works. Details are in [CV handling](#cv-handling), [AI providers](#ai-providers) and [Legal and policy notes](#legal-and-policy-notes) | Release |
| Cloud rehearsal | A full run on a cloud host, which may be the production host before launch | Release |

Environments:

- Development runs on Docker Compose on the developer's machine. No cloud host
  is needed for this.
- A cloud host is added when testers outside the owner's network need the
  backend, or at the latest for a rehearsal before release. Local runs cannot
  check production settings such as HTTPS, firewall rules and secret injection.
- The Network and Access rows apply from the first time any cloud host is up,
  not only at Release.
- Anything that is not production uses synthetic CVs only. A host where testers
  use real CVs counts as production for the whole baseline.

Not needed at this level: scheduled pentests, SOC 2 or ISO certification, an
enterprise WAF, mutual TLS between internal services, a dedicated HSM, and
multi-region deployment. Revisit them if the risk or a customer requires it.

## Notifications and background work on Android

- **New jobs:** the server decides and sends FCM. The app does not poll.
- **Evaluation progress:** the server pushes each real stage (queued,
  fetching job, analyzing, writing report, done, failed) through FCM; the app
  updates one progress notification. On Android 16+ it is shown as a Live
  Update (progress-centric notification). Below 16 (the app's `minSdk` is
  26), it is a normal progress notification. Several evaluations share one
  notification ("Evaluating 3/10"). New-job alerts are never Live Updates.
  Check the exact Live Update API, permissions and policy against current
  Android documentation at build time.
- **WorkManager:** syncs the Room cache after a push or when the network
  returns, and retries user actions that failed offline (tracker changes, CV
  upload). It does not schedule scans.

## Repository and Career Ops

- JobFlow stays the monorepo: `android/`, the new `backend/`, `contracts/`,
  `docs/`, the review skill and CI.
- Career Ops is **not** forked or moved in. The parts we reuse (providers,
  the scoring rubric and evaluation prompt from `modes/_shared.md` and
  `modes/oferta.md`) are copied into `vendor/career-ops/` with its MIT
  `LICENSE` and the upstream commit recorded. A `sync-career-ops` script
  shows the diff against the latest upstream
  (`github.com/career-ops-hq/career-ops`) so updates are deliberate and
  reviewed.
- The owner's personal Career Ops clone is not touched.
- `career-ops-wrapper/` stays as a development tool and a self-host option.
  Its reusable modules move into shared packages instead of being copied.

### What carries over from the wrapper

- Contract practice: DTOs, error envelope, error codes, OpenAPI, contract
  examples, Android mirroring.
- Security modules: SSRF-guarded fetch, linear HTML-to-text, nonce-fenced
  prompts, schema-validated LLM output, redaction, the report Markdown
  sanitizer.
- Evaluation: prompt assembly, output schema, stages, the tool-less CLI
  adapter.
- Scan diagnostics categories.
- Process: review skill, CI, branch and commit rules, test-first.

### What is replaced

- Reading Career Ops Markdown/TSV files → PostgreSQL.
- Pairing token → Firebase Auth, Play Integrity, entitlement.
- Spawning `scan.mjs` / `merge-tracker.mjs` → scheduled scan workers.
- Single-workspace assumptions → per-user data.

## Proposed stack (builder's call, owner to approve)

- TypeScript, Fastify, Zod, as today, so the modules above carry over.
- PostgreSQL with `pgvector`; queue on PostgreSQL (`pg-boss`) to keep moving
  parts few, and a dedicated queue only when load requires it.
- S3-compatible object storage behind `BlobStore`. MinIO in development; GCS,
  R2 or S3 in production.
- KMS behind `KeyManager`. A local key file in development; a cloud KMS in
  production.
- Docker Compose for local development (API, worker, PostgreSQL, MinIO);
  the same image in production.

## Phases

Android work runs alongside each phase, against the contract and mock
server.

1. **Foundation:** backend skeleton, ports, PostgreSQL schema and
   migrations, Docker Compose, auth verification, new contract draft and
   mock server. Extract the shared packages from the wrapper and vendor Career
   Ops.
   - Android: base URL config, auth layer, Room.
2. **Core loop without AI:** preferences, CV import and encrypted storage,
   shared job index with scheduled scans, stage-1 matcher, feed, tracker
   sync, new-job push.
   - Android: onboarding, feed, job detail, tracker.
3. **AI evaluation and payment:** `LlmProvider` with dev and production
   adapters, evaluation set, staged progress over FCM, Play Billing
   verification, Play Integrity, quota, account deletion.
   - Android: evaluate, Live Updates, paywall, account deletion.
4. **Next features:** Share → evaluate (`pipeline`), follow-up reminders,
   compare jobs, stage-2 CV-vector ranking.

Each phase ships through the existing workflow (issue, spec or plan, review
at the printed tier, PR, owner merge). It also ships its items from the
[Security baseline](#security-baseline). The first public release requires
the items marked "Release".

## Legal and policy notes

- Career Ops code is MIT: keep its copyright and license with vendored
  files. Its name is a pending trademark: no "career-ops" in product names,
  domains or store listings.
- Job sources: only official ATS APIs and boards that allow automated
  access. Each new source gets a terms check before it ships.
- Privacy policy, Google Play Data safety form, and account deletion before
  release. The server stores CVs, so the operator is the data controller.
- AI-generated reports are labelled as AI output; the user decides what to do
  with them.

## Decisions log

Owner decisions (2026-11-01 and 2026-11-02):

- Hosted, install-and-use; paid through Play Billing; business details later.
- All occupations and markets, with no gating.
- First release = the four core modes; the rest as in the scope table.
- Any AI vendor through configuration; owner subscriptions for development.
- Firebase Auth with Google (and Apple later).
- Store CVs on the server, encrypted.
- Keep JobFlow as the repo; vendor the needed Career Ops parts.
- Security at the normal level for a consumer app, as in the
  [Security baseline](#security-baseline). The builder may add or refine
  items. Removing or weakening an item needs the owner.
- A cloud host is optional until the release rehearsal. Development runs
  locally.

Builder's calls, which the owner can overrule:

- Anonymous sign-in before Google sign-in.
- Upload CVs through the API, not directly to Firebase Storage.
- Keep the CV original file as well as the text.
- Remove personal data before every AI call.
- Server-scheduled scans with FCM push; WorkManager only for sync and retry.
- The stack above, and the phase order.

## Answers from the builder check

A fresh reviewer read this design as the person who would build it. Its
questions were settled as follows.

- **Seed job sources (builder's call; one owner question below).** Career
  Ops does not search ATS platforms. It polls the companies listed in
  `portals.yml` (the example lists about 290, mostly tech) plus a few open
  boards. The first release launches with that list, the open boards that
  allow automated access, and companies that users add. A thin, tech-heavy
  feed for other occupations is accepted (owner: "support everything, improve
  over time"). The builder curates and grows the seed list. The app says when
  a feed is thin and offers "add a company".
- **Who can trigger AI before paying (builder's call).** Anonymous users can
  set up, import a CV and browse the feed. Every AI call (evaluation and LLM
  restructuring of the CV) requires Google sign-in, a passing Play Integrity
  verdict, and either an entitlement or the free trial. The free trial is
  keyed to the Google account and limited per device. Anonymous CV import
  uses plain text extraction only. This closes the "mint anonymous uids"
  hole.
- **Subscription or credits (owner decides before phase 3).** The entitlement
  model is generic: a plan grants features and quota counters with a reset
  rule. It can therefore back a subscription, consumable credits, or both.
  The Play product type and prices are a business decision to make before
  phase 3 starts. **The feed, matching and new-job push are free** (builder's
  call). Their cost is bounded by per-user match and push caps.
- **The app and the wrapper (builder's call).** The Android app targets only
  the hosted contract. The wrapper is frozen as a development and self-host
  tool and is no longer an app target. Its modules move into shared packages,
  with the wrapper's own test suite kept green as the gate.
- **What the paid evaluation contains (builder's call).**
  - Onboarding also asks for an optional short "what I'm aiming for": target
    roles and two or three highlights. This is the hosted equivalent of
    `_profile.md`, and it feeds `candidate_profile`.
  - The first release is tool-less, like issue #3. There is no web search.
  - Block D (pay) uses only what the posting and the user's preferences state.
  - Block G (is the posting legitimate) uses only the posting text and
    whether the job is still live in the index.
  - The report says what was not researched. Web research is a later, paid
    addition behind its own port.

## Owner answers (2026-11-02)

1. **Job aggregator APIs** (for example Adzuna or Jooble) are allowed where
   their terms permit. Start on free tiers and pay only when needed.
2. **Accounts and environments:**
   - The owner owns the Firebase/GCP project and the Play Console listing.
   - The app ID stays `me.dthuy.jobflow`.
   - A small staging host (about 5–10 USD a month) is an approved budget from
     phase 2, not a requirement. See the environments in the
     [Security baseline](#security-baseline).
   - No data-region constraint yet; the region is chosen with the cloud.

The design is approved by the owner as of 2026-11-02.

## How to continue (for any agent or person picking this up)

Read, in order:

1. `AGENTS.md`;
2. `docs/workflow/backend-delivery.md` (steps, tiers, owner decisions,
   branch and commit rules);
3. this document;
4. `career-ops-wrapper/` for the modules to carry over.

The next step is a plan for phase 1 (see `docs/superpowers/plans/` for the
format), then issues per piece. The review process lives in
`.claude/skills/review-change/`. It is written for Claude Code, but its
`references/` describe the reviewer roles in plain language.

## Left to the builder

Database schema details, queue job names, exact endpoint shapes (the contract
PR settles them), scan intervals per source, retry policies, the matcher's
filter rules, the personal-data patterns, and the Android screen designs
(through the existing design guidelines).
