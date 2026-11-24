const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') ?? ''
  const ext = /^[\w-]+\.(png|jpg|webp|svg)$/.exec(key)?.[1]
  if (!ext)
    throw createError({ statusCode: 404 })
  const data = await readUpload(key)
  if (!data)
    throw createError({ statusCode: 404 })
  setResponseHeaders(event, {
    'content-type': CONTENT_TYPES[ext]!,
    // Keys are never reused, so a URL's content never changes; s-maxage lets Vercel's CDN keep it
    // too, so repeat views don't invoke the function or read from Blob.
    'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    // Uploaded SVGs are rendered as images only; this stops them running anything if opened directly.
    'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
    'x-content-type-options': 'nosniff',
  })
  return data
})
