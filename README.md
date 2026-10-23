# Growth OS — Starter Project

A premium SaaS dashboard starter for a multi-tenant performance marketing agency platform.

## What this starter includes

- Responsive Next.js dashboard UI.
- Agency overview, sample client portfolio, activity, tasks and attention panels.
- Premium SaaS visual system.
- Supabase dependencies and environment-variable placeholders.
- Initial database/RLS design in `supabase/migrations/0001_growth_os_foundation.sql`.

## Important: current status

This is a **deployable UI and database-foundation starter**, not a finished production SaaS. The dashboard uses illustrative sample data. Buttons and navigation elements are primarily visual placeholders; login, real client CRUD, tickets, approvals, advertising APIs, payment collection, and subscription billing still need implementation and testing.

Do not enter real client data until authentication, database access, storage policies and authorization tests have been implemented.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For a production build:

```bash
npm run build
```

## Deploy to GitHub and Vercel

1. Create a GitHub repository named `growth-os`.
2. Extract this ZIP and upload/commit the **contents** of the `growth-os` folder to the repository root.
3. In Vercel, select **Add New → Project**, import the repository, and deploy.
4. Vercel should detect Next.js automatically.
5. This UI preview does not require Supabase environment variables. Add them only after configuring Supabase.

## Supabase foundation

1. Create a Supabase project.
2. Open SQL Editor and run the migration in `supabase/migrations/0001_growth_os_foundation.sql`.
3. Configure authentication, invitation flows and email settings.
4. Implement and test server-side authorization before enabling real user data.
5. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables when the app's Supabase client/auth code is implemented.

The migration enables RLS and defines baseline tenant-aware policies for core tables, but it is not a substitute for a complete security review. Extend policies and tests before production use.

## Data integrity and security

- Never expose a Supabase service-role key in browser code.
- Keep advertising OAuth tokens and payment provider secrets server-side.
- Add server-side authorization for every mutation.
- Add integration tests proving cross-agency and cross-client isolation.
- Configure backups and test restores.
- Do not treat demo numbers as real campaign performance.

## Suggested implementation order

1. Auth and tenant membership.
2. Agency/client CRUD.
3. RLS and authorization tests.
4. Tasks, tickets and approvals.
5. Secure file storage.
6. Reporting imports and advertising API adapters.
7. Invoices, verified payment webhooks and subscription entitlements.
8. Monitoring, deployment hardening and privacy/legal documentation.
