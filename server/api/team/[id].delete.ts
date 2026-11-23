/** Withdraws an invite. Active members are suspended instead, so their history stays attributed. */
export default defineEventHandler(async (event) => {
  await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id') ?? ''
  const db = await useDb()
  const row = await db.prepare('SELECT status FROM users WHERE id = ?').get(id) as { status: string } | undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Team member not found' })
  if (row.status !== 'invited')
    throw createError({ statusCode: 409, statusMessage: 'Only pending invites can be withdrawn. Suspend active members instead.' })
  await db.prepare('DELETE FROM user_accounts WHERE user_id = ?').run(id)
  await db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return { ok: true }
})
