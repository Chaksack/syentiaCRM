export default defineEventHandler(async (event) => {
  const member = await findInvite(getRouterParam(event, 'token'))
  return { name: member.name, email: member.email }
})
