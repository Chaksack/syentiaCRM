import type { CustomerStage } from '#shared/types/domain'
import { CUSTOMER_STAGES } from '#shared/types/domain'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const accounts = accountScope(user, query.account)
  const db = await useDb()

  const where = [`c.account_id IN (${placeholders(accounts)})`]
  const params: unknown[] = [...accounts]

  const q = typeof query.q === 'string'
    ? query.q.trim().toLowerCase()
    : ''
  if (q) {
    where.push('(LOWER(c.name) LIKE ? OR LOWER(c.contact_name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(c.phone) LIKE ?)')
    params.push(...Array.from({ length: 4 }).fill(`%${q}%`))
  }

  const stage = typeof query.stage === 'string' && (CUSTOMER_STAGES as readonly string[]).includes(query.stage)
    ? query.stage
    : null
  const listWhere = stage
    ? [...where, 'c.stage = ?']
    : where
  const listParams = stage
    ? [...params, stage]
    : params

  // Stage counts reflect the search but not the stage filter, so the chips stay meaningful.
  const [countRows, rows] = await Promise.all([
    db.prepare(`SELECT c.stage, COUNT(*) AS n FROM customers c WHERE ${where.join(' AND ')} GROUP BY c.stage`).all(...params),
    db.prepare(`${CUSTOMER_SELECT} WHERE ${listWhere.join(' AND ')} ORDER BY c.last_activity_at IS NULL, c.last_activity_at DESC, c.name`).all(...listParams),
  ]) as [{ stage: CustomerStage, n: number }[], Record<string, unknown>[]]

  const counts = Object.fromEntries(CUSTOMER_STAGES.map(s => [s, 0])) as Record<CustomerStage, number>
  for (const r of countRows) counts[r.stage] = Number(r.n)

  return {
    customers: rows.map(mapCustomer),
    counts: {
      all: Object.values(counts).reduce((a, b) => a + b, 0),
      ...counts,
    },
  }
})
