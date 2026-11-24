export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const project = await requireProject(event, user)
  const db = await useDb()
  // Explicit, because SQLite doesn't enforce ON DELETE CASCADE unless foreign keys are switched on.
  await transaction(db, async (tx) => {
    await tx.prepare('DELETE FROM project_costs WHERE project_id = ?').run(project.id)
    await tx.prepare('DELETE FROM projects WHERE id = ?').run(project.id)
  })
  return { ok: true }
})
