## Action Systems AI Command Center MVP

The repository had no application or commits. This PR creates a private marketing workspace for managing products, preparing content, reviewing approvals, scheduling in Jamaica time, recording manual publications, and importing Gumroad sales.

- Next.js/TypeScript/Tailwind interface with Radix dialogs and all eight feature modules.
- Supabase Auth and eleven-table PostgreSQL migration with membership RLS, compound tenant foreign keys, restricted writes, and transactional audited operations.
- Clearly marked, isolated local demo sessions and a template provider when live credentials are absent.
- Current-version approval required before scheduling or manual publication; editing invalidates approval. No automatic publishing or external marketing messages.
- Size-limited CSV imports with header mapping, integer monetary amounts, unique purchase deduplication, represented refunds, currency-separated reports, and no retained buyer emails.
- Durable authenticated internal jobs with atomic claims, leases, results, failed-task visibility, and recovery actions.

### Review

See README for exact setup and the click-through workflow. `docs/screenshots/dashboard.png` and `docs/screenshots/mobile-products.png` show the isolated demo UI. Run `npm ci`, `npm run dev`, and open port 3000 in your supported development environment; choose **Open demo workspace**. No credentials are needed for this review path.

### Validation

Frozen installation, ESLint, TypeScript, all 48 unit/provider/PostgreSQL tests, the production build, and all 3 browser/HTTP tests passed. See `docs/VALIDATION.md` for the evidence and its limits. The browser suite includes the entire create/edit/review/schedule/manual-publication/import/report workflow and checks demo-session isolation and background draft preparation. Manual confirmation URLs and purchase rows are synthetic; no external post was published.

### Limits

Live Supabase Auth and OpenAI calls require credentials and have not been validated against an external project/account. OAuth publishing, daily/unattended scheduler wiring, team invitations, business switching, net-payout reconciliation, refund reversals, and multi-instance shared rate limiting are future work. Unknown Service Profit OS facts remain blank. No external posts or real sales are fabricated.
