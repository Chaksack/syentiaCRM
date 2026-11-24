<script setup lang="ts">
import type { License, LicenseStatus } from '#shared/types/domain'
import { CYCLE_LABEL, daysFromToday, formatDate, formatMoney, formatTotals, RENEWAL_WINDOW_DAYS, yearlyEquivalent } from '#shared/utils/format'

useHead({ title: 'Licences · Syentia CRM' })

const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const { account, accountId } = useCurrentAccount()
const toast = useToast()

const { data, refresh } = await useFetch('/api/licenses', {
  query: { account: accountId },
  default: () => ({ licenses: [] as License[] }),
})
const licenses = computed(() => data.value.licenses)

// ── Filters (client-side: an account holds dozens of licences, not thousands) ──
const search = ref('')
const status = ref<LicenseStatus | ''>('')
const holder = ref<'' | 'company' | 'customers'>('')

const countBy = (s: LicenseStatus) => licenses.value.filter(l => l.status === s).length
const statusFilters = computed(() => [
  { value: '' as const, label: 'All', count: licenses.value.length },
  {
    value: 'due_soon' as const,
    label: 'Renews soon',
    count: countBy('due_soon'),
  },
  {
    value: 'expired' as const,
    label: 'Expired',
    count: countBy('expired'),
  },
  {
    value: 'active' as const,
    label: 'Active',
    count: countBy('active'),
  },
  {
    value: 'cancelled' as const,
    label: 'Cancelled',
    count: countBy('cancelled'),
  },
].filter(f => f.value === '' || f.count > 0 || status.value === f.value))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return licenses.value.filter(l =>
    (!status.value || l.status === status.value)
    && (!holder.value || (holder.value === 'company') === !l.customerId)
    && (!q || [
      l.name,
      l.issuer,
      l.reference,
      l.customerName ?? '',
    ].some(v => v.toLowerCase().includes(q))),
  )
})

// ── Totals ──
const live = computed(() => licenses.value.filter(l => l.status !== 'cancelled'))
const yearlyCost = computed(() => {
  const totals: Record<string, number> = {}
  for (const l of live.value) totals[l.currency] = (totals[l.currency] ?? 0) + yearlyEquivalent(l.cost, l.cycle)
  return formatTotals(totals)
})

// ── Selection (kept in ?id= so dashboard follow-ups can link straight to a licence) ──
const selectedId = computed(() => typeof route.query.id === 'string'
  ? route.query.id
  : '')
const selected = computed(() => licenses.value.find(l => l.id === selectedId.value) ?? filtered.value[0] ?? null)
function select(id: string) {
  router.replace({
    query: { ...route.query, id },
  })
}
watch(accountId, () => router.replace({ query: {} }))

// ── Add / edit / renew / delete ──
const formOpen = ref(false)
const editing = ref<License | null>(null)
function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit() {
  editing.value = selected.value
  formOpen.value = true
}
async function onSaved(license: License) {
  await refresh()
  select(license.id)
}

const busy = ref(false)
async function renew() {
  if (!selected.value)
    return
  busy.value = true
  try {
    const res = await $fetch(`/api/licenses/${selected.value.id}/renew`, { method: 'POST' })
    await refresh()
    toast.success(`Renewed to ${formatDate(res.license!.renewalDate)}`)
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    busy.value = false
  }
}

const confirmDelete = ref(false)
async function remove() {
  if (!selected.value)
    return
  busy.value = true
  try {
    await $fetch(`/api/licenses/${selected.value.id}`, { method: 'DELETE' })
    confirmDelete.value = false
    toast.success('Licence deleted')
    await router.replace({ query: {} })
    await refresh()
  }
  catch (e) {
    toast.error(errorMessage(e))
  }
  finally {
    busy.value = false
  }
}

function renewalTone(l: License) {
  return l.status === 'expired'
    ? 'text-danger'
    : l.status === 'due_soon'
      ? 'text-[#6b4a00]'
      : 'text-muted'
}
</script>

<template>
  <PageMain>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">
          Licences <span class="text-faint">{{ licenses.length }}</span>
        </h1>
        <p class="m-0 text-muted">
          Permits, subscriptions and software licences held by {{ account?.name }} or its customers, with their renewal dates.
        </p>
      </div>
      <button v-if="can('customers.write')" type="button" class="btn btn-primary" @click="openNew">
        <AppIcon name="plus" :size="14" :stroke-width="1.8" />Add licence
      </button>
    </header>

    <section aria-label="Totals" class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Renewing in {{ RENEWAL_WINDOW_DAYS }} days</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">{{ countBy('due_soon') }}</span>
        <span class="text-xs text-muted">Live licences due soon</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Expired</span>
        <span class="tabular text-[22px] tracking-[-0.02em]" :class="countBy('expired') ? 'text-danger' : ''">{{ countBy('expired') }}</span>
        <span class="text-xs text-muted">Past renewal date, not renewed</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Live licences</span>
        <span class="tabular text-[22px] tracking-[-0.02em]">{{ live.length }}</span>
        <span class="text-xs text-muted">{{ countBy('cancelled') }} cancelled</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded bg-surface p-[18px]">
        <span class="text-[13px] text-muted">Yearly cost</span>
        <span class="tabular text-[18px] leading-[1.6] tracking-[-0.01em]">{{ yearlyCost }}</span>
        <span class="text-xs text-muted">Live licences, per year</span>
      </div>
    </section>

    <div class="flex flex-wrap items-center gap-2.5">
      <label class="flex min-h-11 flex-[1_1_260px] items-center gap-2 rounded bg-surface px-3.5">
        <AppIcon name="search" class="text-muted" />
        <span class="sr-only">Search licences</span>
        <input v-model="search" type="search" placeholder="Search by name, issuer, number or customer" class="flex-1 border-0 bg-transparent text-[14px] text-ink outline-offset-4">
      </label>
      <div role="group" aria-label="Filter by status" class="flex flex-wrap gap-1.5">
        <button v-for="f in statusFilters" :key="f.value" type="button" class="chip" :aria-pressed="status === f.value" @click="status = f.value">
          {{ f.label }} {{ f.count }}
        </button>
      </div>
      <label class="field">
        <span class="sr-only">Held by</span>
        <select v-model="holder" class="input !min-h-9 !w-auto !rounded-full text-[13px]">
          <option value="">Everyone’s</option>
          <option value="company">Our company’s</option>
          <option value="customers">Customers’</option>
        </select>
      </label>
    </div>

    <div class="flex flex-wrap items-start gap-2.5">
      <section aria-label="Licence list" class="min-w-0 flex-[3_1_560px] overflow-x-auto rounded border border-line">
        <table class="w-full min-w-[640px]">
          <thead>
            <tr class="bg-surface text-xs text-muted">
              <th class="px-4 py-2.5">
                Licence
              </th>
              <th class="px-2 py-2.5">
                Held by
              </th>
              <th class="px-2 py-2.5">
                Renewal
              </th>
              <th class="px-2 py-2.5 text-right">
                Cost
              </th>
              <th class="py-2.5 pr-4 pl-2">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="l in filtered" :key="l.id"
              class="cursor-pointer hover:bg-surface"
              :class="l.id === selected?.id ? '!bg-surface-2' : ''"
              @click="select(l.id)"
            >
              <td class="border-t border-line px-4 py-3">
                <span class="flex flex-col">
                  <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-left text-ink" :aria-current="l.id === selected?.id" @click.stop="select(l.id)">{{ l.name }}</button>
                  <span class="text-xs text-muted">{{ l.issuer || '—' }}</span>
                </span>
              </td>
              <td class="border-t border-line px-2 py-3">
                {{ l.customerName ?? 'Our company' }}
              </td>
              <td class="border-t border-line px-2 py-3">
                <span class="flex flex-col">
                  <span class="tabular">{{ l.renewalDate ? formatDate(l.renewalDate) : 'No expiry' }}</span>
                  <span v-if="l.renewalDate && l.status !== 'cancelled'" class="text-xs" :class="renewalTone(l)">{{ daysFromToday(l.renewalDate) }}</span>
                </span>
              </td>
              <td class="tabular border-t border-line px-2 py-3 text-right whitespace-nowrap">
                <template v-if="l.cost">
                  {{ formatMoney(l.cost, l.currency) }} <span class="text-xs text-muted">{{ CYCLE_LABEL[l.cycle].per }}</span>
                </template>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="border-t border-line py-3 pr-4 pl-2">
                <StatusPill :license="l.status" />
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="5" class="border-t border-line px-4 py-12 text-center text-muted">
                {{ licenses.length ? 'No licences match.' : 'No licences yet — add your first one to track its renewal.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside v-if="selected" aria-label="Selected licence" class="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded bg-surface p-6">
        <div class="flex items-start gap-3">
          <span class="flex size-12 shrink-0 items-center justify-center rounded bg-ink text-paper"><AppIcon name="licenses" :size="22" /></span>
          <div class="flex min-w-0 flex-col gap-1">
            <h2 class="m-0 text-[22px] leading-[1.3] font-normal tracking-[-0.01em] break-words">
              {{ selected.name }}
            </h2>
            <span class="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusPill :license="selected.status" />{{ selected.issuer }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Renewal date</span>
            <span class="tabular text-[18px]">{{ selected.renewalDate ? formatDate(selected.renewalDate) : 'No expiry' }}</span>
            <span v-if="selected.renewalDate && selected.status !== 'cancelled'" class="text-xs" :class="renewalTone(selected)">{{ daysFromToday(selected.renewalDate) }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-paper p-3.5">
            <span class="text-xs text-muted">Cost {{ CYCLE_LABEL[selected.cycle].per }}</span>
            <span class="tabular text-[18px]">{{ formatMoney(selected.cost, selected.currency) }}</span>
            <span v-if="selected.cycle !== 'yearly' && selected.cost" class="text-xs text-muted">{{ formatMoney(yearlyEquivalent(selected.cost, selected.cycle), selected.currency) }} / year</span>
          </div>
        </div>

        <dl class="m-0 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
          <dt class="text-muted">
            Held by
          </dt><dd class="m-0">
            <NuxtLink v-if="selected.customerId" :to="`/customers?id=${selected.customerId}`">{{ selected.customerName }}</NuxtLink>
            <template v-else>
              {{ account?.name }} (our company)
            </template>
          </dd>
          <dt class="text-muted">
            Number / key
          </dt><dd class="m-0 break-all">
            {{ selected.reference || '—' }}
          </dd>
          <dt class="text-muted">
            Started
          </dt><dd class="m-0">
            {{ formatDate(selected.startDate) }}
          </dd>
          <dt class="text-muted">
            Renews
          </dt><dd class="m-0">
            {{ CYCLE_LABEL[selected.cycle].name }}{{ selected.autoRenew ? ' · automatically' : ' · manually' }}
          </dd>
          <template v-if="selected.notes">
            <dt class="text-muted">
              Notes
            </dt><dd class="m-0 whitespace-pre-line">
              {{ selected.notes }}
            </dd>
          </template>
        </dl>

        <div v-if="can('customers.write')" class="flex flex-wrap gap-2">
          <button v-if="selected.renewalDate" type="button" class="btn btn-primary" :disabled="busy" @click="renew">
            <AppIcon name="check" :size="14" />Mark renewed
          </button>
          <button type="button" class="btn btn-ghost" @click="openEdit">
            Edit
          </button>
          <button type="button" class="btn btn-ghost btn-danger" @click="confirmDelete = true">
            <AppIcon name="trash" :size="14" />Delete
          </button>
        </div>
        <p v-if="can('customers.write') && selected.renewalDate" class="-mt-3 m-0 text-xs text-muted">
          Mark renewed moves the renewal date on one {{ selected.cycle === 'monthly' ? 'month' : selected.cycle === 'quarterly' ? 'quarter' : 'year' }}.
        </p>
      </aside>
    </div>

    <LicenseFormDialog v-model:open="formOpen" :account-id="accountId" :currency="account?.currency ?? 'GHS'" :license="editing" @saved="onSaved" />

    <AppDialog v-model:open="confirmDelete" title="Delete this licence?" :description="`${selected?.name} will be removed. This can’t be undone — to stop tracking renewals but keep the record, edit it and mark it cancelled.`" :width="460">
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" @click="confirmDelete = false">
          Keep it
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="remove">
          Delete licence
        </button>
      </div>
    </AppDialog>
  </PageMain>
</template>
