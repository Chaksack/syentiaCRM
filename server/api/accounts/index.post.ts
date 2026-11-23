import { accountSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  await requireUser(event, 'admin')
  const input = await readInput(event, accountSchema)
  const db = await useDb()
  const id = newId('acc')
  await db.prepare(`
    INSERT INTO accounts (id, name, mark, legal_name, tax_id, address, email, phone, color, number_prefix, next_number, number_padding,
      currency, payment_terms_days, default_adjustments, payment_details, invoice_notes, default_template, is_primary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END FROM accounts), ?)
  `).run(
    id,
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
    JSON.stringify(input.defaultAdjustments),
    input.paymentDetails,
    input.invoiceNotes,
    input.defaultTemplate,
    nowIso(),
  )
  setResponseStatus(event, 201)
  return { account: await getAccount(db, id) }
})
