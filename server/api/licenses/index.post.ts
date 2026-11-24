import { licenseSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const input = await readInput(event, licenseSchema)
  assertAccountAccess(user, input.accountId)
  await assertCustomerInAccount(input.customerId, input.accountId)

  const db = await useDb()
  const id = newId('lic')
  const now = nowIso()
  await db.prepare(`
    INSERT INTO licenses (id, account_id, customer_id, name, issuer, reference, start_date, renewal_date, cycle, cost, currency,
      auto_renew, cancelled, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.accountId,
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
    user.id,
    now,
    now,
  )
  if (input.customerId) {
    await logActivity(db, {
      accountId: input.accountId,
      customerId: input.customerId,
      userId: user.id,
      type: 'license_created',
      body: `Licence added: ${input.name}`,
    })
  }
  setResponseStatus(event, 201)
  return { license: await getLicense(db, id) }
})
