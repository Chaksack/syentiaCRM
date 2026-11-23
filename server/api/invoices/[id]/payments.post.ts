import { formatMoney } from '#shared/utils/format'
import { paymentSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'invoices.send')
  const invoice = await requireInvoice(event, user)
  if (invoice.status === 'draft')
    throw createError({ statusCode: 409, statusMessage: 'Send the invoice before recording payments' })
  const input = await readInput(event, paymentSchema)
  const balance = invoice.total - invoice.amountPaid
  if (input.amount > balance)
    throw createError({ statusCode: 422, statusMessage: `That’s more than the ${formatMoney(balance, invoice.currency)} still owed` })

  const db = await useDb()
  await transaction(db, async (tx) => {
    await tx.prepare(`
      INSERT INTO payments (id, invoice_id, account_id, amount, method, reference, paid_at, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(newId('pay'), invoice.id, invoice.accountId, input.amount, input.method, input.reference, input.paidAt, user.id, nowIso())
    await refreshInvoicePayments(tx, invoice.id)
  })
  await logActivity(db, {
    accountId: invoice.accountId,
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    userId: user.id,
    type: 'payment',
    body: `Payment received · ${formatMoney(input.amount, invoice.currency)} on ${invoice.number}`,
  })
  setResponseStatus(event, 201)
  return { invoice: await getInvoice(db, invoice.id) }
})
