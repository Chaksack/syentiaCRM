export default defineEventHandler(async (event) => {
  await requireUser(event, 'admin')
  const db = await useDb()
  return { members: await listMembers(db) }
})
