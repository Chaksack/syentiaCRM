import { customerSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const input = await readInput(event, customerSchema)
  assertAccountAccess(user, input.accountId)
  const db = await useDb()
  await assertOwner(input.ownerId)

  const id = newId('cus')
  await db.prepare(`
    INSERT INTO customers (id, account_id, name, industry, contact_name, contact_role, email, phone, address, stage, owner_id,
      payment_terms_days, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.accountId,
    input.name,
    input.industry,
    input.contactName,
    input.contactRole,
    input.email,
    input.phone,
    input.address,
    input.stage,
    input.ownerId ?? user.id,
    input.paymentTermsDays,
    JSON.stringify(input.tags),
    nowIso(),
  )
  await logActivity(db, {
    accountId: input.accountId,
    customerId: id,
    userId: user.id,
    type: 'customer_created',
    body: 'Customer added',
  })
  setResponseStatus(event, 201)
  return { customer: await getCustomer(db, id) }
})
