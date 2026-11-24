import type {
  Account,
  AccountSummary,
  ActivityType,
  Adjustment,
  BillingCycle,
  Currency,
  Customer,
  CustomerStage,
  Invoice,
  InvoiceListItem,
  InvoiceStatus,
  InvoiceTemplate,
  License,
  Member,
  MemberStatus,
  PaymentMethod,
  Project,
  ProjectCost,
  ProjectStatus,
  Role,
} from '#shared/types/domain'
import type { Db } from './db'
import { computeInvoice, formatInvoiceNumber, licenseStatus, monthlyEquivalent, todayIso } from '#shared/utils/format'
import { adjustmentSchema } from '#shared/utils/schemas'
import { placeholders } from './auth'
import { newId, nowIso } from './db'

// PostgreSQL returns BIGINT/COUNT as strings and SQLite returns booleans as 0/1 — every mapper
// goes through these so the routes see plain numbers and booleans either way.
function num(v: unknown): number {
  return v === null || v === undefined
    ? 0
    : Number(v)
}
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 't'

type Row = Record<string, any>

/** Stored adjustments JSON → validated list (anything malformed is dropped rather than breaking the page). */
export function parseAdjustments(json: unknown): Adjustment[] {
  try {
    const raw = JSON.parse(String(json || '[]'))
    return Array.isArray(raw)
      ? raw.flatMap((a) => {
          const r = adjustmentSchema.safeParse(a)
          return r.success
            ? [r.data]
            : []
        })
      : []
  }
  catch {
    return []
  }
}

export function uploadUrl(key: string | null | undefined): string | null {
  return key
    ? `/uploads/${key}`
    : null
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export function mapAccount(r: Row): Account {
  return {
    id: r.id,
    name: r.name,
    mark: r.mark,
    color: r.color,
    legalName: r.legal_name,
    taxId: r.tax_id,
    address: r.address,
    email: r.email,
    phone: r.phone,
    logoUrl: uploadUrl(r.logo_key),
    logoLightUrl: uploadUrl(r.logo_light_key),
    numberPrefix: r.number_prefix,
    nextNumber: num(r.next_number),
    numberPadding: num(r.number_padding),
    currency: r.currency as Currency,
    paymentTermsDays: num(r.payment_terms_days),
    defaultAdjustments: parseAdjustments(r.default_adjustments),
    paymentDetails: r.payment_details,
    invoiceNotes: r.invoice_notes,
    defaultTemplate: r.default_template as InvoiceTemplate,
    isPrimary: bool(r.is_primary),
    stats: {
      customers: num(r.customer_count),
      invoices: num(r.invoice_count),
    },
  }
}

export function toSummary(a: Account): AccountSummary {
  return {
    id: a.id,
    name: a.name,
    mark: a.mark,
    color: a.color,
    legalName: a.legalName,
    currency: a.currency,
  }
}

const ACCOUNT_SELECT = `
  SELECT a.*,
    (SELECT COUNT(*) FROM customers c WHERE c.account_id = a.id) AS customer_count,
    (SELECT COUNT(*) FROM invoices i WHERE i.account_id = a.id) AS invoice_count
  FROM accounts a
`

export async function listAccounts(db: Db, ids: string[]): Promise<Account[]> {
  if (!ids.length)
    return []
  const rows = await db.prepare(`${ACCOUNT_SELECT} WHERE a.id IN (${placeholders(ids)}) ORDER BY a.is_primary DESC, a.created_at`).all(...ids) as Row[]
  return rows.map(mapAccount)
}

export async function getAccount(db: Db, id: string): Promise<Account | null> {
  const row = await db.prepare(`${ACCOUNT_SELECT} WHERE a.id = ?`).get(id) as Row | undefined
  return row
    ? mapAccount(row)
    : null
}

/** Takes the account's next invoice number and advances the counter, skipping any already used. */
export async function allocateInvoiceNumber(db: Db, accountId: string): Promise<string> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const row = await db.prepare(
      'UPDATE accounts SET next_number = next_number + 1 WHERE id = ? RETURNING next_number - 1 AS n, number_prefix, number_padding',
    ).get(accountId) as Row | undefined
    if (!row)
      throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    const number = formatInvoiceNumber(row.number_prefix, num(row.n), num(row.number_padding))
    const taken = await db.prepare('SELECT 1 FROM invoices WHERE number = ?').get(number)
    if (!taken)
      return number
  }
  throw createError({ statusCode: 409, statusMessage: 'Could not allocate an invoice number' })
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(db: Db): Promise<Member[]> {
  const rows = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Row[]
  const links = await db.prepare('SELECT user_id, account_id FROM user_accounts').all() as Row[]
  const allAccounts = (await db.prepare('SELECT id FROM accounts ORDER BY is_primary DESC, created_at').all() as Row[]).map(r => r.id as string)
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    title: r.title,
    email: r.email,
    phone: r.phone,
    role: r.role as Role,
    status: r.status as MemberStatus,
    avatarColor: r.avatar_color,
    accountIds: r.role === 'admin'
      ? allAccounts
      : links.filter(l => l.user_id === r.id).map(l => l.account_id as string),
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null,
  }))
}

// ─── Customers ───────────────────────────────────────────────────────────────

export const CUSTOMER_SELECT = `
  SELECT c.*, u.name AS owner_name,
    COALESCE((SELECT SUM(i.total - i.amount_paid) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'sent'), 0) AS outstanding
  FROM customers c
  LEFT JOIN users u ON u.id = c.owner_id
`

export function mapCustomer(r: Row): Customer {
  let tags: string[] = []
  try {
    tags = JSON.parse(r.tags || '[]')
  }
  catch {}
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    industry: r.industry,
    contactName: r.contact_name,
    contactRole: r.contact_role,
    email: r.email,
    phone: r.phone,
    address: r.address,
    stage: r.stage as CustomerStage,
    ownerId: r.owner_id ?? null,
    ownerName: r.owner_name ?? null,
    paymentTermsDays: r.payment_terms_days === null || r.payment_terms_days === undefined
      ? null
      : num(r.payment_terms_days),
    tags,
    createdAt: r.created_at,
    lastActivity: r.last_activity ?? null,
    lastActivityAt: r.last_activity_at ?? null,
    outstanding: num(r.outstanding),
  }
}

export async function getCustomer(db: Db, id: string): Promise<Customer | null> {
  const row = await db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id) as Row | undefined
  return row
    ? mapCustomer(row)
    : null
}

export async function logActivity(db: Db, input: {
  accountId: string
  customerId?: string | null
  invoiceId?: string | null
  userId?: string | null
  type: ActivityType
  body: string
  at?: string
}) {
  const at = input.at ?? nowIso()
  await db.prepare(`
    INSERT INTO activities (id, account_id, customer_id, invoice_id, user_id, type, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId('act'), input.accountId, input.customerId ?? null, input.invoiceId ?? null, input.userId ?? null, input.type, input.body, at)
  if (input.customerId) {
    await db.prepare(`
      UPDATE customers SET last_activity = ?, last_activity_at = ?
      WHERE id = ? AND (last_activity_at IS NULL OR last_activity_at <= ?)
    `).run(input.body, at, input.customerId, at)
  }
}

// ─── Invoices ────────────────────────────────────────────────────────────────

/** SQL for the status users see: a sent invoice past its due date reads as overdue. */
export const EFFECTIVE_STATUS = `CASE WHEN i.status = 'sent' AND i.due_date IS NOT NULL AND i.due_date < ? THEN 'overdue' ELSE i.status END`

export const INVOICE_LIST_SELECT = `
  SELECT i.*, c.name AS customer_name, ${EFFECTIVE_STATUS} AS effective_status
  FROM invoices i
  LEFT JOIN customers c ON c.id = i.customer_id
`

export function mapInvoiceListItem(r: Row): InvoiceListItem {
  return {
    id: r.id,
    accountId: r.account_id,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    number: r.number,
    status: (r.effective_status ?? r.status) as InvoiceStatus,
    template: r.template as InvoiceTemplate,
    currency: r.currency as Currency,
    issueDate: r.issue_date ?? null,
    dueDate: r.due_date ?? null,
    total: num(r.total),
    amountPaid: num(r.amount_paid),
  }
}

export async function getInvoice(db: Db, id: string): Promise<Invoice | null> {
  const row = await db.prepare(`${INVOICE_LIST_SELECT} WHERE i.id = ?`).get(todayIso(), id) as Row | undefined
  if (!row)
    return null
  const account = await getAccount(db, row.account_id)
  if (!account)
    return null

  const items = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position').all(id) as Row[]
  const payments = await db.prepare(`
    SELECT p.*, u.name AS recorded_by_name FROM payments p
    LEFT JOIN users u ON u.id = p.recorded_by
    WHERE p.invoice_id = ? ORDER BY p.paid_at, p.created_at
  `).all(id) as Row[]
  const customer = row.customer_id
    ? await db.prepare('SELECT id, name, contact_name, address, email FROM customers WHERE id = ?').get(row.customer_id) as Row | undefined
    : undefined

  const mappedItems = items.map(it => ({
    id: it.id,
    description: it.description,
    quantity: num(it.quantity),
    rate: num(it.rate),
    amount: num(it.amount),
  }))
  let adjustments = parseAdjustments(row.adjustments)
  // Invoices saved before adjustments existed carried a single tax rate.
  if (!adjustments.length && num(row.tax_rate) > 0) {
    adjustments = [
      {
        kind: 'tax',
        label: 'Tax',
        mode: 'percent',
        value: num(row.tax_rate),
      },
    ]
  }

  return {
    ...mapInvoiceListItem(row),
    notes: row.notes,
    adjustments,
    breakdown: computeInvoice(mappedItems, adjustments),
    sentAt: row.sent_at ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: mappedItems,
    payments: payments.map(p => ({
      id: p.id,
      amount: num(p.amount),
      method: p.method as PaymentMethod,
      reference: p.reference,
      paidAt: p.paid_at,
      recordedBy: p.recorded_by_name ?? null,
    })),
    account,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          contactName: customer.contact_name,
          address: customer.address,
          email: customer.email,
        }
      : null,
  }
}

/** Re-totals payments on an invoice and flips it to paid once fully covered. */
export async function refreshInvoicePayments(db: Db, invoiceId: string) {
  const row = await db.prepare(`
    SELECT i.total, i.status, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid,
      (SELECT MAX(p.paid_at) FROM payments p WHERE p.invoice_id = i.id) AS last_paid
    FROM invoices i WHERE i.id = ?
  `).get(invoiceId) as Row | undefined
  if (!row)
    return
  const paid = num(row.paid)
  const fullyPaid = paid >= num(row.total) && num(row.total) > 0
  const status = fullyPaid
    ? 'paid'
    : row.status === 'paid'
      ? 'sent'
      : row.status
  await db.prepare('UPDATE invoices SET amount_paid = ?, status = ?, paid_at = ?, updated_at = ? WHERE id = ?')
    .run(paid, status, fullyPaid ? row.last_paid : null, nowIso(), invoiceId)
}

// ─── Licences ────────────────────────────────────────────────────────────────

export const LICENSE_SELECT = `
  SELECT l.*, c.name AS customer_name FROM licenses l
  LEFT JOIN customers c ON c.id = l.customer_id
`
/** Soonest renewal first; licences that never expire last. */
export const LICENSE_ORDER = 'ORDER BY l.renewal_date IS NULL, l.renewal_date, l.name'

export function mapLicense(r: Row, today = todayIso()): License {
  const cancelled = bool(r.cancelled)
  return {
    id: r.id,
    accountId: r.account_id,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    name: r.name,
    issuer: r.issuer,
    reference: r.reference,
    startDate: r.start_date ?? null,
    renewalDate: r.renewal_date ?? null,
    cycle: r.cycle as BillingCycle,
    cost: num(r.cost),
    currency: r.currency as Currency,
    autoRenew: bool(r.auto_renew),
    notes: r.notes,
    status: licenseStatus(r.renewal_date ?? null, cancelled, today),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function getLicense(db: Db, id: string): Promise<License | null> {
  const row = await db.prepare(`${LICENSE_SELECT} WHERE l.id = ?`).get(id) as Row | undefined
  return row
    ? mapLicense(row)
    : null
}

// ─── Projects ────────────────────────────────────────────────────────────────

export const PROJECT_SELECT = `
  SELECT p.*, c.name AS customer_name, u.name AS owner_name FROM projects p
  JOIN customers c ON c.id = p.customer_id
  LEFT JOIN users u ON u.id = p.owner_id
`

/** Maps project rows and attaches their recurring costs (one query for all of them). */
export async function hydrateProjects(db: Db, rows: Row[]): Promise<Project[]> {
  if (!rows.length)
    return []
  const ids = rows.map(r => r.id as string)
  const costRows = await db.prepare(`SELECT * FROM project_costs WHERE project_id IN (${placeholders(ids)}) ORDER BY position`).all(...ids) as Row[]
  const costsByProject = new Map<string, ProjectCost[]>()
  for (const c of costRows) {
    const list = costsByProject.get(c.project_id) ?? []
    list.push({
      id: c.id,
      label: c.label,
      amount: num(c.amount),
      frequency: c.frequency as BillingCycle,
      nextDueDate: c.next_due_date ?? null,
    })
    costsByProject.set(c.project_id, list)
  }
  return rows.map((r) => {
    const costs = costsByProject.get(r.id) ?? []
    const dues = costs.map(c => c.nextDueDate).filter((d): d is string => !!d).sort()
    return {
      id: r.id,
      accountId: r.account_id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      name: r.name,
      description: r.description,
      status: r.status as ProjectStatus,
      startDate: r.start_date ?? null,
      endDate: r.end_date ?? null,
      ownerId: r.owner_id ?? null,
      ownerName: r.owner_name ?? null,
      currency: r.currency as Currency,
      costs,
      monthlyCost: costs.reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.frequency), 0),
      nextDueDate: dues[0] ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
}

export async function getProject(db: Db, id: string): Promise<Project | null> {
  const row = await db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as Row | undefined
  return row
    ? (await hydrateProjects(db, [row]))[0]!
    : null
}

/** Replaces a project's recurring costs with `costs`, in order. */
export async function saveProjectCosts(db: Db, projectId: string, costs: Omit<ProjectCost, 'id'>[]) {
  await db.prepare('DELETE FROM project_costs WHERE project_id = ?').run(projectId)
  for (const [position, c] of costs.entries()) {
    await db.prepare('INSERT INTO project_costs (id, project_id, position, label, amount, frequency, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(newId('pco'), projectId, position, c.label, c.amount, c.frequency, c.nextDueDate)
  }
}
