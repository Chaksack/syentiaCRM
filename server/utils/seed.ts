import type { Db } from './db'
import { newId, nowIso } from './db'
import { hashPassword, randomToken } from './password'

/**
 * First-run setup: the first admin (NUXT_SEED_ADMIN_*) and one blank billing account to fill in on
 * Accounts & branding. Runs only when the users table is empty, inside the startup transaction
 * (see initialise in db.ts).
 */
export async function seedDatabase(db: Db) {
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number | string }
  if (Number(existing.n) > 0)
    return

  const config = useRuntimeConfig()
  const email = String(config.seedAdminEmail || '').trim().toLowerCase()
  if (!email)
    throw new Error('Set NUXT_SEED_ADMIN_EMAIL to create the first admin.')

  let password = String(config.seedAdminPassword || '')
  if (!password) {
    password = randomToken(12)
    console.warn(`\n[seed] Created admin ${email} with password: ${password}\n[seed] Change it after signing in, or set NUXT_SEED_ADMIN_PASSWORD.\n`)
  }

  const now = nowIso()
  const accountName = String(config.seedAccountName || 'My company').trim()
  const mark = accountName.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'A1'

  await db.prepare(`
    INSERT INTO accounts (id, name, mark, number_prefix, next_number, number_padding, currency, payment_terms_days,
      default_tax_rate, invoice_notes, default_template, is_primary, created_at)
    VALUES (?, ?, ?, ?, 1, 4, 'GHS', 30, 0, 'Thank you for your business.', 'ledger', 1, ?)
  `).run(newId('acc'), accountName, mark, `${mark}-${now.slice(0, 4)}-`, now)

  await db.prepare(`
    INSERT INTO users (id, name, title, email, role, status, password_hash, avatar_color, created_at)
    VALUES (?, ?, 'Admin', ?, 'admin', 'active', ?, '#cfcebc', ?)
  `).run(newId('usr'), String(config.seedAdminName || email.split('@')[0]), email, await hashPassword(password), now)
}
