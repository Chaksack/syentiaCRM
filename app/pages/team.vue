<script setup lang="ts">
import type { Member, MemberStatus, Role } from '#shared/types/domain'
import { ROLES } from '#shared/types/domain'
import { initials } from '#shared/utils/format'
import { PERMISSION_LABELS, ROLE_INFO, can as roleCan } from '#shared/utils/permissions'

definePageMeta({ permission: 'admin' })
useHead({ title: 'Team · Syentia CRM' })

const { user } = useAuth()
const { accounts } = useCurrentAccount()
const toast = useToast()
const { data, refresh } = await useFetch('/api/team', {
  default: () => ({ members: [] as Member[] }),
})

const accountById = computed(() => Object.fromEntries(accounts.value.map(a => [a.id, a])))
const { data: accountStats } = await useFetch('/api/accounts', {
  default: () => ({ accounts: [] }),
})
const customerCount = (id: string) => accountStats.value.accounts.find(a => a.id === id)?.stats.customers ?? 0

const STATUS_STYLE: Record<MemberStatus, { label: string, bg: string, fg: string }> = {
  active: { label: 'Active', bg: '#e1e9dc', fg: '#2c5527' },
  invited: { label: 'Invited', bg: '#e6e5e0', fg: '#26251e' },
  suspended: { label: 'Suspended', bg: '#f2f2ef', fg: '#5c5b56' },
}

// ── Invite form ──
function blank() {
  return {
    name: '',
    title: '',
    email: '',
    phone: '',
    role: 'sales' as Role,
    accountIds: accounts.value[0]
      ? [accounts.value[0].id]
      : [] as string[],
  }
}
const form = reactive(blank())
const error = ref('')
const sending = ref(false)
const lastInvite = ref<{ email: string, url: string } | null>(null)
const freshId = ref('')

async function invite() {
  error.value = ''
  sending.value = true
  try {
    const res = await $fetch('/api/team', { method: 'POST', body: form })
    lastInvite.value = { email: form.email, url: res.invite.url }
    freshId.value = res.member?.id ?? ''
    Object.assign(form, blank())
    await refresh()
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    sending.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Invite link copied')
  }
  catch {
    toast.error('Couldn’t copy — select the link and copy it manually.')
  }
}

// ── List ──
const search = ref('')
const members = computed(() => {
  const q = search.value.trim().toLowerCase()
  return data.value.members.filter(m => !q || `${m.name} ${m.email} ${m.title}`.toLowerCase().includes(q))
})
const activeCount = computed(() => data.value.members.filter(m => m.status === 'active').length)
const invitedCount = computed(() => data.value.members.filter(m => m.status === 'invited').length)

// ── Edit member ──
const editing = ref<Member | null>(null)
const edit = reactive({ title: '', role: 'sales' as Role, accountIds: [] as string[] })
const editOpen = ref(false)
const editError = ref('')
function openEdit(m: Member) {
  editing.value = m
  Object.assign(edit, {
    title: m.title,
    role: m.role,
    accountIds: [...m.accountIds],
  })
  editError.value = ''
  editOpen.value = true
}
async function patchMember(body: Record<string, unknown>, done: string) {
  if (!editing.value)
    return
  editError.value = ''
  try {
    await $fetch(`/api/team/${editing.value.id}`, { method: 'PATCH', body })
    await refresh()
    editOpen.value = false
    toast.success(done)
  }
  catch (e) {
    editError.value = errorMessage(e)
  }
}
function saveEdit() {
  return patchMember({
    title: edit.title,
    role: edit.role,
    ...(edit.role === 'admin'
      ? {}
      : { accountIds: edit.accountIds }),
  }, 'Member updated')
}
function setStatus(status: MemberStatus) {
  return patchMember({ status }, status === 'suspended'
    ? 'Access suspended'
    : 'Access restored')
}

async function resendInvite() {
  if (!editing.value)
    return
  try {
    const res = await $fetch(`/api/team/${editing.value.id}/invite`, { method: 'POST' })
    lastInvite.value = { email: editing.value.email, url: res.invite.url }
    editOpen.value = false
  }
  catch (e) {
    editError.value = errorMessage(e)
  }
}
async function withdrawInvite() {
  if (!editing.value)
    return
  try {
    await $fetch(`/api/team/${editing.value.id}`, { method: 'DELETE' })
    editOpen.value = false
    await refresh()
    toast.success('Invite withdrawn')
  }
  catch (e) {
    editError.value = errorMessage(e)
  }
}
</script>

<template>
  <PageMain>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Team <span class="text-faint">{{ data.members.length }}</span>
        </h1>
        <p class="m-0 text-muted">
          Add staff, choose what they can do, and decide which accounts they can work in.
        </p>
      </div>
    </header>

    <div v-if="lastInvite" role="status" class="flex flex-wrap items-center gap-3 rounded bg-success-bg px-4 py-3 text-success">
      <AppIcon name="check" />
      <span>Invite created for {{ lastInvite.email }}. Email isn’t set up yet, so share this link with them:</span>
      <code class="min-w-0 flex-1 truncate rounded bg-paper/70 px-2 py-1 text-xs text-ink">{{ lastInvite.url }}</code>
      <button type="button" class="btn btn-sm !min-h-8" @click="copy(lastInvite.url)">
        Copy link
      </button>
      <button type="button" class="cursor-pointer border-0 bg-transparent p-1 text-success" aria-label="Dismiss" @click="lastInvite = null">
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <div class="flex flex-wrap items-start gap-2.5">
      <form aria-labelledby="add-title" class="flex min-w-0 flex-[1_1_400px] flex-col gap-[22px] rounded bg-surface p-7" @submit.prevent="invite">
        <div class="flex flex-col gap-1">
          <h2 id="add-title" class="m-0 text-[22px] leading-[1.3] font-normal tracking-[-0.01em]">
            Add staff member
          </h2>
          <span class="text-[13px] text-muted">They’ll get an invite link to set a password.</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="field !text-ink-2">Full name
            <input v-model="form.name" class="input" placeholder="e.g. Kojo Antwi" required>
          </label>
          <label class="field !text-ink-2">Job title
            <input v-model="form.title" class="input" placeholder="e.g. Accounts officer">
          </label>
          <label class="field !text-ink-2">Work email
            <input v-model="form.email" class="input" type="email" placeholder="name@company.com" required>
          </label>
          <label class="field !text-ink-2">Phone <span class="text-muted">(optional)</span>
            <input v-model="form.phone" class="input" type="tel" placeholder="+233 …">
          </label>
        </div>

        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="mb-2 p-0 text-[13px] text-ink-2">
            Role
          </legend>
          <label
            v-for="r in ROLES" :key="r"
            class="flex min-h-14 cursor-pointer items-start gap-3 rounded px-3.5 py-3"
            :class="form.role === r ? 'border-[1.5px] border-ink bg-paper' : 'border border-rule'"
          >
            <input v-model="form.role" type="radio" name="role" :value="r" class="mt-1 accent-ink">
            <span class="flex flex-col"><span>{{ ROLE_INFO[r].name }}</span><span class="text-xs text-muted">{{ ROLE_INFO[r].description }}</span></span>
          </label>
        </fieldset>

        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="mb-2 p-0 text-[13px] text-ink-2">
            Account access
          </legend>
          <label
            v-for="a in accounts" :key="a.id"
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded border border-rule bg-paper px-3.5"
            :class="form.role === 'admin' ? 'opacity-60' : ''"
          >
            <input v-model="form.accountIds" type="checkbox" :value="a.id" class="accent-ink" :disabled="form.role === 'admin'">
            <AccountMark :mark="a.mark" :color="a.color" :size="24" />
            <span class="flex-1">{{ a.name }}</span><span class="text-xs text-muted">{{ customerCount(a.id) }} customers</span>
          </label>
          <span v-if="form.role === 'admin'" class="text-xs text-muted">Admins always have access to every account.</span>
        </fieldset>

        <p v-if="error" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {{ error }}
        </p>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" @click="Object.assign(form, blank()); error = ''">
            Clear
          </button>
          <button type="submit" class="btn btn-primary" :disabled="sending">
            {{ sending ? 'Sending…' : 'Send invite' }}
          </button>
        </div>
      </form>

      <section aria-label="Staff members" class="flex min-w-0 flex-[2_1_560px] flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <label class="flex min-h-11 flex-[1_1_240px] items-center gap-2 rounded bg-surface px-3.5">
            <AppIcon name="search" class="text-muted" />
            <span class="sr-only">Search staff</span>
            <input v-model="search" type="search" placeholder="Search staff" class="flex-1 border-0 bg-transparent text-[14px] text-ink">
          </label>
          <span class="text-[13px] text-muted">{{ activeCount }} active · {{ invitedCount }} invited</span>
        </div>
        <div class="overflow-x-auto rounded border border-line">
          <table class="w-full min-w-[640px]">
            <thead>
              <tr class="bg-surface text-xs text-muted">
                <th class="px-4 py-2.5">
                  Name
                </th>
                <th class="px-2 py-2.5">
                  Role
                </th>
                <th class="px-2 py-2.5">
                  Accounts
                </th>
                <th class="px-2 py-2.5">
                  Status
                </th>
                <th class="py-2.5 pr-4 pl-2 text-right">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in members" :key="m.id" :class="m.id === freshId ? 'bg-surface' : ''">
                <td class="border-t border-line px-4 py-3">
                  <span class="flex items-center gap-2.5">
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs" :style="{ background: m.avatarColor }">{{ initials(m.name) }}</span>
                    <span class="flex min-w-0 flex-col">
                      <span>{{ m.name }}<span v-if="m.id === user?.id" class="text-muted"> · you</span></span>
                      <span class="truncate text-xs text-muted">{{ [m.title, m.email].filter(Boolean).join(' · ') }}</span>
                    </span>
                  </span>
                </td>
                <td class="border-t border-line px-2 py-3">
                  {{ ROLE_INFO[m.role].name }}
                </td>
                <td class="border-t border-line px-2 py-3">
                  <span class="flex gap-1">
                    <template v-for="id in m.accountIds" :key="id">
                      <AccountMark v-if="accountById[id]" :mark="accountById[id]!.mark" :color="accountById[id]!.color" :size="22" />
                    </template>
                  </span>
                </td>
                <td class="border-t border-line px-2 py-3">
                  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs" :style="{ background: STATUS_STYLE[m.status].bg, color: STATUS_STYLE[m.status].fg }">{{ STATUS_STYLE[m.status].label }}</span>
                </td>
                <td class="border-t border-line py-3 pr-4 pl-2 text-right">
                  <button type="button" class="inline-flex size-9 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink hover:bg-surface-2" :aria-label="`Manage ${m.name}`" @click="openEdit(m)">
                    <AppIcon name="more" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-3 flex flex-col gap-2.5">
          <h2 class="m-0 text-[16px] font-normal">
            What each role can do
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr class="text-xs text-muted">
                  <th class="border-b border-line py-1.5 pr-2">
                    Permission
                  </th>
                  <th v-for="r in ROLES" :key="r" class="border-b border-line px-2 py-1.5 text-center">
                    {{ ROLE_INFO[r].name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in PERMISSION_LABELS" :key="p.permission">
                  <td class="border-b border-line py-2.5 pr-2">
                    {{ p.label }}
                  </td>
                  <td v-for="r in ROLES" :key="r" class="border-b border-line px-2 py-2.5 text-center" :class="roleCan(r, p.permission) ? 'text-ink' : 'text-[#a3a29d]'">
                    <span :aria-label="roleCan(r, p.permission) ? 'Yes' : 'No'">{{ roleCan(r, p.permission) ? '✓' : '—' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <AppDialog v-if="editing" v-model:open="editOpen" :title="editing.name" :description="editing.email" :width="520">
      <form class="flex flex-col gap-4" @submit.prevent="saveEdit">
        <label class="field">Job title<input v-model="edit.title" class="input"></label>
        <label class="field">Role
          <select v-model="edit.role" class="input">
            <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_INFO[r].name }} — {{ ROLE_INFO[r].description }}</option>
          </select>
        </label>
        <fieldset v-if="edit.role !== 'admin'" class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="mb-2 p-0 text-[13px] text-muted">
            Account access
          </legend>
          <label v-for="a in accounts" :key="a.id" class="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-rule px-3">
            <input v-model="edit.accountIds" type="checkbox" :value="a.id" class="accent-ink">
            <AccountMark :mark="a.mark" :color="a.color" :size="22" />{{ a.name }}
          </label>
        </fieldset>
        <p v-else class="m-0 text-xs text-muted">
          Admins always have access to every account.
        </p>

        <p v-if="editError" role="alert" class="m-0 rounded bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {{ editError }}
        </p>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div class="flex flex-wrap gap-2">
            <template v-if="editing.status === 'invited'">
              <button type="button" class="btn btn-sm" @click="resendInvite">
                New invite link
              </button>
              <button type="button" class="btn btn-sm btn-ghost btn-danger" @click="withdrawInvite">
                Withdraw invite
              </button>
            </template>
            <button v-else-if="editing.status === 'active' && editing.id !== user?.id" type="button" class="btn btn-sm btn-ghost btn-danger" @click="setStatus('suspended')">
              Suspend access
            </button>
            <button v-else-if="editing.status === 'suspended'" type="button" class="btn btn-sm" @click="setStatus('active')">
              Restore access
            </button>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">
            Save changes
          </button>
        </div>
      </form>
    </AppDialog>
  </PageMain>
</template>
