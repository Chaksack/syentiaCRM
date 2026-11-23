import type { H3Event } from 'h3'
import type { Customer, SessionUser } from '#shared/types/domain'
import { assertAccountAccess } from './auth'
import { useDb } from './db'
import { getCustomer } from './repo'

/** Loads a customer the user is allowed to see, or 404s. */
export async function requireCustomer(event: H3Event, user: SessionUser): Promise<Customer> {
  const db = await useDb()
  const customer = await getCustomer(db, getRouterParam(event, 'id') ?? '')
  if (!customer || !user.accountIds.includes(customer.accountId))
    throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
  assertAccountAccess(user, customer.accountId)
  return customer
}

export async function assertOwner(ownerId: string | null | undefined) {
  if (!ownerId)
    return
  const db = await useDb()
  const row = await db.prepare('SELECT 1 FROM users WHERE id = ?').get(ownerId)
  if (!row)
    throw createError({ statusCode: 400, statusMessage: 'Unknown owner' })
}
