# Action Systems AI Command Center

A working marketing MVP for Action Systems: products, AI-assisted drafts, human review, a Jamaica-time calendar, manual publishing, Gumroad CSV analytics, and durable internal workflows.

**Nothing publishes automatically.** No marketing messages, payment actions, Facebook Group bots, or external publishing APIs are implemented. A scheduled post remains scheduled until an authorized person explicitly confirms manual publication and supplies its URL.

## Quick start

Use Node **24.19.0** (see `.nvmrc` and `.node-version`). The repository root is the application root.

```bash
npm ci
npm run dev
```

In this cloud workspace the default home directory is read-only. Install using:

```bash
cd /workspace/action-systems-command-center
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open the app on port 3000 in a supported local/hosted development environment, then choose **Open demo workspace**. Cloud onboarding uses internal requests for validation and does not provide a localhost preview link.

With no Supabase credentials, a signed, HTTP-only browser session opens an isolated demo workspace. It persists in ignored `.local/` files on this machine; it is not production cloud storage. The session expires after seven days. Signing out and opening a new demo creates a new workspace. Do not use the local adapter on an ephemeral filesystem or across multiple server instances. Use Supabase for persistent production data.

The only preloaded product facts are **Service Profit OS** and the supplied URL, `https://actionsystem.gumroad.com/l/serviceprofit-os`. Price, description, audience, benefits, keywords, and images remain blank until the owner verifies them. There are **no seeded purchases, earnings, reviews, or published posts**. All monetary amounts in automated tests are synthetic fixtures and never production seeds.

## Connect Supabase and OpenAI

1. Create a Supabase project and execute `supabase/migrations/202610120001_command_center.sql` using its SQL editor or your normal Supabase migration workflow. The migration assumes Supabase's `auth.users`, `auth.uid()`, `anon`, and `authenticated` roles. Apply it once to a new project/schema; it is not an incremental upgrade from an earlier draft of this MVP.
2. Copy `.env.example` to `.env.local` and provide the project's `NEXT_PUBLIC_SUPABASE_URL` and publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Legacy anon keys are also supported. **Never use a service-role key.**
3. Set the Supabase Auth Site URL / redirect allowlist to your application origin. Enable the desired email/password and email-confirmation policy. Create an account through the login page, confirm its email if required, and sign in. Supabase authenticates users server-side; the first login provisions the user's first Action Systems business and membership atomically.
4. Optionally set a server-only OpenAI key. `ACTION_SYSTEMS_OPENAI_API_KEY` is preferred in cloud environments that reserve `OPENAI_*` names; `OPENAI_API_KEY` also works on conventional hosts. Proxy-backed keys are used only through the supported HTTPS destination. Do not attempt to extract the raw value of a proxy key.
5. Set `APP_ORIGIN` to the exact HTTPS production origin and `DEMO_MODE=false` for a live deployment. Restart/rebuild the app after changing public Supabase configuration. The example `OPENAI_MODEL=gpt-4.1-mini` uses the official chat-completions endpoint with JSON output; change it to a model available to your account that supports that contract.

Without an OpenAI key, the studio explicitly uses a **Template provider**, even in a live Supabase workspace. Templates use supplied facts; they are not presented as AI responses. With a key, OpenAI requests run on the server. Provider failures remain errors rather than silently claiming successful generation. Every generated draft still needs factual review and approval.

Live Supabase Auth/network access and OpenAI responses must be validated after credentials are supplied. The included PostgreSQL tests verify the migration and data permissions without requiring those services; they do not establish connectivity to a deployed Supabase project or OpenAI account.

## Review the working MVP

- **Overview:** product totals, approvals, planned/confirmed publications, imported gross sales, activity, and failed-task notifications.
- **Product library:** create, edit, archive/restore, verified-fact fields, hosted product images, and keywords.
- **Content studio:** choose product/platform/objective/tone, create a campaign, generate or regenerate a draft, edit it, and request approval.
- **Approval queue:** approve/reject, record rejection reasons, and inspect reviewer identity, time, and content version.
- **Marketing calendar:** month/week views, product/platform filters, schedule/reschedule, and planned/completed counts. Times are stored in UTC and displayed in `America/Jamaica` (UTC−05:00).
- **Publishing tracker:** copy content, publish yourself, then use **Mark as published** with the post URL and confirmation checkbox. Facebook Group content is manual discussion assistance only.
- **Sales analytics:** import a sales CSV, deduplicate, apply represented refunds, and review currency-separated totals, product performance, date performance, and a private purchase ledger. Buyer emails/names are discarded.
- **Workflows:** queue suggestions, prepare unapproved Pinterest drafts for up to five products, record internal approval reminders, summarize marketing, and review due manual publishing tasks. Results, failures, leases, recovery actions, and audit events are visible.

Desktop and mobile screenshots are in [`docs/screenshots/`](docs/screenshots/). They are captured by the browser tests from an isolated demo with no real customer data.

## CSV imports

Upload an official Gumroad sales export, **maximum 2 MB / 10,000 rows**. Header matching is case-insensitive, handles a UTF-8 BOM, and accepts common aliases:

| Field                          | Accepted headers                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Unique purchase identifier     | Purchase ID, Sale ID, Order ID, ID                                                           |
| Product                        | Product Name, Product                                                                        |
| Gross amount in currency units | Gross, Gross Sale, Gross Sales, Sale Price, Price, Amount                                    |
| Currency                       | Currency, Currency Code                                                                      |
| Date                           | Sale Date, Date, Created At, Created, Date Created, Purchase Date, Sale Timestamp, Timestamp |
| Optional full-refund flag      | Refunded, Refunded?, Is Refunded                                                             |
| Optional refund amount         | Refund Amount, Amount Refunded, Refund                                                       |

The import dialog supports **explicit column mapping** when your export's headers differ (for example, `Amount ($)`). If a file lacks currency or timezone information, you can explicitly confirm those values. The importer does not guess whether `$` means USD or another dollar currency. Choose the source timezone for timestamps without an offset. Dates otherwise use ISO 8601 with an offset, or `YYYY-MM-DD` interpreted as UTC.

Decimal amounts are parsed into integer cents. This MVP supports two-decimal monetary amounts; do not use it for exports requiring other minor-unit precision. Fees and payouts are not imported. **Gross sales and gross less refunds are not net proceeds.** Different currencies are never summed or converted.

Repeated purchase IDs do not create additional sales. Later refunds increase the recorded refund without adding another purchase. Refund reversals are not supported. Conflicting duplicates reject the whole import. Invalid dates/amounts, oversize uploads, malformed CSV, and formula-like identifiers are rejected. Raw files, buyer emails, and customer names are not persisted. Read the final import audit entry for added/updated/skipped counts.

## Architecture and security

Next.js 16 App Router + TypeScript + React 19 + Tailwind 4, Radix accessible dialog primitives, Lucide icons, Zod validation, Supabase SSR Auth/PostgreSQL, and a server-side content-provider interface.

```
src/app/(workspace)/     Private feature pages
src/app/api/             Authenticated, same-origin mutation endpoints
src/components/          Reusable UI and workspace state
src/lib/workflow.ts       Permission checks and approval state machine
src/lib/csv.ts            Bounded CSV parsing and integer monetary calculations
src/lib/providers.ts      OpenAI / fact-based template adapters
src/lib/publishing.ts     Future officially authorized publishing adapter contract
src/lib/server/           Auth, persistence, request limits, durable job execution
supabase/migrations/      Eleven tables, indexes, constraints, RLS, transactional RPCs
tests/                   Workflow, scheduling, import, permission, PostgreSQL tests
e2e/                     Browser and HTTP integration workflows
```

The tables cover businesses, memberships, products, campaigns, content, approvals, scheduled posts, connections, sales, jobs, and audit logs. Compound foreign keys prevent cross-business product/content references. Membership RLS controls every read. Direct authenticated writes are revoked; mutations use an authenticated security-definer RPC with an empty search path, explicit tenant/role checks, a business revision lock, and an atomic audit entry. The application never uses a service-role credential.

Roles: **owner** can manage/review all business data; **editor** manages products/drafts/imports/internal jobs and can submit review requests; **reviewer** approves/rejects/schedules/confirms publication; **viewer** reads only. Team-invitation and membership-management UI are future work; create memberships through a trusted administrative workflow. The current UI opens the user's first business; the model supports multiple businesses for a later switcher.

Approval is tied to a **content version**, separate from the workspace's optimistic-lock revision. Status changes preserve the original review record. Editing or regenerating text invalidates approval, returns it to Draft, and cancels the schedule. Published content is immutable. Scheduling requires a future date and human approval of the current version. Manual publication requires the same approval, reviewer permission, a validated HTTPS URL, and explicit confirmation.

Writes require a matching application origin and validated input; cookies are signed/HTTP-only/SameSite; API bodies and CSV uploads are bounded; CSP and other response headers are configured; generation/auth/import/job requests are rate-limited. The in-memory limiter and local demo lock are single-instance controls. For a horizontal production deployment, use a shared rate-limit service and Supabase storage. Remote image URLs are loaded by the browser, not fetched by an application upload service.

### Background jobs

Authenticated user actions create durable queued jobs. Next.js `after()` runs the internal worker after the response, preserving the initiating request's authentication context. Claims are atomic, have a five-minute lease, and track attempts. Completed jobs cannot run again. On an interrupted process, use **Retry / recover job** for queued, failed, or expired jobs. Results are polled by the UI. If draft creation partially succeeds, those drafts remain unapproved; a later retry can create additional drafts, so review existing drafts before retrying.

Daily/unattended scheduler wiring is **not enabled**. No cron credentials or anonymous worker endpoint exist. A future scheduler should authenticate a business-scoped worker, use a daily idempotency key, claim jobs transactionally, and restrict registered handlers. OAuth publishing must separately verify current approval, account connection, required scopes, explicit publishing authorization, and the official platform response. Scheduling alone must never be evidence of publication. Pinterest integration guidance targets the official v5 API with `pins:write`, `boards:read`, and `pins:read` for verification; app access/review is still required. No Facebook Group automation adapter is permitted.

## Validation

```bash
npm run check       # lint, TypeScript, unit/SQL tests, production build
npm run test:e2e    # starts an isolated production server on port 3100
```

Run the build before browser tests. The test launcher uses Chromium distributed through an integrity-checked npm dependency, avoiding a separate browser-CDN download in restricted environments. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to supply another compatible browser. Container tests use `--no-sandbox` only for the isolated test browser, not application security settings. The production browser retains normal same-origin protections.

PostgreSQL tests execute the real migration in PGlite with Supabase-like auth roles and exercise tenant RLS, forbidden direct writes, approval transitions, schedule/publication rules, stale revision handling, job claims/leases, CSV deduplication, represented refunds, and transactional rollback. Browser tests cover authentication, product edits, generation/edit/review/scheduling/manual confirmation, repeat imports, analytics, audit history, background draft generation, session isolation, and mobile navigation. Browser tests use a separate temporary data directory and synthetic purchases.

Production commands:

```bash
npm run build
npm run start
```

## Review and deployment

Work lives on `feat/command-center-mvp`. Merge through a reviewed pull request; do not treat the local demo as a deployed service. Supabase and OpenAI credentials, actual product facts, production origin/rate limiting, and any future OAuth authorizations are separate deployment prerequisites. No application code is merged into `main` during this implementation task.
