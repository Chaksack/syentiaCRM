import type { AccountSummary, SessionUser } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<{ user: SessionUser | null, accounts: AccountSummary[] }> => {
  const user = await getSessionUser(event)
  if (!user)
    return { user: null, accounts: [] }
  const db = await useDb()
  const accounts = await listAccounts(db, user.accountIds)
  return {
    user,
    accounts: accounts.map(toSummary),
  }
})
