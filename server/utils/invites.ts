import { nowIso, useDb } from './db'

export async function findInvite(token: string | undefined) {
  if (!token)
    throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  const db = await useDb()
  const row = await db.prepare(`
    SELECT id, name, email, invite_expires_at FROM users WHERE invite_token = ? AND status = 'invited'
  `).get(token) as { id: string, name: string, email: string, invite_expires_at: string | null } | undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'This invite link is no longer valid' })
  if (row.invite_expires_at && row.invite_expires_at < nowIso())
    throw createError({ statusCode: 410, statusMessage: 'This invite has expired. Ask an admin to resend it.' })
  return row
}

export function inviteUrl(token: string): string {
  const { public: { siteUrl } } = useRuntimeConfig()
  return `${siteUrl.replace(/\/$/, '')}/invite/${token}`
}

/**
 * Delivers an invite. No mail provider is configured yet, so the link is logged and returned to
 * the admin to share; plug an email service in here.
 */
export async function deliverInvite(member: { name: string, email: string }, token: string) {
  const url = inviteUrl(token)
  console.warn(`[invite] ${member.name} <${member.email}>: ${url}`)
  return { url, emailed: false }
}
