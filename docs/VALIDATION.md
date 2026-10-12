# MVP validation

Validated in the cloud workspace on 2026-10-12 with Node 24.19.0 / npm 11.9.0.

| Check | Result |
| --- | --- |
| Frozen install: `npm ci --cache=/workspace/.npm-cache` | Passed |
| ESLint | Passed, no lint warnings/errors |
| TypeScript: `tsc --noEmit` | Passed |
| Vitest | 48 passed across 4 files; no skipped tests |
| Production build | Passed |
| Playwright production browser/HTTP checks | 3 passed; no skipped tests |
| Production dependency audit | No known vulnerabilities reported |

The browser tests exercise private-route login, product editing, template generation, content edits, requests for approval, human approval, UTC scheduling, persistence across reload, simulated manual-publication confirmation, duplicate CSV imports, correct gross/refund totals, hidden buyer emails, audit/review history, background unapproved draft preparation, separate demo workspaces, same-origin enforcement, and mobile navigation.

The real PostgreSQL migration was executed in PGlite with a test Supabase auth schema/roles. Tests verified all eleven RLS-enabled tables, cross-tenant isolation, forbidden direct writes, role permissions, stale revisions, approval transitions, atomic sales-import rollback, refund updates, durable job claims, active leases, and duplicate-execution rejection.

No actual social post was published. Browser confirmation URLs and sales rows are synthetic test fixtures in a separate temporary workspace. Screenshots show the clearly labeled demo and contain no real buyer records.

Live Supabase Auth and OpenAI calls remain unverified because no credentials were provided. OAuth publishing, unattended daily scheduler wiring, and financial actions are not implemented. These limitations are described in the README.

GitHub native Git read access succeeds. GitHub API requests were blocked at the outbound proxy's CONNECT stage (403), preventing API-based pull-request creation until network access is enabled.
