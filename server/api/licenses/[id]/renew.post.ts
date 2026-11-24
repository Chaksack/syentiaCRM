import { addMonths, CYCLE_MONTHS, formatDate } from '#shared/utils/format'

/** Records a renewal: moves the renewal date on by one billing cycle (and un-cancels the licence). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const license = await requireLicense(event, user)
  if (!license.renewalDate)
    throw createError({ statusCode: 400, statusMessage: 'This licence has no renewal date to move on' })

  const renewalDate = addMonths(license.renewalDate, CYCLE_MONTHS[license.cycle])
  const db = await useDb()
  await db.prepare('UPDATE licenses SET renewal_date = ?, cancelled = 0, updated_at = ? WHERE id = ?')
    .run(renewalDate, nowIso(), license.id)
  if (license.customerId) {
    await logActivity(db, {
      accountId: license.accountId,
      customerId: license.customerId,
      userId: user.id,
      type: 'license_renewed',
      body: `Licence renewed: ${license.name}, now to ${formatDate(renewalDate)}`,
    })
  }
  return { license: await getLicense(db, license.id) }
})
