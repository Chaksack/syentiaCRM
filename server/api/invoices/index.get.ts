import type { InvoiceListItem, InvoiceStatus, Paginated } from '#shared/types/domain'
import { addDays } from '#shared/utils/format'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = await useDb()

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10))

  const base = invoiceFilters(user, query, { status: false })
  const filtered = invoiceFilters(user, query, { status: true })

  const scope = accountScope(user, query.account)
  // Independent queries in parallel. Tab counts and summary tiles share the account/period
  // filter but ignore the status tab.
  const [summary, paid30, total, rows] = await Promise.all([
    db.prepare(`
      SELECT ${EFFECTIVE_STATUS} AS s, COUNT(*) AS n, COALESCE(SUM(i.total - i.amount_paid), 0) AS open_amount, COALESCE(SUM(i.total), 0) AS amount
      FROM invoices i WHERE ${base.where} GROUP BY 1
    `).all(base.today, ...base.params),
    db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(i.total), 0) AS amount FROM invoices i
      WHERE i.account_id IN (${placeholders(scope)}) AND i.status = 'paid' AND i.paid_at >= ?
    `).get(...scope, addDays(base.today, -30)),
    db.prepare(`SELECT COUNT(*) AS n FROM invoices i WHERE ${filtered.where}`).get(...filtered.params),
    db.prepare(`
      ${INVOICE_LIST_SELECT} WHERE ${filtered.where}
      ORDER BY i.issue_date IS NOT NULL, i.issue_date DESC, i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(filtered.today, ...filtered.params, pageSize, (page - 1) * pageSize),
  ]) as [{ s: InvoiceStatus, n: number, open_amount: number, amount: number }[], { n: number, amount: number }, { n: number }, Record<string, unknown>[]]

  const counts: Record<InvoiceStatus | 'all', number> = {
    all: 0,
    draft: 0,
    sent: 0,
    overdue: 0,
    paid: 0,
  }
  const amounts: Record<InvoiceStatus, number> = {
    draft: 0,
    sent: 0,
    overdue: 0,
    paid: 0,
  }
  for (const r of summary) {
    counts[r.s] = Number(r.n)
    counts.all += Number(r.n)
    amounts[r.s] = Number(r.s === 'paid' || r.s === 'draft'
      ? r.amount
      : r.open_amount)
  }

  const result: Paginated<InvoiceListItem> = {
    items: rows.map(mapInvoiceListItem),
    total: Number(total.n),
    page,
    pageSize,
  }
  return {
    ...result,
    counts,
    totals: {
      draft: { amount: amounts.draft, count: counts.draft },
      awaiting: { amount: amounts.sent + amounts.overdue, count: counts.sent + counts.overdue },
      overdue: { amount: amounts.overdue, count: counts.overdue },
      paid30: {
        amount: Number(paid30.amount),
        count: Number(paid30.n),
      },
    },
  }
})
