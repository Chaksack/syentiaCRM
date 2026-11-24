export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id')
  assertAccountAccess(user, id)
  const column = getQuery(event).variant === 'light'
    ? 'logo_light_key'
    : 'logo_key'
  const db = await useDb()
  const previous = await db.prepare(`SELECT ${column} AS k FROM accounts WHERE id = ?`).get(id) as { k: string | null }
  await db.prepare(`UPDATE accounts SET ${column} = NULL WHERE id = ?`).run(id)
  await deleteUpload(previous?.k)
  return { account: await getAccount(db, id) }
})
