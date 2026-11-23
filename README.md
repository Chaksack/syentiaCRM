# syentiaCRM

Multi-account CRM and invoicing: customers, branded invoices, payments and team roles. Built
with Nuxt 4 (Vue 3, TypeScript) and a TypeScript backend on Nitro server routes, backed by
PostgreSQL (Neon).

Each **account** is a separate billing identity with its own logo, brand colour, legal details,
invoice numbering, payment details and default invoice template (Ledger, Bold or Minimal).
Customers and invoices belong to one account.

## Getting started

```bash
pnpm install
cp .env.example .env   # then fill in DATABASE_URL and NUXT_SEED_ADMIN_PASSWORD
pnpm dev               # http://localhost:3000
```

On first start the app creates its tables and seeds:

- an admin user from `NUXT_SEED_ADMIN_EMAIL` / `NUXT_SEED_ADMIN_PASSWORD` (a random password is
  printed to the console if you leave it empty), and
- demo data from the design (two accounts, customers, invoices, team), unless `NUXT_SEED_DEMO=false`.

Seeding only runs when the `users` table is empty.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Neon). Empty → local SQLite at `.data/syentia.sqlite`. |
| `NUXT_SESSION_PASSWORD` | Session cookie key, 32+ characters. **Required in production.** |
| `NUXT_SEED_ADMIN_EMAIL` / `_NAME` / `_PASSWORD` | First admin. |
| `NUXT_SEED_DEMO` | `false` to skip demo data. |
| `NUXT_PUBLIC_SITE_URL` | Public URL, used in invite links. |

## Layout

```
app/                 Vue app (pages, components, composables, auth middleware)
server/api/          REST API (auth, accounts, customers, invoices, team, tasks, dashboard)
server/utils/        db adapter + migrations, auth/sessions, queries, seed
shared/              types, zod schemas, permissions and formatting used by both sides
```

- **Database**: `server/utils/db.ts` uses a `pg` connection pool when `DATABASE_URL` is set, with
  each transaction on its own pooled connection. Otherwise it falls back to Nitro's db0 with
  `node:sqlite`. Migrations are idempotent `CREATE … IF NOT EXISTS`, run at startup.
- **Money** is stored as integer minor units (pesewas/cents). "Overdue" is derived from sent
  invoices past their due date.
- **Auth**: email and password (scrypt), encrypted cookie sessions. The user is reloaded from the
  database on every request, so role changes and suspensions take effect immediately.
- **Permissions** (`shared/utils/permissions.ts`) are enforced by the API and mirrored in the UI:

  | | Admin | Manager | Sales | Finance | Viewer |
  | --- | :-: | :-: | :-: | :-: | :-: |
  | View customers & invoices | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Add & edit customers | ✓ | ✓ | ✓ | | |
  | Create & edit invoices | ✓ | ✓ | ✓ | ✓ | |
  | Send invoices & record payments | ✓ | ✓ | | ✓ | |
  | Manage accounts, branding & team | ✓ | | | | |

  Non-admins only see the accounts they've been given access to.

## Not wired up yet

- **Email.** Invites produce a link that's logged and shown to the admin to share; "Send invoice"
  marks the invoice as sent and logs it, but doesn't email the customer. Hook a provider into
  `server/utils/invites.ts` and `server/api/invoices/[id]/send.post.ts`.
- **PDF.** "Download PDF" opens an A4 print view (`/invoices/:id/print`), which you save as PDF from
  the browser's print dialog.
- **Logo storage.** Uploaded logos go to Nitro storage on the local filesystem (`.data/uploads`).
  For serverless hosting (e.g. Vercel), point the `uploads` storage in `nuxt.config.ts` at a
  blob or S3 driver.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm db:reset` (local SQLite only)
