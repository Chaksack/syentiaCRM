import type { Permission } from '#shared/utils/permissions'

declare module '#app' {
  interface PageMeta {
    /** Pages that need more than the default `view` permission. */
    permission?: Permission
  }
}

export {}
