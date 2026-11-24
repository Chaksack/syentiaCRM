import type { Project } from '#shared/types/domain'

/** Every project in the account, with its recurring costs; `?customer=` narrows to one customer. */
export default defineEventHandler(async (event): Promise<{ projects: Project[] }> => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const accounts = accountScope(user, query.account)
  const db = await useDb()

  const where = [`p.account_id IN (${placeholders(accounts)})`]
  const params: unknown[] = [...accounts]
  if (typeof query.customer === 'string' && query.customer) {
    where.push('p.customer_id = ?')
    params.push(query.customer)
  }
  const rows = await db.prepare(`${PROJECT_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC`).all(...params)
  return { projects: await hydrateProjects(db, rows) }
})
