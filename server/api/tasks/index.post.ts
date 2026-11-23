import { taskSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'viewer')
    throw createError({ statusCode: 403, statusMessage: 'Your role doesn’t allow this' })
  const input = await readInput(event, taskSchema)
  assertAccountAccess(user, input.accountId)
  const db = await useDb()
  const id = newId('tsk')
  await db.prepare('INSERT INTO tasks (id, account_id, customer_id, title, due_date, done, created_by, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
    .run(id, input.accountId, input.customerId, input.title, input.dueDate, user.id, nowIso())
  setResponseStatus(event, 201)
  return { id }
})
