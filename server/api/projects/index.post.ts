import { projectSchema } from '#shared/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const input = await readInput(event, projectSchema)
  assertAccountAccess(user, input.accountId)
  await assertCustomerInAccount(input.customerId, input.accountId)
  await assertOwner(input.ownerId)

  const db = await useDb()
  const id = newId('prj')
  const now = nowIso()
  await transaction(db, async (tx) => {
    await tx.prepare(`
      INSERT INTO projects (id, account_id, customer_id, name, description, status, start_date, end_date, owner_id, currency,
        created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.accountId,
      input.customerId,
      input.name,
      input.description,
      input.status,
      input.startDate,
      input.endDate,
      input.ownerId ?? user.id,
      input.currency,
      user.id,
      now,
      now,
    )
    await saveProjectCosts(tx, id, input.costs)
    await logActivity(tx, {
      accountId: input.accountId,
      customerId: input.customerId,
      userId: user.id,
      type: 'project_created',
      body: `Project started: ${input.name}`,
    })
  })
  setResponseStatus(event, 201)
  return { project: await getProject(db, id) }
})
