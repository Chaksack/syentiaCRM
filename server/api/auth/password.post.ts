import { changePasswordSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { currentPassword, newPassword } = await readInput(event, changePasswordSchema)
  const db = await useDb()
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string | null } | undefined
  if (!row || !(await verifyPassword(currentPassword, row.password_hash)))
    throw createError({ statusCode: 422, statusMessage: 'Your current password isn’t right' })
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(newPassword), user.id)
  return { ok: true }
})
