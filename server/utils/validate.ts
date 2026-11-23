import type { H3Event } from 'h3'
import type { z } from 'zod'

/** Reads and validates a JSON body; a failure is a 422 whose message is the first problem, ready to show in a form. */
export async function readInput<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  const body = await readBody(event).catch(() => undefined)
  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    const issue = result.error.issues[0]
    throw createError({
      statusCode: 422,
      statusMessage: issue?.message ?? 'Check the form and try again',
      data: {
        field: issue?.path.join('.'),
        issues: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    })
  }
  return result.data
}
