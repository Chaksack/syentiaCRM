export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const license = await requireLicense(event, user)
  const db = await useDb()
  await db.prepare('DELETE FROM licenses WHERE id = ?').run(license.id)
  return { ok: true }
})
