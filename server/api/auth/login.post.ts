import { loginSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const { email, password } = await readInput(event, loginSchema)
  const db = await useDb()
  const row = await db.prepare('SELECT id, status, password_hash FROM users WHERE email = ?').get(email) as
    { id: string, status: string, password_hash: string | null } | undefined

  // Same message whether the email is unknown or the password is wrong.
  if (!row || !(await verifyPassword(password, row.password_hash)))
    throw createError({ statusCode: 401, statusMessage: 'That email and password don’t match' })
  if (row.status !== 'active')
    throw createError({ statusCode: 403, statusMessage: 'This account is suspended. Ask an admin to restore it.' })

  const session = await useAppSession(event)
  await session.update({ userId: row.id })
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), row.id)
  event.context.user = undefined
  return { user: await getSessionUser(event) }
})
