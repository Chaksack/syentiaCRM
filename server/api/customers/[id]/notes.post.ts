import { noteSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const customer = await requireCustomer(event, user)
  const { type, body } = await readInput(event, noteSchema)
  const db = await useDb()
  const text = type === 'call'
    ? `Call logged: ${body}`
    : body
  await logActivity(db, {
    accountId: customer.accountId,
    customerId: customer.id,
    userId: user.id,
    type,
    body: text,
  })
  setResponseStatus(event, 201)
  return { ok: true }
})
