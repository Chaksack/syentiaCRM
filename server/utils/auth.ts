import type { H3Event } from 'h3'
import type { Role, SessionUser } from '#shared/types/domain'
import type { Permission } from '#shared/utils/permissions'
import { can } from '#shared/utils/permissions'

declare module 'h3' {
  interface H3EventContext {
    /** Memoised by getSessionUser for the rest of the request; null = signed out. */
    user?: SessionUser | null
  }
}

interface SessionData {
  userId?: string
}

const DEV_SESSION_PASSWORD = 'dev-only-session-password-change-me-0123456789'
let warned = false

function sessionPassword(): string {
  const { sessionPassword } = useRuntimeConfig()
  if (sessionPassword && sessionPassword.length >= 32)
    return sessionPassword
  if (!import.meta.dev)
    throw createError({ statusCode: 500, statusMessage: 'NUXT_SESSION_PASSWORD must be set (32+ characters)' })
  if (!warned) {
    console.warn('[auth] NUXT_SESSION_PASSWORD is not set — using an insecure development key.')
    warned = true
  }
  return DEV_SESSION_PASSWORD
}

export function useAppSession(event: H3Event) {
  return useSession<SessionData>(event, {
    password: sessionPassword(),
    name: 'syentia_session',
    maxAge: 60 * 60 * 24 * 14,
    cookie: { sameSite: 'lax', secure: !import.meta.dev, httpOnly: true },
  })
}

interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  title: string
  status: string
  avatar_color: string
}

/**
 * Who is making this request, loaded fresh from the database every time so that a role change,
 * account change or suspension takes effect immediately.
 */
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  if (event.context.user !== undefined)
    return event.context.user as SessionUser | null

  const session = await useAppSession(event)
  const userId = session.data.userId
  let user: SessionUser | null = null

  if (userId) {
    const db = await useDb()
    const row = await db.prepare('SELECT id, name, email, role, title, status, avatar_color FROM users WHERE id = ?').get(userId) as UserRow | undefined
    if (row && row.status === 'active') {
      user = {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        title: row.title,
        avatarColor: row.avatar_color,
        accountIds: await accessibleAccountIds(row.id, row.role),
      }
    }
  }

  event.context.user = user
  return user
}

export async function accessibleAccountIds(userId: string, role: Role): Promise<string[]> {
  const db = await useDb()
  const rows = role === 'admin'
    ? await db.prepare('SELECT id FROM accounts ORDER BY is_primary DESC, created_at').all()
    : await db.prepare(`
        SELECT a.id FROM accounts a
        JOIN user_accounts ua ON ua.account_id = a.id
        WHERE ua.user_id = ?
        ORDER BY a.is_primary DESC, a.created_at
      `).all(userId)
  return (rows as { id: string }[]).map(r => r.id)
}

/** The signed-in user, or a 401. With a permission, also a 403 if their role lacks it. */
export async function requireUser(event: H3Event, permission: Permission = 'view'): Promise<SessionUser> {
  const user = await getSessionUser(event)
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Sign in to continue' })
  if (!can(user.role, permission))
    throw createError({ statusCode: 403, statusMessage: 'Your role doesn’t allow this' })
  return user
}

export function assertAccountAccess(user: SessionUser, accountId: string | null | undefined): asserts accountId is string {
  if (!accountId || !user.accountIds.includes(accountId))
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
}

/** `?account=` if given (and allowed), otherwise every account the user can see. */
export function accountScope(user: SessionUser, requested: unknown): string[] {
  if (typeof requested === 'string' && requested && requested !== 'all') {
    assertAccountAccess(user, requested)
    return [requested]
  }
  return user.accountIds
}

/** `?, ?, ?` for an IN (...) clause. */
export function placeholders(values: unknown[]): string {
  return values.length
    ? values.map(() => '?').join(', ')
    : 'NULL'
}
