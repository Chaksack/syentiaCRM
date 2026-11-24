const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const MAX_BYTES = 2 * 1024 * 1024

/** multipart/form-data with a `file` field; `?variant=light` sets the version used on coloured headers. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 'admin')
  const id = getRouterParam(event, 'id')
  assertAccountAccess(user, id)
  const light = getQuery(event).variant === 'light'

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  const ext = file?.type ? TYPES[file.type] : undefined
  if (!file || !ext)
    throw createError({ statusCode: 400, statusMessage: 'Upload a PNG, JPG, WebP or SVG image' })
  if (file.data.length > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Logos must be under 2 MB' })
  if (ext === 'svg' && /<script|on\w+\s*=|javascript:/i.test(file.data.toString('utf8')))
    throw createError({ statusCode: 400, statusMessage: 'That SVG contains scripts, which aren’t allowed' })

  const db = await useDb()
  const column = light ? 'logo_light_key' : 'logo_key'
  const previous = await db.prepare(`SELECT ${column} AS k FROM accounts WHERE id = ?`).get(id) as { k: string | null }
  const key = `${newId('logo')}.${ext}`
  await saveUpload(key, file.data, file.type!)
  await db.prepare(`UPDATE accounts SET ${column} = ? WHERE id = ?`).run(key, id)
  await deleteUpload(previous?.k)

  return { account: await getAccount(db, id) }
})
