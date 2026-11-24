import { projectUpdateSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const project = await requireProject(event, user)
  const input = await readInput(event, projectUpdateSchema)
  await assertCustomerInAccount(input.customerId, project.accountId)
  await assertOwner(input.ownerId)

  const db = await useDb()
  await transaction(db, async (tx) => {
    await tx.prepare(`
      UPDATE projects SET customer_id = ?, name = ?, description = ?, status = ?, start_date = ?, end_date = ?, owner_id = ?,
        currency = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.customerId,
      input.name,
      input.description,
      input.status,
      input.startDate,
      input.endDate,
      input.ownerId,
      input.currency,
      nowIso(),
      project.id,
    )
    await saveProjectCosts(tx, project.id, input.costs)
    await logActivity(tx, {
      accountId: project.accountId,
      customerId: input.customerId,
      userId: user.id,
      type: 'project_updated',
      body: project.status !== input.status
        ? `Project ${input.name} moved to ${input.status.replace('_', ' ')}`
        : `Project updated: ${input.name}`,
    })
  })
  return { project: await getProject(db, project.id) }
})
