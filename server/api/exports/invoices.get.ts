import { formatMoney, STATUS_STYLE } from '#shared/utils/format'

function cell(v: unknown) {
  const s = v === null || v === undefined
    ? ''
    : String(v)
  // Quote, and neutralise leading formula characters so spreadsheets don't execute them.
  const safe = /^[=+\-@\t\r]/.test(s)
    ? `'${s}`
    : s
  return `"${safe.replace(/"/g, '""')}"`
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = await useDb()
  const { where, params, today } = invoiceFilters(user, getQuery(event), { status: true })
  const rows = await db.prepare(`
    ${INVOICE_LIST_SELECT.replace('FROM invoices i', 'FROM invoices i JOIN accounts a ON a.id = i.account_id').replace('SELECT i.*,', 'SELECT i.*, a.name AS account_name,')}
    WHERE ${where} ORDER BY i.issue_date DESC, i.created_at DESC
  `).all(today, ...params) as Record<string, any>[]

  const header = [
    'Number',
    'Account',
    'Customer',
    'Status',
    'Issued',
    'Due',
    'Currency',
    'Total',
    'Paid',
    'Balance',
  ]
  const lines = rows.map((r) => {
    const inv = mapInvoiceListItem(r)
    return [
      inv.number,
      r.account_name,
      inv.customerName,
      STATUS_STYLE[inv.status].label,
      inv.issueDate,
      inv.dueDate,
      inv.currency,
      formatMoney(inv.total),
      formatMoney(inv.amountPaid),
      formatMoney(inv.total - inv.amountPaid),
    ].map(cell).join(',')
  })

  setResponseHeaders(event, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="invoices-${today}.csv"`,
  })
  return [
    header.map(cell).join(','),
    ...lines,
  ].join('\r\n')
})
