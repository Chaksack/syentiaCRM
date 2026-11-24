import { licenseUpdateSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const license = await requireLicense(event, user)
  const input = await readInput(event, licenseUpdateSchema)
  await assertCustomerInAccount(input.customerId, license.accountId)

  const db = await useDb()
  await db.prepare(`
    UPDATE licenses SET customer_id = ?, name = ?, issuer = ?, reference = ?, start_date = ?, renewal_date = ?, cycle = ?,
      cost = ?, currency = ?, auto_renew = ?, cancelled = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.customerId,
    input.name,
    input.issuer,
    input.reference,
    input.startDate,
    input.renewalDate,
    input.cycle,
    input.cost,
    input.currency,
    input.autoRenew ? 1 : 0,
    input.cancelled ? 1 : 0,
    input.notes,
    nowIso(),
    license.id,
  )
  return { license: await getLicense(db, license.id) }
})
