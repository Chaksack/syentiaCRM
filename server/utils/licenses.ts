import type { H3Event } from 'h3'
import type { License, SessionUser } from '#shared/types/domain'
import { useDb } from './db'
import { getLicense } from './repo'

/** Loads a licence in one of the user's accounts, or 404s. */
export async function requireLicense(event: H3Event, user: SessionUser): Promise<License> {
  const db = await useDb()
  const license = await getLicense(db, getRouterParam(event, 'id') ?? '')
  if (!license || !user.accountIds.includes(license.accountId))
    throw createError({ statusCode: 404, statusMessage: 'Licence not found' })
  return license
}
