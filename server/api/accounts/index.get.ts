export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = await useDb()
  return { accounts: await listAccounts(db, user.accountIds) }
})
