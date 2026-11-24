import type { H3Event } from 'h3'
import type { Project, SessionUser } from '#shared/types/domain'
import { useDb } from './db'
import { getProject } from './repo'

/** Loads a project in one of the user's accounts, or 404s. */
export async function requireProject(event: H3Event, user: SessionUser): Promise<Project> {
  const db = await useDb()
  const project = await getProject(db, getRouterParam(event, 'id') ?? '')
  if (!project || !user.accountIds.includes(project.accountId))
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return project
}
