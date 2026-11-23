import { AVATAR_COLORS } from '#shared/utils/format'
import { inviteSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const admin = await requireUser(event, 'admin')
  const input = await readInput(event, inviteSchema)
  const db = await useDb()

  const existing = await db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: 'Someone with that email is already on the team.' })
  const accountIds = input.role === 'admin'
    ? []
    : input.accountIds
  for (const id of accountIds) assertAccountAccess(admin, id)

  const id = newId('usr')
  const token = randomToken()
  const count = await db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number | string }
  await transaction(db, async (tx) => {
    await tx.prepare(`
      INSERT INTO users (id, name, title, email, phone, role, status, invite_token, invite_expires_at, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?)
    `).run(id, input.name, input.title, input.email, input.phone, input.role, token, new Date(Date.now() + 7 * 86_400_000).toISOString(), AVATAR_COLORS[Number(count.n) % AVATAR_COLORS.length]!, nowIso())
    for (const accountId of accountIds)
      await tx.prepare('INSERT INTO user_accounts (user_id, account_id) VALUES (?, ?)').run(id, accountId)
  })

  const delivery = await deliverInvite(input, token)
  setResponseStatus(event, 201)
  return {
    member: (await listMembers(db)).find(m => m.id === id),
    invite: delivery,
  }
})
