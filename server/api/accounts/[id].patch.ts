import { accountSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id')
  assertAccountAccess(user, id)
  const input = await readInput(event, accountSchema)
  const db = await useDb()
  await db.prepare(`
    UPDATE accounts SET name = ?, mark = ?, legal_name = ?, tax_id = ?, address = ?, email = ?, phone = ?, color = ?,
      number_prefix = ?, next_number = ?, number_padding = ?, currency = ?, payment_terms_days = ?, default_tax_rate = ?,
      payment_details = ?, invoice_notes = ?, default_template = ?
    WHERE id = ?
  `).run(
    input.name,
    input.mark,
    input.legalName,
    input.taxId,
    input.address,
    input.email,
    input.phone,
    input.color,
    input.numberPrefix,
    input.nextNumber,
    input.numberPadding,
    input.currency,
    input.paymentTermsDays,
    input.defaultTaxRate,
    input.paymentDetails,
    input.invoiceNotes,
    input.defaultTemplate,
    id,
  )
  return { account: await getAccount(db, id) }
})
