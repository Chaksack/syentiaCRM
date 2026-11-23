/** Issues a fresh invite link (the old one stops working). */
export default defineEventHandler(async (event) => {
  await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id') ?? ''
  const db = await useDb()
  const row = await db.prepare('SELECT name, email, status FROM users WHERE id = ?').get(id) as { name: string, email: string, status: string } | undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Team member not found' })
  if (row.status !== 'invited')
    throw createError({ statusCode: 409, statusMessage: 'They’ve already joined.' })
  const token = randomToken()
  await db.prepare('UPDATE users SET invite_token = ?, invite_expires_at = ? WHERE id = ?')
    .run(token, new Date(Date.now() + 7 * 86_400_000).toISOString(), id)
  return { invite: await deliverInvite(row, token) }
})
