import { memberUpdateSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const admin = await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id') ?? ''
  const input = await readInput(event, memberUpdateSchema)
  const db = await useDb()
  const member = (await listMembers(db)).find(m => m.id === id)
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Team member not found' })

  // Never leave the workspace without an active admin.
  const losesAdmin = member.role === 'admin' && member.status === 'active'
    && ((input.role && input.role !== 'admin') || (input.status && input.status !== 'active'))
  if (losesAdmin) {
    const admins = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = \'admin\' AND status = \'active\'').get() as { n: number | string }
    if (Number(admins.n) <= 1)
      throw createError({ statusCode: 409, statusMessage: 'Make someone else an admin first — there must always be one.' })
  }
  if (id === admin.id && input.status && input.status !== 'active')
    throw createError({ statusCode: 409, statusMessage: 'You can’t suspend yourself.' })
  if (input.status === 'active' && member.status === 'invited')
    throw createError({ statusCode: 409, statusMessage: 'Invited people become active when they accept their invite.' })

  const role = input.role ?? member.role
  if (input.accountIds) {
    for (const accountId of input.accountIds) assertAccountAccess(admin, accountId)
    if (role !== 'admin' && !input.accountIds.length)
      throw createError({ statusCode: 422, statusMessage: 'Give access to at least one account.' })
  }

  await transaction(db, async (tx) => {
    await tx.prepare('UPDATE users SET name = ?, title = ?, phone = ?, role = ?, status = ? WHERE id = ?').run(
      input.name ?? member.name,
      input.title ?? member.title,
      input.phone ?? member.phone,
      role,
      input.status ?? member.status,
      id,
    )
    if (input.accountIds) {
      await tx.prepare('DELETE FROM user_accounts WHERE user_id = ?').run(id)
      for (const accountId of input.accountIds)
        await tx.prepare('INSERT INTO user_accounts (user_id, account_id) VALUES (?, ?)').run(id, accountId)
    }
  })

  return {
    member: (await listMembers(db)).find(m => m.id === id),
  }
})
