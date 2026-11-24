import type { License } from '#shared/types/domain'
import { todayIso } from '#shared/utils/format'

/** Every licence in the account; the page filters and totals them (an account holds dozens, not thousands). */
export default defineEventHandler(async (event): Promise<{ licenses: License[] }> => {
  const user = await requireUser(event)
  const accounts = accountScope(user, getQuery(event).account)
  const db = await useDb()
  const rows = await db.prepare(`${LICENSE_SELECT} WHERE l.account_id IN (${placeholders(accounts)}) ${LICENSE_ORDER}`).all(...accounts)
  const today = todayIso()
  return {
    licenses: rows.map(r => mapLicense(r, today)),
  }
})
