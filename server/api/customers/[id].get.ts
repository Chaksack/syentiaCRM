import type { Activity, ActivityType, CustomerDetail } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<{ customer: CustomerDetail }> => {
  const user = await requireUser(event)
  const customer = await requireCustomer(event, user)
  const db = await useDb()

  const billed = await db.prepare(`SELECT COALESCE(SUM(total), 0) AS n FROM invoices WHERE customer_id = ? AND status <> 'draft'`)
    .get(customer.id) as { n: number | string }
  const rows = await db.prepare(`
    SELECT a.id, a.type, a.body, a.created_at, u.name AS user_name FROM activities a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.customer_id = ? ORDER BY a.created_at DESC LIMIT 50
  `).all(customer.id) as { id: string, type: ActivityType, body: string, created_at: string, user_name: string | null }[]

  const activities: Activity[] = rows.map(r => ({
    id: r.id,
    type: r.type,
    body: r.body,
    userName: r.user_name,
    createdAt: r.created_at,
  }))
  return {
    customer: {
      ...customer,
      lifetimeBilled: Number(billed.n),
      activities,
    },
  }
})
