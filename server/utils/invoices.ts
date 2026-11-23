import type { H3Event } from 'h3'
import type { Invoice, SessionUser } from '#shared/types/domain'
import { INVOICE_STATUSES } from '#shared/types/domain'
import { addDays, todayIso } from '#shared/utils/format'
import { accountScope, placeholders } from './auth'
import { useDb } from './db'
import { getInvoice } from './repo'

export async function requireInvoice(event: H3Event, user: SessionUser): Promise<Invoice> {
  const db = await useDb()
  const invoice = await getInvoice(db, getRouterParam(event, 'id') ?? '')
  if (!invoice || !user.accountIds.includes(invoice.accountId))
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  return invoice
}

export function requireDraft(invoice: Invoice) {
  if (invoice.status !== 'draft')
    throw createError({ statusCode: 409, statusMessage: 'Only draft invoices can be edited' })
}

/**
 * WHERE clause shared by the invoice list and the CSV export: account scope, period and
 * (optionally) status. Status filters use the derived overdue state.
 */
export function invoiceFilters(user: SessionUser, query: Record<string, unknown>, opts: { status: boolean }) {
  const today = todayIso()
  const accounts = accountScope(user, query.account)
  const where = [`i.account_id IN (${placeholders(accounts)})`]
  const params: unknown[] = [...accounts]

  const period = typeof query.period === 'string'
    ? query.period
    : '90d'
  // Drafts have no issue date yet; they always show.
  if (period === '90d') {
    where.push('(i.issue_date IS NULL OR i.issue_date >= ?)')
    params.push(addDays(today, -90))
  }
  else if (period === 'year') {
    where.push('(i.issue_date IS NULL OR i.issue_date >= ?)')
    params.push(`${today.slice(0, 4)}-01-01`)
  }

  if (typeof query.customer === 'string' && query.customer) {
    where.push('i.customer_id = ?')
    params.push(query.customer)
  }

  const status = typeof query.status === 'string' && (INVOICE_STATUSES as readonly string[]).includes(query.status)
    ? query.status
    : null
  if (opts.status && status) {
    if (status === 'overdue') {
      where.push('i.status = \'sent\' AND i.due_date < ?')
      params.push(today)
    }
    else if (status === 'sent') {
      where.push('i.status = \'sent\' AND (i.due_date IS NULL OR i.due_date >= ?)')
      params.push(today)
    }
    else {
      where.push('i.status = ?')
      params.push(status)
    }
  }

  return {
    where: where.join(' AND '),
    params,
    today,
  }
}
