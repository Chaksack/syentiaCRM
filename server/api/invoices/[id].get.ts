export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { invoice: await requireInvoice(event, user) }
})
