import { acceptInviteSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const member = await findInvite(getRouterParam(event, 'token'))
  const { password } = await readInput(event, acceptInviteSchema)
  const db = await useDb()
  await db.prepare(`
    UPDATE users SET password_hash = ?, status = 'active', invite_token = NULL, invite_expires_at = NULL, last_login_at = ?
    WHERE id = ?
  `).run(await hashPassword(password), nowIso(), member.id)

  const session = await useAppSession(event)
  await session.update({ userId: member.id })
  event.context.user = undefined
  return { user: await getSessionUser(event) }
})
