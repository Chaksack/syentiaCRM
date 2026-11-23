<script setup lang="ts">
import { initials } from '#shared/utils/format'
import { ROLE_INFO } from '#shared/utils/permissions'

const { user, can, logout } = useAuth()
const { account, accounts, setAccount } = useCurrentAccount()
const route = useRoute()

const menuOpen = ref(false)
const passwordOpen = ref(false)
const userMenuOpen = ref(false)
const switcher = ref<HTMLElement>()
const userMenu = ref<HTMLElement>()

const nav = computed(() => [
  {
    to: '/',
    label: 'Dashboard',
    icon: 'dashboard' as const,
    show: true,
  },
  {
    to: '/customers',
    label: 'Customers',
    icon: 'customers' as const,
    show: true,
  },
  {
    to: '/invoices',
    label: 'Invoices',
    icon: 'invoices' as const,
    show: true,
  },
  {
    to: '/accounts',
    label: 'Accounts & branding',
    icon: 'accounts' as const,
    show: can('admin'),
  },
  {
    to: '/team',
    label: 'Team',
    icon: 'team' as const,
    show: can('admin'),
  },
].filter(i => i.show))

function isActive(to: string) {
  return to === '/'
    ? route.path === '/'
    : route.path.startsWith(to)
}

function pick(id: string) {
  setAccount(id)
  menuOpen.value = false
}

// Close menus on outside click / Esc / navigation.
function onDocClick(e: MouseEvent) {
  if (!switcher.value?.contains(e.target as Node))
    menuOpen.value = false
  if (!userMenu.value?.contains(e.target as Node))
    userMenuOpen.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false
    userMenuOpen.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
watch(() => route.fullPath, () => {
  menuOpen.value = false
  userMenuOpen.value = false
})
</script>

<template>
  <aside class="box-border flex max-w-full flex-[1_1_232px] flex-col gap-[22px] border-r border-line bg-surface px-3.5 py-5 lg:sticky lg:top-0 lg:h-screen lg:max-w-[260px]">
    <NuxtLink to="/" class="flex items-center px-2" aria-label="Syentia CRM — dashboard">
      <BrandLogo />
    </NuxtLink>

    <div v-if="account" ref="switcher" class="relative">
      <button
        type="button"
        class="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded border border-border bg-paper px-2.5 py-2 text-left"
        aria-haspopup="true" :aria-expanded="menuOpen" aria-label="Switch account"
        @click="menuOpen = !menuOpen"
      >
        <AccountMark :mark="account.mark" :color="account.color" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-medium">{{ account.name }}</span>
          <span class="truncate text-xs text-muted">{{ account.legalName || '—' }}</span>
        </span>
        <AppIcon name="updown" :size="14" />
      </button>
      <div
        v-if="menuOpen"
        class="absolute inset-x-0 top-[54px] z-10 flex flex-col gap-0.5 rounded-md border border-border bg-paper p-1.5 shadow-[0_10px_30px_rgb(38_37_30/0.12)]"
      >
        <span class="px-2 pt-1.5 pb-1 text-[11px] tracking-[0.06em] text-muted uppercase">Accounts</span>
        <button
          v-for="a in accounts" :key="a.id" type="button"
          class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded border-0 px-2 py-1.5 text-left hover:bg-surface-2"
          :class="a.id === account.id ? 'bg-surface-2' : 'bg-transparent'"
          :aria-current="a.id === account.id"
          @click="pick(a.id)"
        >
          <AccountMark :mark="a.mark" :color="a.color" :size="24" />
          <span class="flex-1">{{ a.name }}</span>
          <span v-if="a.id === account.id" class="text-xs text-muted">Active</span>
        </button>
        <template v-if="can('admin')">
          <div class="my-1 h-px bg-line" />
          <NuxtLink to="/accounts" class="px-2 py-2.5 text-[13px]">
            Manage accounts →
          </NuxtLink>
        </template>
      </div>
    </div>

    <nav aria-label="Main" class="flex flex-col gap-0.5">
      <NuxtLink
        v-for="item in nav" :key="item.to" :to="item.to"
        class="flex items-center gap-2.5 rounded p-2.5 text-ink hover:bg-surface-2 hover:text-ink"
        :class="isActive(item.to) ? 'bg-surface-3' : ''"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <AppIcon :name="item.icon" />{{ item.label }}
      </NuxtLink>
    </nav>

    <div v-if="user" ref="userMenu" class="relative mt-auto border-t border-line pt-2">
      <button
        type="button" class="flex w-full cursor-pointer items-center gap-2.5 rounded border-0 bg-transparent p-2.5 text-left hover:bg-surface-2"
        aria-haspopup="true" :aria-expanded="userMenuOpen" @click="userMenuOpen = !userMenuOpen"
      >
        <span class="flex size-7 items-center justify-center rounded-full text-xs" :style="{ background: user.avatarColor }">{{ initials(user.name) }}</span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate">{{ user.name }}</span>
          <span class="text-xs text-muted">{{ ROLE_INFO[user.role].name }}</span>
        </span>
      </button>
      <div v-if="userMenuOpen" class="absolute inset-x-0 bottom-[60px] z-10 rounded-md border border-border bg-paper p-1.5 shadow-[0_10px_30px_rgb(38_37_30/0.12)]">
        <p class="m-0 truncate px-2 py-1.5 text-xs text-muted">
          {{ user.email }}
        </p>
        <button type="button" class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded border-0 bg-transparent px-2 text-left hover:bg-surface-2" @click="passwordOpen = true; userMenuOpen = false">
          <AppIcon name="accounts" /> Change password
        </button>
        <button type="button" class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded border-0 bg-transparent px-2 text-left hover:bg-surface-2" @click="logout">
          <AppIcon name="logout" /> Sign out
        </button>
      </div>
      <ChangePasswordDialog v-model:open="passwordOpen" />
    </div>
  </aside>
</template>
