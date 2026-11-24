import type { DashboardData, FollowUp } from '#shared/types/domain'
import { addDays, daysBetween, formatDate, formatMoney, monthLabel, monthLong, RENEWAL_WINDOW_DAYS, todayIso } from '#shared/utils/format'

const WEEKDAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
]

type Row = Record<string, any>

export default defineEventHandler(async (event): Promise<DashboardData> => {
  const user = await requireUser(event)
  const requested = getQuery(event).account
  const accountId = typeof requested === 'string' && requested
    ? requested
    : user.accountIds[0]
  assertAccountAccess(user, accountId)

  const db = await useDb()
  const today = todayIso()
  const monthStart = `${today.slice(0, 7)}-01`
  const n = (v: unknown) => Number(v ?? 0)

  // Six calendar months ending this month.
  const [year, month] = today.split('-').map(Number) as [number, number]
  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(year, month - 6 + k, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const since = `${months[0]}-01`

  // Independent queries run in parallel — each is a network round trip on a hosted database.
  const [account, outstanding, overdue, collected, customers, recent, invoiced, paid, late, tasks, renewals] = await Promise.all([
    getAccount(db, accountId),
    db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total - amount_paid), 0) AS s FROM invoices WHERE account_id = ? AND status = 'sent'`).get(accountId),
    db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total - amount_paid), 0) AS s FROM invoices WHERE account_id = ? AND status = 'sent' AND due_date < ?`).get(accountId, today),
    db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM payments WHERE account_id = ? AND paid_at >= ?`).get(accountId, monthStart),
    db.prepare(`
      SELECT COUNT(*) AS c, COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS added
      FROM customers WHERE account_id = ? AND stage IN ('active', 'at_risk')
    `).get(monthStart, accountId),
    db.prepare(`${INVOICE_LIST_SELECT} WHERE i.account_id = ? ORDER BY i.created_at DESC LIMIT 5`).all(today, accountId),
    db.prepare(`
      SELECT SUBSTR(issue_date, 1, 7) AS m, COALESCE(SUM(total), 0) AS s FROM invoices
      WHERE account_id = ? AND status <> 'draft' AND issue_date >= ? GROUP BY 1
    `).all(accountId, since),
    db.prepare(`
      SELECT SUBSTR(paid_at, 1, 7) AS m, COALESCE(SUM(amount), 0) AS s FROM payments
      WHERE account_id = ? AND paid_at >= ? GROUP BY 1
    `).all(accountId, since),
    db.prepare(`
      SELECT i.id, i.number, i.due_date, i.total - i.amount_paid AS balance, i.currency, c.name AS customer
      FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.account_id = ? AND i.status = 'sent' AND i.due_date < ? ORDER BY i.due_date LIMIT 5
    `).all(accountId, today),
    db.prepare(`
      SELECT id, title, due_date FROM tasks WHERE account_id = ? AND done = 0
      ORDER BY due_date IS NULL, due_date, created_at LIMIT 8
    `).all(accountId),
    // Live licences that have lapsed or renew within the window.
    db.prepare(`
      SELECT l.id, l.name, l.renewal_date, l.auto_renew, c.name AS customer FROM licenses l
      LEFT JOIN customers c ON c.id = l.customer_id
      WHERE l.account_id = ? AND l.cancelled = 0 AND l.renewal_date IS NOT NULL AND l.renewal_date <= ?
      ORDER BY l.renewal_date LIMIT 5
    `).all(accountId, addDays(today, RENEWAL_WINDOW_DAYS)),
  ]) as [Awaited<ReturnType<typeof getAccount>>, Row, Row, Row, Row, Row[], Row[], Row[], Row[], Row[], Row[]]

  const plural = (count: number, word: string) => `${count} ${word}${count === 1
    ? ''
    : 's'}`
  const kpis: DashboardData['kpis'] = [
    {
      label: 'Outstanding',
      value: n(outstanding.s),
      money: true,
      note: plural(n(outstanding.c), 'open invoice'),
    },
    {
      label: `Collected in ${monthLong(month - 1)}`,
      value: n(collected.s),
      money: true,
      note: `${plural(n(collected.c), 'payment')} received`,
    },
    {
      label: 'Overdue',
      value: n(overdue.s),
      money: true,
      note: `${plural(n(overdue.c), 'invoice')} past due`,
    },
    {
      label: 'Active customers',
      value: n(customers.c),
      money: false,
      note: `${n(customers.added)} added this month`,
    },
  ]

  const chart = months.map(m => ({
    month: monthLabel(Number(m.slice(5, 7)) - 1),
    invoiced: n(invoiced.find(r => r.m === m)?.s),
    collected: n(paid.find(r => r.m === m)?.s),
  }))

  const followUps: FollowUp[] = late.map((r) => {
    const days = daysBetween(r.due_date, today)
    return {
      id: `inv-${r.id}`,
      href: `/invoices/${r.id}`,
      title: `Chase ${r.customer ?? 'customer'} on ${r.number}`,
      meta: `${plural(days, 'day')} overdue · ${formatMoney(n(r.balance), r.currency)}`,
      tone: 'urgent',
    }
  })
  for (const l of renewals) {
    const days = daysBetween(today, l.renewal_date)
    const when = days < 0
      ? `Expired ${plural(-days, 'day')} ago`
      : days === 0
        ? 'Renews today'
        : `Renews in ${plural(days, 'day')} · ${formatDate(l.renewal_date, 'day')}`
    const autoRenew = l.auto_renew === true || Number(l.auto_renew) === 1
    followUps.push({
      id: `lic-${l.id}`,
      href: `/licenses?id=${l.id}`,
      title: `Renew ${l.name}${l.customer
        ? ` for ${l.customer}`
        : ''}`,
      meta: autoRenew && days >= 0
        ? `${when} · auto-renews`
        : when,
      tone: days <= 7 && !(autoRenew && days >= 0)
        ? 'urgent'
        : 'normal',
    })
  }
  for (const t of tasks) {
    let meta = 'No due date'
    if (t.due_date) {
      const [y, m, d] = String(t.due_date).split('-').map(Number) as [number, number, number]
      meta = t.due_date < today
        ? `Was due ${formatDate(t.due_date, 'day')}`
        : `Due ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${formatDate(t.due_date, 'day')}`
    }
    followUps.push({
      id: `task-${t.id}`,
      taskId: t.id,
      title: t.title,
      meta,
      tone: t.due_date && t.due_date <= addDays(today, 7)
        ? 'normal'
        : 'quiet',
    })
  }

  const setupMissing = [
    !account!.legalName && 'legal name',
    !account!.address && 'address',
    !account!.email && 'billing email',
    !account!.paymentDetails && 'payment details',
  ].filter((v): v is string => !!v)

  return {
    account: toSummary(account!),
    setupMissing,
    kpis,
    recentInvoices: recent.map(mapInvoiceListItem),
    chart,
    followUps,
  }
})
