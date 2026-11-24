import type { Buffer } from 'node:buffer'
import process from 'node:process'
import { del, get, put } from '@vercel/blob'

/**
 * Where uploaded media (account logos) lives. The database stores a bare key (`logo_….png`); the
 * browser always loads it from `/uploads/<key>` (server/routes/uploads/[key].get.ts), which adds the
 * headers that keep uploaded SVGs inert.
 *
 * - With a Vercel Blob token (`KOLA_READ_WRITE_TOKEN`, or the default `BLOB_READ_WRITE_TOKEN`) files
 *   go to the Blob store under `uploads/`. The store is private, so files are only reachable through
 *   that route, never by a direct Blob URL.
 * - Without one (local development) they go to Nitro's `uploads` storage in `.data/uploads`.
 */

const BLOB_FOLDER = 'uploads'

function blobToken(): string {
  return process.env.KOLA_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || ''
}

const blobPath = (key: string) => `${BLOB_FOLDER}/${key}`

function describe(error: unknown) {
  return error instanceof Error
    ? error.message
    : error
}

/** Saves a file under `key` (already unique). */
export async function saveUpload(key: string, data: Buffer, contentType: string): Promise<void> {
  const token = blobToken()
  if (!token) {
    await useStorage('uploads').setItemRaw(key, data)
    return
  }
  try {
    await put(blobPath(key), data, {
      access: 'private',
      token,
      contentType,
      addRandomSuffix: false,
    })
  }
  catch (error) {
    console.error('[uploads] Vercel Blob upload failed:', describe(error))
    throw createError({ statusCode: 502, statusMessage: 'Couldn’t store the file. Try again in a moment.' })
  }
}

/** The file's bytes (a stream from Blob, a buffer locally), or null if there's no such file. */
export async function readUpload(key: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  const token = blobToken()
  if (token) {
    const blob = await get(blobPath(key), { access: 'private', token }).catch((error) => {
      console.warn('[uploads] Vercel Blob read failed for', key, describe(error))
      return null
    })
    if (blob?.statusCode === 200)
      return blob.stream
  }
  // Also covers files saved locally before Blob was configured.
  return await useStorage('uploads').getItemRaw<Buffer>(key)
}

/** Removes a stored file. Best effort: a failure is logged, never shown to the user. */
export async function deleteUpload(key: string | null | undefined): Promise<void> {
  if (!key)
    return
  try {
    if (blobToken()) {
      await del(blobPath(key), {
        token: blobToken(),
      })
    }
    else {
      await useStorage('uploads').removeItem(key)
    }
  }
  catch (error) {
    console.warn('[uploads] Couldn’t delete', key, describe(error))
  }
}

/** The URL a browser loads a stored file from. */
export function uploadUrl(key: string | null | undefined): string | null {
  return key
    ? `/uploads/${key}`
    : null
}
