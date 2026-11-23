import { formatMoney } from '#shared/utils/format'

/** Issues a draft: locks it, and logs it on the customer's timeline. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'invoices.send')
  const invoice = await requireInvoice(event, user)
  requireDraft(invoice)

  const problems: string[] = []
  if (!invoice.customerId)
    problems.push('choose a customer')
  if (!invoice.issueDate || !invoice.dueDate)
    problems.push('set the issue and due dates')
  if (invoice.issueDate && invoice.dueDate && invoice.dueDate < invoice.issueDate)
    problems.push('make the due date on or after the issue date')
  if (!invoice.items.some(i => i.description.trim() && i.amount > 0))
    problems.push('add at least one line item with an amount')
  if (problems.length)
    throw createError({ statusCode: 422, statusMessage: `Before sending, ${problems.join(', ')}.` })

  const db = await useDb()
  const now = nowIso()
  // Drop empty lines left over from editing.
  await db.prepare('DELETE FROM invoice_items WHERE invoice_id = ? AND description = \'\' AND amount = 0').run(invoice.id)
  await db.prepare('UPDATE invoices SET status = \'sent\', sent_at = ?, updated_at = ? WHERE id = ?').run(now, now, invoice.id)
  await logActivity(db, {
    accountId: invoice.accountId,
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    userId: user.id,
    type: 'invoice_sent',
    body: `Invoice ${invoice.number} sent · ${formatMoney(invoice.total, invoice.currency)}`,
  })
  return { invoice: await getInvoice(db, invoice.id) }
})
