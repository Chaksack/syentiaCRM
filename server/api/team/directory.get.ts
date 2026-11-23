/** Active people who can work in the given account — for owner pickers. Visible to everyone signed in. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const accountId = getQuery(event).account
  const db = await useDb()
  const members = (await listMembers(db)).filter(m => m.status === 'active')
  const scoped = typeof accountId === 'string' && accountId
    ? (assertAccountAccess(user, accountId), members.filter(m => m.accountIds.includes(accountId)))
    : members
  return {
    people: scoped.map(m => ({ id: m.id, name: m.name })),
  }
})
