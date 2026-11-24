# syentiaCRM

Multi-account CRM and invoicing: customers, branded invoices, payments and team roles. Built
with Nuxt 4 (Vue 3, TypeScript) and a TypeScript backend on Nitro server routes, backed by
PostgreSQL (Neon).

Each **account** is a separate billing identity with its own logo, brand colour, legal details,
invoice numbering, payment details and default invoice template (Ledger, Bold or Minimal).
Customers and invoices belong to one account.

**Projects** belong to a customer and carry their recurring costs (monthly, quarterly or yearly,
with an optional next-due date); the Projects page totals them per month and per year.
**Licences** track permits, subscriptions and software licences with a renewal date and fee —
either the company's own or one held for a customer. Status is derived from the renewal date
(*Renews soon* within 30 days, *Expired* after it), "Mark renewed" moves the date on one cycle,
and licences coming up for renewal appear in the dashboard's follow-ups.

## Getting started

```bash
pnpm install
cp .env.example .env   # then fill in DATABASE_URL, NUXT_SESSION_PASSWORD and the NUXT_SEED_* values
pnpm dev               # http://localhost:3000
```

On first start (empty database) the app creates its tables, the first admin
(`NUXT_SEED_ADMIN_EMAIL` / `_NAME` / `_PASSWORD`; a random password is printed to the console if
you leave it empty) and one blank billing account named `NUXT_SEED_ACCOUNT_NAME`. Sign in, fill in
the account on **Accounts & branding**, change your password from the menu under your name, then
add customers and invite the team. The `NUXT_SEED_*` values are only read while the database has
no users.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Neon). Empty → local SQLite at `.data/syentia.sqlite`. |
| `NUXT_SESSION_PASSWORD` | Session cookie key, 32+ characters. **Required in production.** |
| `NUXT_SEED_ADMIN_EMAIL` / `_NAME` / `_PASSWORD` | First admin (first start only). |
| `NUXT_SEED_ACCOUNT_NAME` | Name of the first billing account (first start only). |
| `NUXT_PUBLIC_SITE_URL` | Public URL, used in invite links. |
| `KOLA_READ_WRITE_TOKEN` | Vercel Blob (private store) token for uploaded logos. Empty → files go to `.data/uploads`. `KOLA_STORE_ID` is kept for reference. |

## Layout

```
app/                 Vue app (pages, components, composables, auth middleware)
server/api/          REST API (auth, accounts, customers, invoices, projects, licenses, team, tasks, dashboard)
server/utils/        db adapter + migrations, auth/sessions, queries, seed
shared/              types, zod schemas, permissions and formatting used by both sides
```

- **Database**: `server/utils/db.ts` uses a `pg` connection pool when `DATABASE_URL` is set, with
  each transaction on its own pooled connection. Otherwise it falls back to Nitro's db0 with
  `node:sqlite`. Migrations are idempotent `CREATE … IF NOT EXISTS`, run at startup.
- **Uploads** (`server/utils/uploads.ts`): logos go to a private Vercel Blob store when
  `KOLA_READ_WRITE_TOKEN` is set, otherwise to `.data/uploads`. Either way the database keeps a key
  and browsers load `/uploads/<key>`, which streams the file with headers that keep SVGs inert and
  lets Vercel's CDN cache it.
- **Money** is stored as integer minor units (pesewas/cents). "Overdue" is derived from sent
  invoices past their due date.
- **Auth**: email and password (scrypt), encrypted cookie sessions. The user is reloaded from the
  database on every request, so role changes and suspensions take effect immediately.
- **Permissions** (`shared/utils/permissions.ts`) are enforced by the API and mirrored in the UI:

  | | Admin | Manager | Sales | Finance | Viewer |
  | --- | :-: | :-: | :-: | :-: | :-: |
  | View customers & invoices | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Add & edit customers, projects & licences | ✓ | ✓ | ✓ | | |
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

## Scripts

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm db:reset` (local SQLite only)
