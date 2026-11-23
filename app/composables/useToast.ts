export interface Toast {
  id: number
  text: string
  tone: 'success' | 'error'
}

let nextId = 1

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function push(text: string, tone: Toast['tone'] = 'success') {
    const id = nextId++
    toasts.value = [
      ...toasts.value,
      { id, text, tone },
    ]
    setTimeout(dismiss, tone === 'error'
      ? 6000
      : 3500, id)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (t: string) => push(t),
    error: (t: string) => push(t, 'error'),
    dismiss,
  }
}

/** The human-readable message from a failed $fetch call. */
export function errorMessage(error: unknown): string {
  const e = error as { data?: { statusMessage?: string, message?: string }, statusMessage?: string, message?: string }
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || 'Something went wrong. Try again.'
}
