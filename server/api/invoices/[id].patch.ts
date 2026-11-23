import { invoiceTotals, lineAmount } from '#shared/utils/format'
import { invoiceUpdateSchema } from '#shared/utils/schemas'

/** Autosave target for the draft editor. Switching account re-numbers the draft from the new account. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'invoices.write')
  const invoice = await requireInvoice(event, user)
  requireDraft(invoice)
  const input = await readInput(event, invoiceUpdateSchema)
  const db = await useDb()

  const accountId = input.accountId ?? invoice.accountId
  assertAccountAccess(user, accountId)
  const customerId = input.customerId !== undefined
    ? input.customerId
    : invoice.customerId
  if (customerId) {
    const customer = await getCustomer(db, customerId)
    if (!customer || customer.accountId !== accountId)
      throw createError({ statusCode: 400, statusMessage: 'That customer belongs to a different account' })
  }

  const items = input.items ?? invoice.items
  const taxRate = input.taxRate ?? invoice.taxRate
  const { subtotal, tax, total } = invoiceTotals(items, taxRate)

  await transaction(db, async (tx) => {
    const number = accountId !== invoice.accountId
      ? await allocateInvoiceNumber(tx, accountId)
      : invoice.number
    await tx.prepare(`
      UPDATE invoices SET account_id = ?, customer_id = ?, number = ?, currency = ?, issue_date = ?, due_date = ?, template = ?,
        notes = ?, tax_rate = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
      WHERE id = ?
    `).run(
      accountId,
      customerId,
      number,
      input.currency ?? invoice.currency,
      input.issueDate !== undefined
        ? input.issueDate
        : invoice.issueDate,
      input.dueDate !== undefined
        ? input.dueDate
        : invoice.dueDate,
      input.template ?? invoice.template,
      input.notes ?? invoice.notes,
      taxRate,
      subtotal,
      tax,
      total,
      nowIso(),
      invoice.id,
    )
    if (input.items) {
      await tx.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id)
      for (const [position, item] of input.items.entries()) {
        await tx.prepare('INSERT INTO invoice_items (id, invoice_id, position, description, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(newId('itm'), invoice.id, position, item.description, item.quantity, item.rate, lineAmount(item.quantity, item.rate))
      }
    }
  })

  return { invoice: await getInvoice(db, invoice.id) }
})
