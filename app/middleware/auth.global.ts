import type { Permission } from '#shared/utils/permissions'

const PUBLIC = [/^\/login$/, /^\/invite\//]

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, refresh, can } = useAuth()
  if (!loaded.value)
    await refresh()

  const isPublic = PUBLIC.some(re => re.test(to.path))
  if (!user.value && !isPublic) {
    return navigateTo({
      path: '/login',
      query: to.fullPath !== '/'
        ? { next: to.fullPath }
        : undefined,
    })
  }
  if (user.value && to.path === '/login')
    return navigateTo('/')

  const needs = to.meta.permission as Permission | undefined
  if (needs && !can(needs))
    return navigateTo('/')
})
