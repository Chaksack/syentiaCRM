import { customerUpdateSchema } from '#shared/utils/schemas'

const COLUMNS = {
  name: 'name',
  industry: 'industry',
  contactName: 'contact_name',
  contactRole: 'contact_role',
  email: 'email',
  phone: 'phone',
  address: 'address',
  stage: 'stage',
  ownerId: 'owner_id',
  paymentTermsDays: 'payment_terms_days',
  tags: 'tags',
} as const

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const customer = await requireCustomer(event, user)
  const input = await readInput(event, customerUpdateSchema)
  await assertOwner(input.ownerId)

  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = input[key as keyof typeof input]
    if (value === undefined)
      continue
    sets.push(`${column} = ?`)
    params.push(key === 'tags'
      ? JSON.stringify(value)
      : value)
  }

  const db = await useDb()
  if (sets.length) {
    await db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...params, customer.id)
    await logActivity(db, {
      accountId: customer.accountId,
      customerId: customer.id,
      userId: user.id,
      type: 'customer_updated',
      body: 'Details updated',
    })
  }
  return { customer: await getCustomer(db, customer.id) }
})
