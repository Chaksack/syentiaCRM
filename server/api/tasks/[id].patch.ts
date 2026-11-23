import { taskUpdateSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'viewer')
    throw createError({ statusCode: 403, statusMessage: 'Your role doesn’t allow this' })
  const { done } = await readInput(event, taskUpdateSchema)
  const db = await useDb()
  const task = await db.prepare('SELECT account_id FROM tasks WHERE id = ?').get(getRouterParam(event, 'id') ?? '') as { account_id: string } | undefined
  if (!task)
    throw createError({ statusCode: 404, statusMessage: 'Follow-up not found' })
  assertAccountAccess(user, task.account_id)
  await db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(done ? 1 : 0, getRouterParam(event, 'id'))
  return { ok: true }
})
