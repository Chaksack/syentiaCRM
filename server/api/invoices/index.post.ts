import { addDays, todayIso } from '#shared/utils/format'
import { invoiceCreateSchema } from '#shared/utils/schemas'

/** Starts a draft from the account's defaults (number, template, currency, terms, notes, tax). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'invoices.write')
  const { accountId, customerId } = await readInput(event, invoiceCreateSchema)
  assertAccountAccess(user, accountId)
  const db = await useDb()
  const account = (await getAccount(db, accountId))!

  let terms = account.paymentTermsDays
  if (customerId) {
    const customer = await getCustomer(db, customerId)
    if (!customer || customer.accountId !== accountId)
      throw createError({ statusCode: 400, statusMessage: 'That customer belongs to a different account' })
    terms = customer.paymentTermsDays ?? terms
  }

  const id = newId('inv')
  const today = todayIso()
  const now = nowIso()
  await transaction(db, async (tx) => {
    const number = await allocateInvoiceNumber(tx, accountId)
    await tx.prepare(`
      INSERT INTO invoices (id, account_id, customer_id, number, status, template, currency, issue_date, due_date, notes, tax_rate,
        subtotal, tax, total, amount_paid, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?)
    `).run(id, accountId, customerId ?? null, number, account.defaultTemplate, account.currency, today, addDays(today, terms), account.invoiceNotes, account.defaultTaxRate, user.id, now, now)
    await tx.prepare('INSERT INTO invoice_items (id, invoice_id, position, description, quantity, rate, amount) VALUES (?, ?, 0, \'\', 1, 0, 0)')
      .run(newId('itm'), id)
  })

  setResponseStatus(event, 201)
  return { invoice: await getInvoice(db, id) }
})
