import type { AccountSummary, SessionUser } from '#shared/types/domain'
import type { Permission } from '#shared/utils/permissions'
import { can as roleCan } from '#shared/utils/permissions'

export function useAuth() {
  const user = useState<SessionUser | null>('auth:user', () => null)
  const accounts = useState<AccountSummary[]>('auth:accounts', () => [])
  const loaded = useState<boolean>('auth:loaded', () => false)

  async function refresh() {
    // useRequestFetch forwards the browser's cookies during server rendering.
    const data = await useRequestFetch()('/api/auth/me')
    user.value = data.user
    accounts.value = data.accounts
    loaded.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    accounts.value = []
    await navigateTo('/login')
  }

  const can = (permission: Permission) => roleCan(user.value?.role, permission)

  return {
    user,
    accounts,
    loaded,
    refresh,
    logout,
    can,
  }
}
