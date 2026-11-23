export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'invoices.write')
  const invoice = await requireInvoice(event, user)
  if (invoice.status !== 'draft')
    throw createError({ statusCode: 409, statusMessage: 'Only drafts can be deleted' })
  const db = await useDb()
  await db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id)
  await db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id)
  return { ok: true }
})
