import { z } from 'zod'
import { customerSchema } from '#shared/utils/schemas'

const bodySchema = z.object({
  accountId: z.string().min(1),
  csv: z.string().max(2_000_000),
})

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      }
      else if (ch === '"') {
        quoted = false
      }
      else {
        field += ch
      }
    }
    else if (ch === '"') { quoted = true }
    else if (ch === ',') {
      row.push(field)
      field = ''
    }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n')
        i++
      row.push(field)
      if (row.some(f => f.trim()))
        rows.push(row)
      row = []
      field = ''
    }
    else { field += ch }
  }
  row.push(field)
  if (row.some(f => f.trim()))
    rows.push(row)
  return rows
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  company: 'name',
  customer: 'name',
  contact: 'contactName',
  contact_name: 'contactName',
  contactname: 'contactName',
  role: 'contactRole',
  contact_role: 'contactRole',
  title: 'contactRole',
  email: 'email',
  phone: 'phone',
  address: 'address',
  industry: 'industry',
  stage: 'stage',
  tags: 'tags',
}

/** Columns (header row required): name, contact, role, email, phone, address, industry, stage, tags (semicolon-separated). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'customers.write')
  const { accountId, csv } = await readInput(event, bodySchema)
  assertAccountAccess(user, accountId)

  const [header, ...rows] = parseCsv(csv)
  if (!header)
    throw createError({ statusCode: 400, statusMessage: 'The file is empty' })
  const keys = header.map(h => HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, '_')] ?? null)
  if (!keys.includes('name'))
    throw createError({ statusCode: 400, statusMessage: 'Add a “name” column to the header row' })

  const db = await useDb()
  const errors: { row: number, message: string }[] = []
  let imported = 0

  await transaction(db, async (tx) => {
    for (const [index, cells] of rows.entries()) {
      const raw: Record<string, unknown> = { accountId }
      keys.forEach((key, i) => {
        if (key)
          raw[key] = (cells[i] ?? '').trim()
      })
      if (typeof raw.tags === 'string')
        raw.tags = raw.tags.split(';').map(t => t.trim()).filter(Boolean)
      if (typeof raw.stage === 'string')
        raw.stage = raw.stage.toLowerCase().replace(/\s+/g, '_') || undefined

      const parsed = customerSchema.safeParse(raw)
      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues[0]?.message ?? 'Invalid row' })
        continue
      }
      const c = parsed.data
      const id = newId('cus')
      await tx.prepare(`
        INSERT INTO customers (id, account_id, name, industry, contact_name, contact_role, email, phone, address, stage, owner_id, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, accountId, c.name, c.industry, c.contactName, c.contactRole, c.email, c.phone, c.address, c.stage, user.id, JSON.stringify(c.tags), nowIso())
      await logActivity(tx, {
        accountId,
        customerId: id,
        userId: user.id,
        type: 'customer_created',
        body: 'Imported from CSV',
      })
      imported++
    }
  })

  return { imported, errors }
})
